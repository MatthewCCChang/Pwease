import { router } from 'expo-router';
import { Button, Copy, Heading, Screen, SkeletonNotice } from '../src/components/ui';
import { CatYarnLoader } from '../src/components/CatYarnLoader';
import GoogleSignIn from '../src/components/googleSignIn';

export default function WelcomeScreen() {
  return (
    <Screen>
      <SkeletonNotice />
      <Heading>Pwease</Heading>
      <Copy>Little wins, shared with a paw.</Copy>
      <CatYarnLoader />
      <Copy>The sleeping-cat welcome artwork and provider-approved sign-in buttons will be added later.</Copy>
      <GoogleSignIn/>
      <Button label="Apple sign-in · Not implemented" disabled />
      <Button label="Explore the skeleton" onPress={() => router.push('/home')} />
      <Copy>This preview does not sign you in or create an account.</Copy>
    </Screen>
  );
}
