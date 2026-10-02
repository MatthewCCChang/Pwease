import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { ApiHealth } from '../../src/components/ApiHealth';
import { Button, Copy, Heading, Panel, Placeholder, Screen, SkeletonNotice } from '../../src/components/ui';
import { categoryPalettes, colors } from '../../src/theme';

export default function HomeScreen() {
  return (
    <Screen insetTop={false}>
      <SkeletonNotice />
      <Heading>Your cozy corner</Heading>
      <Button label="Profile / switch workspace · Not implemented" disabled secondary />
      <Placeholder title="Needs your paw" detail="Incoming approvals and their count will appear here once connected." />
      <Placeholder title="Waiting for a paw" detail="Sent requests are a placeholder here. The finished app will hide this section until requests exist." />
      <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}>
        <Panel>
          <Text style={styles.title}>Growing good</Text>
          <Copy>Category palette preview · Stamp cards and carousel are not implemented.</Copy>
          <View style={styles.swatches}>
            {Object.entries(categoryPalettes).map(([key, palette]) => (
              <View key={key} style={[styles.swatch, { backgroundColor: palette.background }]}>
                <Text style={[styles.swatchLabel, { color: palette.accent }]}>{palette.example}</Text>
              </View>
            ))}
          </View>
        </Panel>
      </Animated.View>
      <Button label="Preview request modal" onPress={() => router.push('/request')} />
      <ApiHealth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '600', color: colors.text },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  swatchLabel: { fontWeight: '600', fontSize: 14 },
});
