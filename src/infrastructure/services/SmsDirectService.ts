import { Linking, Platform } from 'react-native';
import * as SMS from 'expo-sms';
import { OperacionConfig } from '../../config/OperacionConfig';

export class SmsDirectService {
  public static obtenerNumeroComando(): string {
    return OperacionConfig.COMANDO_CENTRAL_SMS;
  }

  public static async enviarMensaje(
    mensaje: string,
    numeroDestino?: string
  ): Promise<'enviado' | 'cancelado' | 'fallback'> {
    const numero = numeroDestino ?? OperacionConfig.COMANDO_CENTRAL_SMS;
    const disponible = await SMS.isAvailableAsync();

    if (disponible) {
      const resultado = await SMS.sendSMSAsync([numero], mensaje);
      if (resultado.result === 'sent') return 'enviado';
      if (resultado.result === 'cancelled') return 'cancelado';
    }

    const url =
      Platform.OS === 'ios'
        ? `sms:${numero}&body=${encodeURIComponent(mensaje)}`
        : `sms:${numero}?body=${encodeURIComponent(mensaje)}`;

    const puedeAbrir = await Linking.canOpenURL(url);
    if (!puedeAbrir) {
      throw new Error('No se pudo abrir la aplicación de SMS.');
    }

    await Linking.openURL(url);
    return 'fallback';
  }

  public static async enviarAlComandoCentral(
    mensaje: string
  ): Promise<'enviado' | 'cancelado' | 'fallback'> {
    return this.enviarMensaje(mensaje, OperacionConfig.COMANDO_CENTRAL_SMS);
  }
}
