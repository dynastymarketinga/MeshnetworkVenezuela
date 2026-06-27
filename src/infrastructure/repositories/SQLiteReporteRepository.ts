import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EstadoReporte,
  ReporteComprimido,
  ReporteEmergencia,
  ReporteEntrada,
} from '../../domain/entities/Reporte';
import {
  IReporteRepository,
  ResultadoImportacion,
} from '../../domain/repositories/IReporteRepository';
import {
  parsearEntradaSms,
  partirCadenaEnLotes,
} from '../../domain/services/SmsParticionService';
import { obtenerBaseDeDatos } from '../database/SQLiteDatabase';

const LEGACY_STORAGE_KEY = '@meshnetwork_venezuela_reportes_v1';

const ESTADOS_VALIDOS: EstadoReporte[] = ['CRITICO', 'POR LOCALIZAR', 'LOCALIZADO'];

interface ReporteRow {
  id: string;
  nombre: string;
  edad: string;
  genero: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  notas: string;
  timestamp: number;
}

type Listener = (reportes: ReporteEmergencia[]) => void;

export class SQLiteReporteRepository implements IReporteRepository {
  private db: SQLite.SQLiteDatabase | null = null;
  private cache: ReporteEmergencia[] = [];
  private readonly listeners = new Set<Listener>();
  private inicializado = false;

  public suscribir(callback: Listener): () => void {
    this.listeners.add(callback);
    if (this.inicializado) callback(this.cache);
    return () => this.listeners.delete(callback);
  }

  private notificar(): void {
    this.listeners.forEach((cb) => cb(this.cache));
  }

  private generarId(): string {
    const sufijo = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SOS-${Date.now()}-${sufijo}`;
  }

  private filaARreporte(row: ReporteRow): ReporteEmergencia {
    const reporte: ReporteEmergencia = {
      id: row.id,
      nombre_completo: row.nombre,
      edad: row.edad,
      genero: row.genero,
      ubicacion_exacta: row.ubicacion,
      estado_actual: row.estado as EstadoReporte,
      notas_paramedicos: row.notas,
      timestamp: row.timestamp,
    };
    if (row.latitud !== null) reporte.latitud = row.latitud;
    if (row.longitud !== null) reporte.longitud = row.longitud;
    return reporte;
  }

  private comprimir(reporte: ReporteEmergencia): ReporteComprimido {
    const base: ReporteComprimido = {
      i: reporte.id,
      n: reporte.nombre_completo,
      e: reporte.edad,
      g: reporte.genero,
      u: reporte.ubicacion_exacta,
      s: reporte.estado_actual,
      o: reporte.notas_paramedicos,
      t: reporte.timestamp,
    };
    if (reporte.latitud !== undefined) {
      base.la = Math.round(reporte.latitud * 100000) / 100000;
    }
    if (reporte.longitud !== undefined) {
      base.lo = Math.round(reporte.longitud * 100000) / 100000;
    }
    return base;
  }

  private expandir(item: ReporteComprimido): ReporteEmergencia {
    const reporte: ReporteEmergencia = {
      id: item.i,
      nombre_completo: item.n ?? 'Anónimo',
      edad: String(item.e ?? '0'),
      genero: item.g ?? 'M',
      ubicacion_exacta: item.u ?? '',
      estado_actual: item.s,
      notas_paramedicos: item.o ?? '',
      timestamp: item.t,
    };
    if (typeof item.la === 'number') reporte.latitud = item.la;
    if (typeof item.lo === 'number') reporte.longitud = item.lo;
    return reporte;
  }

  private esEstadoValido(valor: string): valor is EstadoReporte {
    return ESTADOS_VALIDOS.includes(valor as EstadoReporte);
  }

  private esComprimidoValido(item: unknown): item is ReporteComprimido {
    if (!item || typeof item !== 'object') return false;
    const r = item as ReporteComprimido;
    return (
      typeof r.i === 'string' &&
      r.i.length > 0 &&
      typeof r.t === 'number' &&
      this.esEstadoValido(r.s)
    );
  }

  private async recargarCache(): Promise<void> {
    if (!this.db) return;
    const filas = await this.db.getAllAsync<ReporteRow>(`
      SELECT id, nombre, edad, genero, ubicacion, latitud, longitud, estado, notas, timestamp
      FROM reportes
      ORDER BY
        CASE estado
          WHEN 'CRITICO' THEN 0
          WHEN 'POR LOCALIZAR' THEN 1
          WHEN 'LOCALIZADO' THEN 2
          ELSE 3
        END,
        timestamp DESC
    `);
    this.cache = filas.map((f) => this.filaARreporte(f));
  }

  private async insertarReporte(reporte: ReporteEmergencia): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.');
    await this.db.runAsync(
      `INSERT INTO reportes (id, nombre, edad, genero, ubicacion, latitud, longitud, estado, notas, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reporte.id,
      reporte.nombre_completo,
      reporte.edad,
      reporte.genero,
      reporte.ubicacion_exacta,
      reporte.latitud ?? null,
      reporte.longitud ?? null,
      reporte.estado_actual,
      reporte.notas_paramedicos,
      reporte.timestamp
    );
  }

  private async insertarIgnorandoDuplicados(reporte: ReporteEmergencia): Promise<boolean> {
    if (!this.db) throw new Error('Base de datos no inicializada.');
    const resultado = await this.db.runAsync(
      `INSERT OR IGNORE INTO reportes (id, nombre, edad, genero, ubicacion, latitud, longitud, estado, notas, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reporte.id,
      reporte.nombre_completo,
      reporte.edad,
      reporte.genero,
      reporte.ubicacion_exacta,
      reporte.latitud ?? null,
      reporte.longitud ?? null,
      reporte.estado_actual,
      reporte.notas_paramedicos,
      reporte.timestamp
    );
    return (resultado.changes ?? 0) > 0;
  }

  private async migrarDesdeAsyncStorage(): Promise<void> {
    if (!this.db) return;
    const conteo = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM reportes'
    );
    if (conteo && conteo.total > 0) return;

    try {
      const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      for (const item of parsed) {
        const r = item as ReporteEmergencia;
        if (r?.id && r.estado_actual && typeof r.timestamp === 'number') {
          await this.insertarIgnorandoDuplicados(r);
        }
      }
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* migración best-effort */
    }
  }

  public async inicializar(): Promise<void> {
    this.db = await obtenerBaseDeDatos();
    await this.migrarDesdeAsyncStorage();
    await this.recargarCache();
    this.inicializado = true;
    this.notificar();
  }

  public async guardar(entrada: ReporteEntrada): Promise<ReporteEmergencia> {
    const nuevo: ReporteEmergencia = {
      ...entrada,
      id: this.generarId(),
      timestamp: Date.now(),
    };
    await this.insertarReporte(nuevo);
    await this.recargarCache();
    this.notificar();
    return nuevo;
  }

  public obtenerTodos(): ReporteEmergencia[] {
    return this.cache;
  }

  public comprimirParaSMS(): string {
    return JSON.stringify(this.cache.map((r) => this.comprimir(r)));
  }

  public comprimirParaSMSEnLotes(): string[] {
    return partirCadenaEnLotes(this.comprimirParaSMS());
  }

  public async importarYFusionarCadena(cadenaComprimida: string): Promise<ResultadoImportacion> {
    return this.importarYFusionarSMS(cadenaComprimida);
  }

  public async importarYFusionarSMS(cadena: string): Promise<ResultadoImportacion> {
    const trimmed = cadena.trim();
    if (!trimmed) throw new Error('La cadena SMS está vacía.');

    let parsed: unknown[];
    try {
      parsed = parsearEntradaSms(trimmed);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Formato inválido.';
      throw new Error(mensaje);
    }

    const resultado: ResultadoImportacion = {
      importados: 0,
      actualizados: 0,
      ignorados: 0,
    };

    if (!this.db) throw new Error('Base de datos no inicializada.');

    await this.db.withTransactionAsync(async () => {
      for (const item of parsed) {
        if (!this.esComprimidoValido(item)) {
          resultado.ignorados += 1;
          continue;
        }
        const reporte = this.expandir(item);
        if (!reporte.ubicacion_exacta.trim() && reporte.latitud === undefined) {
          resultado.ignorados += 1;
          continue;
        }
        const insertado = await this.insertarIgnorandoDuplicados(reporte);
        if (insertado) resultado.importados += 1;
        else resultado.ignorados += 1;
      }
    });

    await this.recargarCache();
    this.notificar();
    return resultado;
  }
}
