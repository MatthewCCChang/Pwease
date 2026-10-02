import { useQuery } from '@tanstack/react-query';
import { Button, Copy, Panel } from './ui';
import { config } from '../config';
import { getHealth } from '../lib/api';

export function ApiHealth() {
  // Manual only: launching the shell never waits for a backend or silently retries.
  const health = useQuery({ queryKey: ['health', config.apiUrl], queryFn: getHealth, enabled: false });
  return (
    <Panel>
      <Copy>API connection · {config.apiUrl}</Copy>
      {health.data && <Copy>Connected to {health.data.service}. Cloud integrations are not connected.</Copy>}
      {health.isError && <Copy>{health.error.message} Check the API URL and local network.</Copy>}
      <Button label={health.isFetching ? 'Checking…' : 'Check API connection'} disabled={health.isFetching} secondary onPress={() => { void health.refetch(); }} />
    </Panel>
  );
}
