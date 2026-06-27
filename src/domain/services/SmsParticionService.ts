export const SMS_PROTOCOLO = 'MNv1';
export const SMS_MAX_CARACTERES = 140;

export function partirCadenaEnLotes(
  cadenaJson: string,
  maxCaracteres: number = SMS_MAX_CARACTERES
): string[] {
  const items: unknown = JSON.parse(cadenaJson);
  if (!Array.isArray(items) || items.length === 0) {
    return [cadenaJson];
  }

  const lotesContenido: unknown[][] = [];
  let loteActual: unknown[] = [];

  const cabeceraReserva = `${SMS_PROTOCOLO}|99/99|`;

  for (const item of items) {
    const prueba = [...loteActual, item];
    const jsonPrueba = JSON.stringify(prueba);
    if (loteActual.length > 0 && cabeceraReserva.length + jsonPrueba.length > maxCaracteres) {
      lotesContenido.push(loteActual);
      loteActual = [item];
    } else {
      loteActual = prueba;
    }
  }

  if (loteActual.length > 0) {
    lotesContenido.push(loteActual);
  }

  const total = lotesContenido.length;
  return lotesContenido.map((lote, indice) => {
    const numero = indice + 1;
    return `${SMS_PROTOCOLO}|${numero}/${total}|${JSON.stringify(lote)}`;
  });
}

export function parsearEntradaSms(texto: string): unknown[] {
  const lineas = texto
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lineas.length === 0) {
    throw new Error('La cadena SMS está vacía.');
  }

  const acumulado: unknown[] = [];
  let huboMultiparte = false;

  for (const linea of lineas) {
    if (linea.startsWith(`${SMS_PROTOCOLO}|`)) {
      huboMultiparte = true;
      const match = linea.match(/^MNv1\|\d+\/\d+\|(.+)$/);
      if (!match) {
        throw new Error(`Formato de lote inválido: ${linea.substring(0, 20)}...`);
      }
      const fragmento: unknown = JSON.parse(match[1]);
      if (!Array.isArray(fragmento)) {
        throw new Error('Cada lote SMS debe contener un arreglo JSON.');
      }
      acumulado.push(...fragmento);
    }
  }

  if (huboMultiparte) {
    return acumulado;
  }

  const parsed: unknown = JSON.parse(texto.trim());
  if (!Array.isArray(parsed)) {
    throw new Error('Se esperaba un arreglo JSON de reportes comprimidos.');
  }
  return parsed;
}
