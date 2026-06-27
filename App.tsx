import React, { useMemo } from 'react';
import { View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import { MemoryReporteRepository } from './src/infrastructure/repositories/MemoryReporteRepository';
import { MeshSimulationService } from './src/infrastructure/services/MeshSimulationService';

export default function App(): React.JSX.Element {
  const { repository, meshService } = useMemo(() => {
    const repo = new MemoryReporteRepository();
    const mesh = new MeshSimulationService(repo);
    return { repository: repo, meshService: mesh };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <HomeScreen
        repository={repository}
        meshService={meshService}
        memoryRepository={repository}
      />
    </View>
  );
}
