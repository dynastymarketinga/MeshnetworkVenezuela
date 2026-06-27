import { ReporteEmergencia, ReporteEntrada } from '../entities/Reporte';

export interface IReporteRepository {
  guardar(reporte: ReporteEntrada): ReporteEmergencia;
  obtenerTodos(): ReporteEmergencia[];
  comprimirParaSMS(): string;
}
