import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { createInviteSchema, inviteCodeSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import type { Transaction } from '../db';
import { workspace, workspaceMember, workspaceInvite } from '../db/schema';
import { body, lockWorkspace, parse, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

type WorkspaceWithRole = typeof workspace.$inferSelect & { role: typeof workspaceMember.$inferSelect.role };

async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function acceptInvitation(
  tx: Transaction,
  codeHash: string,
  userId: string,
): Promise<WorkspaceWithRole> {
  const candidates = await tx.select().from(workspaceInvite).where(eq(workspaceInvite.codeHash, codeHash));
  const candidate = candidates[0];
  if (!candidate) fail(404, 'NOT_FOUND', 'Invitation is invalid or no longer available.');

  // Keep this lock order aligned with member removal and invite creation.
  const matchingWorkspaces = await tx.select().from(workspace)
    .where(eq(workspace.id, candidate.workspaceId)).for('update');
  const matchingInvites = await tx.select().from(workspaceInvite)
    .where(eq(workspaceInvite.id, candidate.id)).for('update');
  const selectedWorkspace = matchingWorkspaces[0];
  const invite = matchingInvites[0];
  const isUnavailable = !selectedWorkspace || !invite || invite.usedAt || invite.expiresAt <= new Date();
  if (isUnavailable) fail(404, 'NOT_FOUND', 'Invitation is invalid or no longer available.');

  const issuerMemberships = await tx.select().from(workspaceMember).where(and(
    eq(workspaceMember.workspaceId, selectedWorkspace.id), eq(workspaceMember.userId, invite.createdBy),
  ));
  const issuerMembership = issuerMemberships[0];
  if (issuerMembership?.role !== 'OWNER') {
    fail(404, 'NOT_FOUND', 'Invitation is invalid or no longer available.');
  }

  const existingMemberships = await tx.select().from(workspaceMember).where(and(
    eq(workspaceMember.workspaceId, selectedWorkspace.id), eq(workspaceMember.userId, userId),
  ));
  const existingMembership = existingMemberships[0];
  // Existing members do not consume the invitation.
  if (existingMembership) return { ...selectedWorkspace, role: existingMembership.role };

  await tx.insert(workspaceMember).values({ workspaceId: selectedWorkspace.id, userId, role: 'MEMBER' });
  await tx.update(workspaceInvite).set({ usedAt: new Date() }).where(eq(workspaceInvite.id, invite.id));
  return { ...selectedWorkspace, role: 'MEMBER' };
}

export function createInviteRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.post('/workspace-invites', protectedHandler(deps, async (c, db, userId) => {
    const { workspaceId } = await body(c, createInviteSchema);
    const code = crypto.randomUUID().replaceAll('-', '');
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await db.transaction(async (tx) => {
      const workspaceMembership = await lockWorkspace(tx, workspaceId, userId);
      if (workspaceMembership.role !== 'OWNER') fail(403, 'FORBIDDEN', 'Only owners can invite members.');
      await tx.insert(workspaceInvite).values({ workspaceId, createdBy: userId, codeHash, expiresAt });
    });
    return c.json({ code, expiresAt: expiresAt.toISOString() }, 201);
  }));
  routes.post('/workspace-invites/:code/accept', protectedHandler(deps, async (c, db, userId) => {
    const code = parse(inviteCodeSchema, c.req.param('code'));
    const codeHash = await hashCode(code);
    const acceptedWorkspace = await db.transaction((tx) => acceptInvitation(tx, codeHash, userId));
    return c.json(acceptedWorkspace);
  }));
  return routes;
}
