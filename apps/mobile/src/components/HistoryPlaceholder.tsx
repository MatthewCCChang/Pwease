import { Button, Copy, Heading, Placeholder, Screen, SkeletonNotice } from './ui';

export function HistoryPlaceholder({ completed }: { completed: boolean }) {
  return (
    <Screen insetTop={false}>
      <SkeletonNotice />
      <Heading>{completed ? 'Completed cards' : 'Approved requests'}</Heading>
      <Copy>{completed ? 'Your collected little wins will live here.' : 'Previously approved stamp requests will live here.'}</Copy>
      <Button label="Category & role filters · Not implemented" disabled />
      <Placeholder
        title="Nothing connected yet"
        detail={completed
          ? 'Completion, redemption, and the diagonal REDEEMED treatment will be added later.'
          : 'This route will show requests you submitted or approved. No history is loaded yet.'}
      />
    </Screen>
  );
}
