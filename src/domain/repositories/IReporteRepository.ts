import { ReporteEmergencia, ReporteEntrada } from '../entities/Reporte';

export interface ResultadoImportacion {
  importados: number;
  actualizados: number;
  ignorados: number;
}

export interface IReporteRepository {
  inicializar(): Promise<void>;
  guardar(reporte: ReporteEntrada): Promise<ReporteEmergencia>;
  obtenerTodos(): ReporteEmergencia[];
  comprimirParaSMS(): string;
  comprimirParaSMSEnLotes(): string[];
  importarYFusionarCadena(cadenaComprimida: string): Promise<ResultadoImportacion>;
  importarYFusionarSMS(cadena: string): Promise<ResultadoImportacion>;
}
