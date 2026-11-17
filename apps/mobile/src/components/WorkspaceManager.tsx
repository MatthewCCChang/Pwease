import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { createWorkspaceSchema, inviteCodeSchema, inviteResponseSchema, workspaceResponseSchema } from '@pwease/shared';
import { apiRequest } from '../lib/api';
import { colors, radius, spacing } from '../theme';
import { Button, Copy, Panel } from './ui';
import { useWorkspaces } from './WorkspaceProvider';

export function WorkspaceManager() {
  const { workspaces, active, loading, error, select, activate, refresh } = useWorkspaces();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState<{ code: string; expiresAt: string; workspaceId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <Panel>
      <Text style={styles.title}>Your cozy corners</Text>
      {loading && <Copy>Loading workspaces...</Copy>}
      {error && <Copy>{error}</Copy>}
      {!loading && !error && !workspaces.length && <Copy>Create a workspace or join with an invitation code.</Copy>}
      {workspaces.map((space) => (
        <Button key={space.id} label={(space.id === active?.id ? 'Current: ' : 'Switch to ') + space.name}
          secondary disabled={busy} onPress={() => { void run(() => select(space.id)); }} />
      ))}
      <Button label="Refresh workspaces" secondary disabled={busy} onPress={() => { void run(refresh); }} />
      <TextInput accessibilityLabel="Workspace name" placeholder="New workspace name" placeholderTextColor={colors.muted}
        value={name} onChangeText={setName} maxLength={120} editable={!busy} style={styles.input} />
      <Button label="Create workspace" disabled={busy || !name.trim()} onPress={() => { void run(async () => {
        const input = createWorkspaceSchema.safeParse({ name });
        if (!input.success) throw new Error('Enter a workspace name between 1 and 120 characters.');
        const space = await apiRequest('/api/workspaces', workspaceResponseSchema, { method: 'POST', body: input.data });
        setName('');
        activate(space);
        setMessage('Welcome to workspace ' + space.name + '!');
      }); }} />
      <TextInput accessibilityLabel="Invitation code" placeholder="Paste invitation code" placeholderTextColor={colors.muted}
        value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} />
      <Button label="Join workspace" disabled={busy || !code.trim()} onPress={() => { void run(async () => {
        const parsed = inviteCodeSchema.safeParse(code);
        if (!parsed.success) throw new Error('Paste the complete 32-character invitation code.');
        const space = await apiRequest('/api/workspace-invites/' + parsed.data + '/accept', workspaceResponseSchema, { method: 'POST' });
        setCode('');
        activate(space);
        setMessage('Welcome to workspace ' + space.name + '!');
      }); }} />
      {active?.role === 'OWNER' && <>
        <Button label={'Invite someone to ' + active.name} secondary disabled={busy} onPress={() => { void run(async () => {
          const result = await apiRequest('/api/workspace-invites', inviteResponseSchema, {
            method: 'POST', body: { workspaceId: active.id },
          });
          setInvite({ ...result, workspaceId: active.id });
        }); }} />
        {invite?.workspaceId === active.id && <>
          <Copy>Share this code with one person. It can be used once.</Copy>
          <Text selectable style={styles.code}>{invite.code}</Text>
          <Copy>Expires {new Date(invite.expiresAt).toLocaleString()}</Copy>
        </>}
      </>}
      {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    </Panel>
  );
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '600' },
  input: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border,
    borderWidth: 1, borderRadius: radius.button, padding: spacing.md, minHeight: 48 },
  code: { color: colors.text, fontSize: 16 },
  message: { color: colors.text, fontSize: 16 },
});
