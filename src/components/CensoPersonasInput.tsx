import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TacticalTheme } from '../theme/TacticalTheme';

const T = TacticalTheme;

interface CensoPersonasInputProps {
  personas: string[];
  onChange: (personas: string[]) => void;
}

export function CensoPersonasInput({
  personas,
  onChange,
}: CensoPersonasInputProps): React.JSX.Element {
  const [texto, setTexto] = useState('');

  const agregar = (): void => {
    const valor = texto.trim();
    if (!valor) return;
    if (personas.some((p) => p.toLowerCase() === valor.toLowerCase())) {
      setTexto('');
      return;
    }
    onChange([...personas, valor]);
    setTexto('');
  };

  const quitar = (idx: number): void => {
    onChange(personas.filter((_, i) => i !== idx));
  };

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={texto}
          onChangeText={setTexto}
          placeholder="Nombre o cédula del grupo"
          placeholderTextColor={T.placeholder}
          onSubmitEditing={agregar}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.btnAgregar} onPress={agregar} activeOpacity={0.85}>
          <Text style={styles.btnAgregarText}>+</Text>
        </TouchableOpacity>
      </View>
      {personas.length > 0 ? (
        <View style={styles.chips}>
          {personas.map((p, idx) => (
            <TouchableOpacity
              key={`${p}-${idx}`}
              style={styles.chip}
              onPress={() => quitar(idx)}
              activeOpacity={0.8}
            >
              <Text style={styles.chipText}>{p} ×</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>Agregue familiares o personas en el refugio</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  input: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.border,
    color: T.ink,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  btnAgregar: {
    backgroundColor: T.accent,
    borderWidth: 2,
    borderColor: T.border,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAgregarText: { color: T.bg, fontSize: 22, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: T.ink, fontSize: 12, fontWeight: '700' },
  hint: { color: T.inkMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
});
