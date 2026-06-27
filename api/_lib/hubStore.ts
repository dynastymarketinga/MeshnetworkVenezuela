import { kv } from '@vercel/kv';
import {
  agregarPorZonas,
  coincideBusqueda,
  reporteEmergenciaSchema,
  type ReporteEmergenciaValidado,
  type ZonaAgregada,
} from './validateReporte';

const HUB_KEY = 'mesh:hub:reportes';

export interface ResultadoRegistroHub {
  importados: number;
  actualizados: number;
  ignorados: number;
}

function assertKvConfigurado(): void {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('KV_NO_CONFIGURADO');
  }
}

function ordenar(reportes: ReporteEmergenciaValidado[]): ReporteEmergenciaValidado[] {
  return [...reportes].sort((a, b) => {
    const prioridad = (s: string) =>
      s === 'CRITICO' ? 0 : s === 'POR LOCALIZAR' ? 1 : s === 'LOCALIZADO' ? 2 : 3;
    const pa = prioridad(a.estado_actual);
    const pb = prioridad(b.estado_actual);
    if (pa !== pb) return pa - pb;
    return b.timestamp - a.timestamp;
  });
}

export async function consultarTodos(): Promise<ReporteEmergenciaValidado[]> {
  assertKvConfigurado();
  const datos = await kv.get<Record<string, ReporteEmergenciaValidado>>(HUB_KEY);
  if (!datos) return [];
  return ordenar(Object.values(datos));
}

export async function buscarPersona(
  query: string,
  incluirFoto: boolean
): Promise<ReporteEmergenciaValidado[]> {
  const todos = await consultarTodos();
  const coincidencias = todos.filter((r) => coincideBusqueda(r, query));
  if (incluirFoto) return coincidencias;
  return coincidencias.map((r) => ({ ...r, foto_estructura_b64: '' }));
}

export async function consultarZonas(): Promise<ZonaAgregada[]> {
  const todos = await consultarTodos();
  return agregarPorZonas(todos);
}

export async function registrar(
  entradas: ReporteEmergenciaValidado[]
): Promise<ResultadoRegistroHub> {
  assertKvConfigurado();
  const actual =
    (await kv.get<Record<string, ReporteEmergenciaValidado>>(HUB_KEY)) ?? {};
  const resultado: ResultadoRegistroHub = {
    importados: 0,
    actualizados: 0,
    ignorados: 0,
  };

  for (const raw of entradas) {
    const parseado = reporteEmergenciaSchema.safeParse(raw);
    if (!parseado.success) {
      resultado.ignorados += 1;
      continue;
    }
    const reporte = parseado.data;
    const existente = actual[reporte.id];
    if (!existente) {
      actual[reporte.id] = reporte;
      resultado.importados += 1;
      continue;
    }
    if (reporte.timestamp > existente.timestamp) {
      actual[reporte.id] = reporte;
      resultado.actualizados += 1;
    } else {
      resultado.ignorados += 1;
    }
  }

  await kv.set(HUB_KEY, actual);
  return resultado;
}
