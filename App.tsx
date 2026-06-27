import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import { SQLiteReporteRepository } from './src/infrastructure/repositories/SQLiteReporteRepository';

import { BrutalistTheme } from './src/theme/BrutalistTheme';

const T = BrutalistTheme;

export default function App(): React.JSX.Element {
  const repository = useMemo(() => new SQLiteReporteRepository(), []);
  const [listo, setListo] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    repository
      .inicializar()
      .then(() => setListo(true))
      .catch(() => setErrorCarga('Error al cargar registros guardados.'));
  }, [repository]);

  if (errorCarga) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: T.critico, fontWeight: '800' }}>{errorCarga}</Text>
      </View>
    );
  }

  if (!listo) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={T.ink} />
        <Text style={{ color: T.inkMuted, marginTop: 16, fontWeight: '700', letterSpacing: 1 }}>
          Cargando registros…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <HomeScreen repository={repository} />
    </View>
  );
}
