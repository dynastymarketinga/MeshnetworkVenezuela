import * as Location from 'expo-location';

export interface CoordenadasGps {
  latitud: number;
  longitud: number;
  precisionMetros: number | null;
}

export class LocationService {
  public static async obtenerCoordenadasActuales(): Promise<CoordenadasGps> {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (permiso.status !== 'granted') {
      throw new Error(
        'Permiso GPS denegado. Active ubicación para registrar coordenadas exactas de rescate.'
      );
    }

    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitud: posicion.coords.latitude,
      longitud: posicion.coords.longitude,
      precisionMetros: posicion.coords.accuracy,
    };
  }

  public static formatearCoordenadas(latitud: number, longitud: number): string {
    return `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;
  }
}
