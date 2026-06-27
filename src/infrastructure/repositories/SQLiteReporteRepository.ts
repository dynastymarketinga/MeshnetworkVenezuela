import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ESTADOS_ESTRUCTURA,
  ESTADOS_REPORTE,
  EstadoEstructura,
  EstadoReporte,
  ReporteComprimidoLegacy,
  ReporteComprimidoMNv1,
  ReporteComprimidoMNv2,
  ReporteEmergencia,
  ReporteEntrada,
  TIPOS_REGISTRO,
  TipoRegistro,
} from '../../domain/entities/Reporte';
import {
  IReporteRepository,
  ResultadoImportacion,
} from '../../domain/repositories/IReporteRepository';
import {
  parsearEntradaSms,
  partirCadenaEnLotes,
} from '../../domain/services/SmsParticionService';
import { OperacionConfig } from '../../config/OperacionConfig';
import { obtenerBaseDeDatos } from '../database/SQLiteDatabase';

const LEGACY_STORAGE_KEY = '@meshnetwork_venezuela_reportes_v1';

interface ReporteRow {
  id: string;
  fuente_origen: string;
  tipo_registro: string;
  nombre: string;
  edad: string;
  genero: string;
  telefono: string;
  ciudad: string;
  ubicacion: string;
  latitud: number;
  longitud: number;
  estado: string;
  estado_estructura: string;
  notas: string;
  timestamp: number;
}

type Listener = (reportes: ReporteEmergencia[]) => void;

type ModoInsercion = 'ignore' | 'replace_si_mas_reciente';

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

  private esEstadoValido(valor: string): valor is EstadoReporte {
    return (ESTADOS_REPORTE as readonly string[]).includes(valor);
  }

  private esTipoValido(valor: string): valor is TipoRegistro {
    return (TIPOS_REGISTRO as readonly string[]).includes(valor);
  }

  private esEstructuraValida(valor: string): valor is EstadoEstructura {
    return (ESTADOS_ESTRUCTURA as readonly string[]).includes(valor);
  }

  private filaAReporte(row: ReporteRow): ReporteEmergencia {
    return {
      id: row.id,
      fuente_origen: row.fuente_origen,
      tipo_registro: this.esTipoValido(row.tipo_registro)
        ? row.tipo_registro
        : 'PERSONA_ATRAPADA',
      nombre_completo: row.nombre,
      edad: row.edad,
      genero: row.genero,
      telefono_contacto: row.telefono ?? '',
      ciudad: row.ciudad ?? 'La Guaira',
      ubicacion_exacta: row.ubicacion,
      latitud: row.latitud,
      longitud: row.longitud,
      estado_actual: this.esEstadoValido(row.estado) ? row.estado : 'POR LOCALIZAR',
      estado_estructura: this.esEstructuraValida(row.estado_estructura)
        ? row.estado_estructura
        : 'SEGURO',
      notas_paramedicos: row.notas,
      timestamp: row.timestamp,
    };
  }

  private comprimir(reporte: ReporteEmergencia): ReporteComprimidoMNv2 {
    const base: ReporteComprimidoMNv2 = {
      i: reporte.id,
      o: reporte.fuente_origen,
      x: reporte.tipo_registro,
      n: reporte.nombre_completo,
      e: reporte.edad,
      g: reporte.genero,
      u: reporte.ubicacion_exacta,
      lt: Math.round(reporte.latitud * 100000) / 100000,
      lg: Math.round(reporte.longitud * 100000) / 100000,
      s: reporte.estado_actual,
      c: reporte.telefono_contacto,
      r: reporte.estado_estructura,
      m: reporte.notas_paramedicos,
      t: reporte.timestamp,
    };
    if (reporte.ciudad?.trim()) {
      base.y = reporte.ciudad.trim();
    }
    return base;
  }

  private esMNv2(item: ReporteComprimidoLegacy): item is ReporteComprimidoMNv2 {
    return typeof (item as ReporteComprimidoMNv2).lt === 'number';
  }

  private expandir(item: ReporteComprimidoLegacy): ReporteEmergencia {
    if (this.esMNv2(item)) {
      return {
        id: item.i,
        fuente_origen: item.o || OperacionConfig.FUENTE_ORIGEN,
        tipo_registro: this.esTipoValido(item.x) ? item.x : 'PERSONA_ATRAPADA',
        nombre_completo: item.n ?? 'Anónimo',
        edad: String(item.e ?? '0'),
        genero: item.g ?? 'M',
        telefono_contacto: item.c ?? '',
        ciudad: item.y ?? 'La Guaira',
        ubicacion_exacta: item.u ?? '',
        latitud: item.lt,
        longitud: item.lg,
        estado_actual: item.s,
        estado_estructura: this.esEstructuraValida(item.r) ? item.r : 'SEGURO',
        notas_paramedicos: item.m ?? '',
        timestamp: item.t,
      };
    }

    const legacy = item as ReporteComprimidoMNv1;
    return {
      id: legacy.i,
      fuente_origen: OperacionConfig.FUENTE_ORIGEN,
      tipo_registro: 'PERSONA_ATRAPADA',
      nombre_completo: legacy.n ?? 'Anónimo',
      edad: String(legacy.e ?? '0'),
      genero: legacy.g ?? 'M',
      telefono_contacto: legacy.p ?? '',
      ciudad: legacy.c ?? 'La Guaira',
      ubicacion_exacta: legacy.u ?? '',
      latitud: typeof legacy.la === 'number' ? legacy.la : 0,
      longitud: typeof legacy.lo === 'number' ? legacy.lo : 0,
      estado_actual: legacy.s,
      estado_estructura: 'SEGURO',
      notas_paramedicos: legacy.o ?? '',
      timestamp: legacy.t,
    };
  }

  private esComprimidoValido(item: unknown): item is ReporteComprimidoLegacy {
    if (!item || typeof item !== 'object') return false;
    const r = item as ReporteComprimidoLegacy;
    return typeof r.i === 'string' && r.i.length > 0 && typeof r.t === 'number' && this.esEstadoValido(r.s);
  }

  private valoresInsert(reporte: ReporteEmergencia): (string | number)[] {
    return [
      reporte.id,
      reporte.fuente_origen,
      reporte.tipo_registro,
      reporte.nombre_completo,
      reporte.edad,
      reporte.genero,
      reporte.telefono_contacto,
      reporte.ciudad ?? 'La Guaira',
      reporte.ubicacion_exacta,
      reporte.latitud,
      reporte.longitud,
      reporte.estado_actual,
      reporte.estado_estructura,
      reporte.notas_paramedicos,
      reporte.timestamp,
    ];
  }

  private async recargarCache(): Promise<void> {
    if (!this.db) return;
    const filas = await this.db.getAllAsync<ReporteRow>(`
      SELECT id, fuente_origen, tipo_registro, nombre, edad, genero, telefono, ciudad,
             ubicacion, latitud, longitud, estado, estado_estructura, notas, timestamp
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
    this.cache = filas.map((f) => this.filaAReporte(f));
  }

  private async insertarReporte(
    reporte: ReporteEmergencia,
    modo: ModoInsercion
  ): Promise<'insertado' | 'actualizado' | 'ignorado'> {
    if (!this.db) throw new Error('Base de datos no inicializada.');

    const existente = await this.db.getFirstAsync<{ timestamp: number }>(
      'SELECT timestamp FROM reportes WHERE id = ?',
      reporte.id
    );

    if (modo === 'replace_si_mas_reciente' && existente) {
      if (existente.timestamp >= reporte.timestamp) {
        return 'ignorado';
      }
    }

    const sql =
      modo === 'ignore' && !existente
        ? `INSERT OR IGNORE INTO reportes (
            id, fuente_origen, tipo_registro, nombre, edad, genero, telefono, ciudad,
            ubicacion, latitud, longitud, estado, estado_estructura, notas, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        : `INSERT OR REPLACE INTO reportes (
            id, fuente_origen, tipo_registro, nombre, edad, genero, telefono, ciudad,
            ubicacion, latitud, longitud, estado, estado_estructura, notas, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    if (modo === 'ignore' && existente) {
      return 'ignorado';
    }

    const resultado = await this.db.runAsync(sql, ...this.valoresInsert(reporte));
    if ((resultado.changes ?? 0) === 0) return 'ignorado';
    return existente ? 'actualizado' : 'insertado';
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
        const r = item as Partial<ReporteEmergencia>;
        if (!r?.id || !r.estado_actual || typeof r.timestamp !== 'number') continue;
        await this.insertarReporte(
          {
            id: r.id,
            fuente_origen: r.fuente_origen ?? OperacionConfig.FUENTE_ORIGEN,
            tipo_registro: r.tipo_registro ?? 'PERSONA_ATRAPADA',
            nombre_completo: r.nombre_completo ?? 'Anónimo',
            edad: r.edad ?? '0',
            genero: r.genero ?? 'M',
            telefono_contacto: r.telefono_contacto ?? '',
            ciudad: r.ciudad ?? 'La Guaira',
            ubicacion_exacta: r.ubicacion_exacta ?? '',
            latitud: r.latitud ?? 0,
            longitud: r.longitud ?? 0,
            estado_actual: r.estado_actual,
            estado_estructura: r.estado_estructura ?? 'SEGURO',
            notas_paramedicos: r.notas_paramedicos ?? '',
            timestamp: r.timestamp,
          },
          'ignore'
        );
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
      fuente_origen: entrada.fuente_origen || OperacionConfig.FUENTE_ORIGEN,
      id: this.generarId(),
      timestamp: Date.now(),
    };
    await this.insertarReporte(nuevo, 'ignore');
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
        if (!reporte.ubicacion_exacta.trim() && reporte.latitud === 0 && reporte.longitud === 0) {
          resultado.ignorados += 1;
          continue;
        }
        const estado = await this.insertarReporte(reporte, 'replace_si_mas_reciente');
        if (estado === 'insertado') resultado.importados += 1;
        else if (estado === 'actualizado') resultado.actualizados += 1;
        else resultado.ignorados += 1;
      }
    });

    await this.recargarCache();
    this.notificar();
    return resultado;
  }
}
