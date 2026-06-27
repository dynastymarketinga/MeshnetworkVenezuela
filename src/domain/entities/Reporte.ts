export type EstadoReporte = 'POR LOCALIZAR' | 'LOCALIZADO' | 'CRITICO';

export interface ReporteEmergencia {
  id: string;
  nombre_completo: string;
  edad: string;
  genero: string;
  ubicacion_exacta: string;
  estado_actual: EstadoReporte;
  notas_paramedicos: string;
  timestamp: number;
}

export type ReporteEntrada = Omit<ReporteEmergencia, 'id' | 'timestamp'>;
