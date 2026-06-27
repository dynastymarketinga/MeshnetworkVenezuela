import { Linking, Platform } from 'react-native';

export class NavigationService {
  public static async navegarAlPunto(
    latitud: number,
    longitud: number,
    etiqueta: string
  ): Promise<void> {
    const lat = latitud.toFixed(6);
    const lon = longitud.toFixed(6);
    const nombre = encodeURIComponent(etiqueta.substring(0, 80));

    const urls =
      Platform.OS === 'android'
        ? [
            `geo:${lat},${lon}?q=${lat},${lon}(${nombre})`,
            `google.navigation:q=${lat},${lon}`,
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
          ]
        : [
            `maps://?daddr=${lat},${lon}&q=${nombre}`,
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
          ];

    for (const url of urls) {
      const puede = await Linking.canOpenURL(url);
      if (puede) {
        await Linking.openURL(url);
        return;
      }
    }

    throw new Error('No hay aplicación de mapas instalada (OsmAnd, Google Maps, Waze).');
  }
}
