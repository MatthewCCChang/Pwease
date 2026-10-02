import { router } from 'expo-router';
import { Button, Copy, Heading, Screen } from '../src/components/ui';

export default function NotFoundScreen() {
  return <Screen><Heading>A little lost?</Heading><Copy>This screen does not exist.</Copy><Button label="Back to Pwease" onPress={() => router.replace('/')} /></Screen>;
}
