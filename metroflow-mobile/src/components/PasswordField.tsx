import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { fontSize, space, useTheme } from '../theme';

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
  const { c } = useTheme();

  return (
    <View>
      <Text style={{ fontSize: fontSize.caption, fontWeight: '600', color: c.slate700, marginBottom: space[6] }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.white,
          borderWidth: 1,
          borderColor: c.slate200,
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
            color: c.slate900,
          }}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          style={{ paddingHorizontal: space[14] }}
        >
          {visible ? <EyeOff size={18} color={c.slate500} /> : <Eye size={18} color={c.slate500} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}
