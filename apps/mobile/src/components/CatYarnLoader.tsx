import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from '../theme';

// Static construction placeholder. The production layered illustration and motion
// will be authored later; it must respect reduced motion and never block navigation.
export function CatYarnLoader() {
  return (
    <View style={styles.container} accessibilityLabel="Static placeholder for a cat playing with yarn">
      <Svg width={200} height={100} viewBox="0 0 200 100" accessible={false}>
        <Ellipse cx="75" cy="68" rx="39" ry="21" fill="#F8E8DC" stroke={colors.text} strokeWidth="2" />
        <Path d="M43 62 L34 34 L51 40 Q63 30 76 40 L90 34 L87 62" fill="#F8E8DC" stroke={colors.text} strokeWidth="2" />
        <Path d="M49 51 Q54 57 59 51 M68 51 Q73 57 78 51 M66 60 L66 64" fill="none" stroke={colors.text} strokeWidth="2" />
        <Path d="M93 69 Q110 39 121 51 M91 80 Q112 90 129 78" fill="none" stroke={colors.text} strokeWidth="3" strokeLinecap="round" />
        <Circle cx="157" cy="65" r="21" fill="#EAF0E2" stroke={colors.sage} strokeWidth="2" />
        <Path d="M143 50 Q167 60 172 79 M138 63 Q155 57 174 68 M146 83 Q152 60 166 47" fill="none" stroke={colors.sage} strokeWidth="2" />
      </Svg>
      <Text style={styles.caption}>Cat + yarn · animation placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  caption: { color: colors.muted, fontSize: 12 },
});
