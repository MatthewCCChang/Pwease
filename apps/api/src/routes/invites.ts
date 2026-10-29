import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { createInviteSchema, inviteCodeSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { workspace, workspaceMember, workspaceInvite } from '../db/schema';
import { body, lockWorkspace, parse, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

async function hashCode(code: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createInviteRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.post('/workspace-invites', protectedHandler(deps, async (c, db, userId) => {
    const { workspaceId } = await body(c, createInviteSchema);
    const code = crypto.randomUUID().replaceAll('-', '');
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await db.transaction(async (tx) => {
      const member = await lockWorkspace(tx, workspaceId, userId);
      if (member.role !== 'OWNER') fail(403, 'FORBIDDEN', 'Only owners can invite members.');
      await tx.insert(workspaceInvite).values({ workspaceId, createdBy: userId, codeHash, expiresAt });
    });
    return c.json({ code, expiresAt: expiresAt.toISOString() }, 201);
  }));
  routes.post('/workspace-invites/:code/accept', protectedHandler(deps, async (c, db, userId) => {
    const code = parse(inviteCodeSchema, c.req.param('code'));
    const codeHash = await hashCode(code);
    const result = await db.transaction(async (tx) => {
      const [candidate] = await tx.select().from(workspaceInvite).where(eq(workspaceInvite.codeHash, codeHash));
      if (!candidate) fail(404, 'NOT_FOUND', 'Invitation is invalid or no longer available.');
      // Same lock order as member removal and invite creation.
      const [space] = await tx.select().from(workspace).where(eq(workspace.id, candidate.workspaceId)).for('update');
      const [invite] = await tx.select().from(workspaceInvite).where(eq(workspaceInvite.id, candidate.id)).for('update');
      if (!space || !invite || invite.usedAt || invite.expiresAt <= new Date()) {
        fail(404, 'NOT_FOUND', 'Invitation is invalid or no longer available.');
      }
      const [issuer] = await tx.select().from(workspaceMember).where(and(
        eq(workspaceMember.workspaceId, space.id), eq(workspaceMember.userId, invite.createdBy),
      ));
      if (issuer?.role !== 'OWNER') fail(404, 'NOT_FOUND', 'Invitation is invalid or no longer available.');
      const [existing] = await tx.select().from(workspaceMember).where(and(
        eq(workspaceMember.workspaceId, space.id), eq(workspaceMember.userId, userId),
      ));
      // Existing members do not consume the invitation.
      if (existing) return { ...space, role: existing.role };
      await tx.insert(workspaceMember).values({ workspaceId: space.id, userId, role: 'MEMBER' });
      await tx.update(workspaceInvite).set({ usedAt: new Date() }).where(eq(workspaceInvite.id, invite.id));
      return { ...space, role: 'MEMBER' as const };
    });
    return c.json(result);
  }));
  return routes;
}
