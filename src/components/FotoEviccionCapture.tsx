import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TacticalTheme } from '../theme/TacticalTheme';

const T = TacticalTheme;

interface FotoEviccionCaptureProps {
  base64: string;
  capturando: boolean;
  onCapturar: () => void;
}

export function FotoEviccionCapture({
  base64,
  capturando,
  onCapturar,
}: FotoEviccionCaptureProps): React.JSX.Element {
  const uri = base64 ? `data:image/jpeg;base64,${base64}` : null;

  return (
    <View>
      <TouchableOpacity
        style={[styles.btn, capturando && styles.btnDisabled]}
        onPress={onCapturar}
        disabled={capturando}
        activeOpacity={0.85}
      >
        {capturando ? (
          <ActivityIndicator color={T.bg} />
        ) : (
          <Text style={styles.btnText}>CAPTURAR FOTO DE EVICCIÓN</Text>
        )}
      </TouchableOpacity>
      {uri ? (
        <Image source={{ uri }} style={styles.preview} accessibilityLabel="Foto de evicción" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.accent,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: T.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  preview: {
    width: '100%',
    height: 140,
    marginTop: 10,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.bg,
  },
});
