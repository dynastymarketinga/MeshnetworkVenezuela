import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { TacticalTheme } from '../theme/TacticalTheme';

const T = TacticalTheme;

interface TacticalSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function TacticalSearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar persona o zona…',
}: TacticalSearchBarProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Buscador táctico</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: {
    color: T.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.border,
    color: T.ink,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
