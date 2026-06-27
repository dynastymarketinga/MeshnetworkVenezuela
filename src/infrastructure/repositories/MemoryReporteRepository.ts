import {
  EstadoReporte,
  ReporteEmergencia,
  ReporteEntrada,
} from '../../domain/entities/Reporte';
import { IReporteRepository } from '../../domain/repositories/IReporteRepository';

interface ReporteComprimido {
  i: string;
  n: string;
  e: string;
  g: string;
  u: string;
  s: EstadoReporte;
  o: string;
  t: number;
}

const PRIORIDAD: Record<EstadoReporte, number> = {
  CRITICO: 0,
  'POR LOCALIZAR': 1,
  LOCALIZADO: 2,
};

type Listener = (reportes: ReporteEmergencia[]) => void;

export class MemoryReporteRepository implements IReporteRepository {
  private readonly reportes = new Map<string, ReporteEmergencia>();
  private readonly listeners = new Set<Listener>();

  public suscribir(callback: Listener): () => void {
    this.listeners.add(callback);
    callback(this.obtenerTodos());
    return () => this.listeners.delete(callback);
  }

  private notificar(): void {
    const lista = this.obtenerTodos();
    this.listeners.forEach((cb) => cb(lista));
  }

  private generarId(prefijo: 'SOS' | 'BLE'): string {
    const sufijo = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefijo}-${Date.now()}-${sufijo}`;
  }

  private comprimir(reporte: ReporteEmergencia): ReporteComprimido {
    return {
      i: reporte.id,
      n: reporte.nombre_completo,
      e: reporte.edad,
      g: reporte.genero,
      u: reporte.ubicacion_exacta,
      s: reporte.estado_actual,
      o: reporte.notas_paramedicos,
      t: reporte.timestamp,
    };
  }

  public guardar(entrada: ReporteEntrada): ReporteEmergencia {
    const nuevo: ReporteEmergencia = {
      ...entrada,
      id: this.generarId('SOS'),
      timestamp: Date.now(),
    };
    this.reportes.set(nuevo.id, nuevo);
    this.notificar();
    return nuevo;
  }

  public fusionar(reporte: ReporteEmergencia): boolean {
    const existente = this.reportes.get(reporte.id);
    if (!existente) {
      this.reportes.set(reporte.id, reporte);
      this.notificar();
      return true;
    }
    if (reporte.timestamp >= existente.timestamp) {
      this.reportes.set(reporte.id, { ...existente, ...reporte });
      this.notificar();
      return true;
    }
    return false;
  }

  public obtenerTodos(): ReporteEmergencia[] {
    return Array.from(this.reportes.values()).sort((a, b) => {
      const pa = PRIORIDAD[a.estado_actual];
      const pb = PRIORIDAD[b.estado_actual];
      if (pa !== pb) return pa - pb;
      return b.timestamp - a.timestamp;
    });
  }

  public comprimirParaSMS(): string {
    return JSON.stringify(this.obtenerTodos().map((r) => this.comprimir(r)));
  }

  public crearIdMalla(): string {
    return this.generarId('BLE');
  }
}
