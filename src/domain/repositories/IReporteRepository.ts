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
  buscarPorPersona(query: string): Promise<ReporteEmergencia[]>;
  obtenerPorZona(zona: string): Promise<ReporteEmergencia[]>;
  obtenerPendientesHubSync(): Promise<ReporteEmergencia[]>;
  marcarSincronizadoHub(ids: string[]): Promise<void>;
  generarPayloadUniversal(): Promise<ReporteEmergencia[]>;
  obtenerFotoPorId(id: string): Promise<string | null>;
  comprimirParaSMS(): string;
  comprimirParaSMSEnLotes(): string[];
  importarYFusionarCadena(cadenaComprimida: string): Promise<ResultadoImportacion>;
  importarYFusionarSMS(cadena: string): Promise<ResultadoImportacion>;
}
