import { createContext, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceListSchema, workspaceResponseSchema } from '@pwease/shared';
import type { z } from 'zod';
import { authClient } from '../lib/auth-client';
import { apiRequest } from '../lib/api';

type Workspace = z.infer<typeof workspaceResponseSchema>;
type WorkspaceState = {
  workspaces: Workspace[];
  active: Workspace | null;
  loading: boolean;
  error: string | null;
  select: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);

function SignedInWorkspaces({ children, userId }: PropsWithChildren<{ userId?: string }>) {
  const [selected, setSelected] = useState<string | null>(null);
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ['workspaces', userId],
    enabled: !!userId,
    queryFn: async ({ signal }) => {
      const rows: Workspace[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await apiRequest('/api/workspaces?limit=100&offset=' + offset, workspaceListSchema, { signal });
        rows.push(...page);
        if (page.length < 100) return rows;
      }
    },
    refetchInterval: 30_000,
  });
  const activeId = selected ?? list.data?.[0]?.id;
  const current = useQuery({
    queryKey: ['workspace', userId, activeId],
    enabled: !!userId && !!activeId,
    queryFn: ({ signal }) => apiRequest('/api/workspaces/' + activeId, workspaceResponseSchema, { signal }),
    refetchInterval: 30_000,
  });
  async function refresh() {
    await client.invalidateQueries({ queryKey: ['workspaces', userId] });
    await client.invalidateQueries({ queryKey: ['workspace', userId] });
  }
  async function select(id: string) {
    // Recheck membership even when the list is cached.
    const space = await apiRequest('/api/workspaces/' + id, workspaceResponseSchema);
    client.setQueryData(['workspace', userId, id], space);
    setSelected(id);
    await client.invalidateQueries({ queryKey: ['workspaces', userId] });
  }
  return (
    <WorkspaceContext.Provider value={{
      workspaces: userId && !list.isError ? list.data ?? [] : [],
      active: userId && !current.isError ? current.data ?? null : null,
      loading: !!userId && (list.isPending || (!!activeId && current.isPending)),
      error: list.error?.message ?? current.error?.message ?? null,
      select, refresh,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { data } = authClient.useSession();
  return <SignedInWorkspaces key={data?.user.id ?? 'guest'} userId={data?.user.id}>{children}</SignedInWorkspaces>;
}

export function useWorkspaces() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is missing.');
  return value;
}
