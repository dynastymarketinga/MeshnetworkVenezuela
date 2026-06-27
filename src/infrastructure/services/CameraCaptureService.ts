import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_ANCHO = 1024;
const CALIDAD_INICIAL = 0.55;
const CALIDAD_MINIMA = 0.35;
const MAX_BYTES_BASE64 = 200 * 1024;

export interface ResultadoFotoEviccion {
  base64: string;
  advertencia?: string;
}

function estimarBytesBase64(base64: string): number {
  return Math.ceil((base64.length * 3) / 4);
}

async function comprimirHastaLimite(uri: string, calidad: number): Promise<string> {
  const resultado = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_ANCHO } }],
    { compress: calidad, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  if (!resultado.base64) {
    throw new Error('No se pudo comprimir la imagen.');
  }
  return resultado.base64;
}

export const CameraCaptureService = {
  async solicitarPermisoCamara(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  },

  async capturarFotoEviccion(): Promise<ResultadoFotoEviccion | null> {
    const permitido = await this.solicitarPermisoCamara();
    if (!permitido) {
      throw new Error('Permiso de cámara denegado. Actívelo en Ajustes del teléfono.');
    }

    const captura = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (captura.canceled || !captura.assets?.[0]?.uri) {
      return null;
    }

    let calidad = CALIDAD_INICIAL;
    let base64 = await comprimirHastaLimite(captura.assets[0].uri, calidad);
    let advertencia: string | undefined;

    while (estimarBytesBase64(base64) > MAX_BYTES_BASE64 && calidad > CALIDAD_MINIMA) {
      calidad -= 0.1;
      base64 = await comprimirHastaLimite(captura.assets[0].uri, calidad);
    }

    if (estimarBytesBase64(base64) > MAX_BYTES_BASE64) {
      advertencia = 'La foto quedó grande; se guardó comprimida al máximo.';
    }

    return { base64, advertencia };
  },
};
