import { WorkspaceManager } from './WorkspaceManager';
import { useState } from 'react';
import { Modal } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../lib/auth-client';
import { Button, Copy, Heading, Panel, Screen } from './ui';

function ProfileDetails({ close }: { close: () => void }) {
  const { data, isPending, error, refetch } = authClient.useSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error('Sign-out failed.');
      await queryClient.cancelQueries();
      queryClient.clear();
      close();
      router.replace('/');
    } catch {
      setMessage('Could not sign out. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading>Your profile</Heading>
      {isPending ? <Copy>Checking your session...</Copy> : error ? (
        <Copy>Could not load your session. Check your connection and try again.</Copy>
      ) : data ? (
        <Panel><Copy>{data.user.name}</Copy><Copy>{data.user.email}</Copy></Panel>
      ) : <Copy>You are browsing the preview. Sign in to save your progress.</Copy>}
      {message && <Copy>{message}</Copy>}
      <Button label="Refresh session" secondary disabled={busy || isPending} onPress={() => { void refetch(); }} />
      {data && <Button label={busy ? 'Signing out...' : 'Log out'} disabled={busy} onPress={() => { void signOut(); }} />}
      {!isPending && !error && !data && <Button label="Go to sign-in" onPress={() => { close(); router.replace('/'); }} />}
      {data && <WorkspaceManager />}
      <Button label="Close" secondary disabled={busy} onPress={close} />
    </Screen>
  );
}

export function ProfileMenu() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button label="Profile" secondary onPress={() => setVisible(true)} />
      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        {visible && <ProfileDetails close={() => setVisible(false)} />}
      </Modal>
    </>
  );
}
