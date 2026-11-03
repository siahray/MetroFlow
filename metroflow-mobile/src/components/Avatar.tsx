import { Text, View } from 'react-native';

import { colors } from '../theme';

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
  return (
    <View
      accessibilityLabel={name ? `Signed in as ${name}` : 'Guest'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.slate900,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.white, fontWeight: '800', fontSize: size * 0.38 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
