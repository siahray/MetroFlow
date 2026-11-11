import { Text, View } from 'react-native';

import { useTheme } from '../theme';

/** Initials from a name or email; "?" when there is nothing to show (guest). */
export function initialsOf(name?: string | null): string {
  const source = (name ?? '').trim();
  if (!source) return '?';
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
  // inkBg/onInk is the pairing that stays a dark chip with light initials in
  // every theme; slate900/white would flip and look wrong next to storm cards.
  const { c } = useTheme();
  return (
    <View
      accessibilityLabel={name ? `Signed in as ${name}` : 'Guest'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.inkBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c.onInk, fontWeight: '800', fontSize: size * 0.38 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
