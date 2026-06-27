import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export interface CoordenadasGps {
  latitud: number;
  longitud: number;
  precisionMetros: number | null;
}

export class LocationService {
  public static async obtenerCoordenadasActuales(): Promise<CoordenadasGps> {
    const serviciosActivos = await Location.hasServicesEnabledAsync();
    if (!serviciosActivos) {
      throw new Error(
        'El GPS del teléfono está apagado. Active «Ubicación» en Ajustes del dispositivo.'
      );
    }

    const permiso = await Location.requestForegroundPermissionsAsync();
    if (permiso.status !== 'granted') {
      throw new Error('PERMISO_GPS_DENEGADO');
    }

    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitud: posicion.coords.latitude,
      longitud: posicion.coords.longitude,
      precisionMetros: posicion.coords.accuracy,
    };
  }

  public static abrirAjustesUbicacion(): void {
    void Linking.openSettings();
  }

  public static mensajePermisoDenegado(): string {
    if (Platform.OS === 'ios') {
      return 'Permita la ubicación:\n\nAjustes → MeshnetworkVenezuela → Ubicación → «Al usar la app»';
    }
    return 'Permita la ubicación:\n\nAjustes → Apps → Mesh Network Venezuela → Permisos → Ubicación → Permitir';
  }

  public static formatearCoordenadas(latitud: number, longitud: number): string {
    return `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;
  }
}
