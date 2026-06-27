export type EstadoReporte = 'POR LOCALIZAR' | 'LOCALIZADO' | 'CRITICO';

export interface ReporteEmergencia {
  id: string;
  nombre_completo: string;
  edad: string;
  genero: string;
  telefono_contacto: string;
  ciudad: string;
  ubicacion_exacta: string;
  latitud?: number;
  longitud?: number;
  estado_actual: EstadoReporte;
  notas_paramedicos: string;
  timestamp: number;
}

export type ReporteEntrada = Omit<ReporteEmergencia, 'id' | 'timestamp'>;

export interface ReporteComprimido {
  i: string;
  n: string;
  e: string;
  g: string;
  p?: string;
  c?: string;
  u: string;
  s: EstadoReporte;
  o: string;
  t: number;
  la?: number;
  lo?: number;
}
