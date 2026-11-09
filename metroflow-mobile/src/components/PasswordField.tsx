import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { fontSize, space, colors } from '../theme';

/** Password input with a show/hide toggle. */
export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder = '••••••••',
  autoComplete = 'password',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoComplete?: 'password' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Text style={{ fontSize: fontSize.caption, fontWeight: '600', color: colors.slate700, marginBottom: space[6] }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.slate200,
          borderRadius: 12,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          accessibilityLabel={label}
          placeholder={placeholder}
          style={{
            flex: 1,
            paddingHorizontal: space[14],
            paddingVertical: space[12],
            fontSize: fontSize.label,
            color: colors.slate900,
          }}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          style={{ paddingHorizontal: space[14] }}
        >
          {visible ? <EyeOff size={18} color={colors.slate500} /> : <Eye size={18} color={colors.slate500} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}
