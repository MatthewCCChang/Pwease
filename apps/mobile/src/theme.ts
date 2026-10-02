import type { CategoryColorKey } from '@pwease/shared';

export const colors = {
  background: '#FAF7F1',
  surface: '#FFFDFA',
  text: '#49362D',
  muted: '#75695F',
  border: '#DED5C9',
  primary: '#A6533D',
  primaryPressed: '#88432F',
  onPrimary: '#FFFFFF',
  disabled: '#E4DED6',
  disabledText: '#70665C',
  sage: '#526749',
} as const;

export const categoryPalettes = {
  sage: { label: 'Sage', example: 'Wellness', background: '#EAF0E2', accent: '#526749' },
  peach: { label: 'Peach', example: 'Home', background: '#F8E8DC', accent: '#A6533D' },
  lavender: { label: 'Lavender', example: 'Kindness', background: '#EEE7F4', accent: '#705784' },
  blue: { label: 'Blue mist', example: 'Focus', background: '#E6EDF4', accent: '#4D6881' },
  honey: { label: 'Honey', example: 'Learning', background: '#F7EFCF', accent: '#806322' },
  rose: { label: 'Dusty rose', example: 'Creativity', background: '#F4E4E8', accent: '#8B5262' },
} as const satisfies Record<CategoryColorKey, {
  label: string; example: string; background: string; accent: string;
}>;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, card: 20, button: 24 } as const;
