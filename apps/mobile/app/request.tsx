import { router } from 'expo-router';
import { Button, Copy, Panel, Screen, SkeletonNotice } from '../src/components/ui';

export default function RequestModal() {
  return (
    <Screen insetTop={false}>
      <SkeletonNotice />
      <Copy>This is a route placeholder, not a working form.</Copy>
      <Panel><Copy>Category → Person → Card</Copy></Panel>
      <Panel><Copy>Title and details will use the selected grouped writing panel.</Copy></Panel>
      <Panel><Copy>Stamp quantity: number chips with a More option.</Copy></Panel>
      <Panel><Copy>Photos (optional when the card’s proof rule allows it).</Copy></Panel>
      <Button label="Send request · Not implemented" disabled />
      <Button label="Close preview" secondary onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} />
    </Screen>
  );
}
