export type TipoRegistro = 'PERSONA_ATRAPADA' | 'INFRAESTRUCTURA_DANADA' | 'SIN_VIVIENDA';

export type EstadoEstructura = 'COLAPSO_TOTAL' | 'PARCIAL' | 'HABITABLE' | 'SEGURO';

export type EstadoReporte = 'POR LOCALIZAR' | 'LOCALIZADO' | 'CRITICO';

export const TIPOS_REGISTRO: readonly TipoRegistro[] = [
  'PERSONA_ATRAPADA',
  'INFRAESTRUCTURA_DANADA',
  'SIN_VIVIENDA',
] as const;

export const ESTADOS_ESTRUCTURA: readonly EstadoEstructura[] = [
  'COLAPSO_TOTAL',
  'PARCIAL',
  'HABITABLE',
  'SEGURO',
] as const;

export const ESTADOS_REPORTE: readonly EstadoReporte[] = [
  'CRITICO',
  'POR LOCALIZAR',
  'LOCALIZADO',
] as const;

export interface ReporteEmergencia {
  id: string;
  fuente_origen: string;
  tipo_registro: TipoRegistro;
  nombre_completo: string;
  edad: string;
  genero: string;
  ubicacion_exacta: string;
  latitud: number;
  longitud: number;
  estado_actual: EstadoReporte;
  telefono_contacto: string;
  estado_estructura: EstadoEstructura;
  notas_paramedicos: string;
  timestamp: number;
  ciudad?: string;
}

export type ReporteEntrada = Omit<ReporteEmergencia, 'id' | 'timestamp'>;

export interface ReporteComprimidoMNv2 {
  i: string;
  o: string;
  x: string;
  n: string;
  e: string;
  g: string;
  u: string;
  lt: number;
  lg: number;
  s: EstadoReporte;
  c: string;
  r: string;
  m: string;
  t: number;
  y?: string;
}

/** Compatibilidad con brigadas que aún transmiten MNv1 */
export interface ReporteComprimidoMNv1 {
  i: string;
  n?: string;
  e?: string;
  g?: string;
  p?: string;
  c?: string;
  u?: string;
  s: EstadoReporte;
  o?: string;
  t: number;
  la?: number;
  lo?: number;
}

export type ReporteComprimidoLegacy = ReporteComprimidoMNv1 | ReporteComprimidoMNv2;
