import { z } from 'zod';

export const estadoReporteSchema = z.enum(['POR LOCALIZAR', 'LOCALIZADO', 'CRITICO']);
export const tipoRegistroSchema = z.enum([
  'PERSONA_ATRAPADA',
  'INFRAESTRUCTURA_DANADA',
  'SIN_VIVIENDA',
]);
export const estadoEstructuraSchema = z.enum([
  'COLAPSO_TOTAL',
  'PARCIAL',
  'HABITABLE',
  'SEGURO',
]);

export const reporteEmergenciaSchema = z.object({
  id: z.string().min(1),
  fuente_origen: z.string().min(1).optional().default('MeshApp'),
  tipo_registro: tipoRegistroSchema,
  nombre_completo: z.string().min(1),
  edad: z.string(),
  genero: z.string(),
  ubicacion_exacta: z.string(),
  latitud: z.number(),
  longitud: z.number(),
  estado_actual: estadoReporteSchema,
  telefono_contacto: z.string(),
  estado_estructura: estadoEstructuraSchema,
  notas_paramedicos: z.string(),
  timestamp: z.number().int().positive(),
  ciudad: z.string().optional(),
  censo_personas: z.array(z.string()).optional().default([]),
  tiene_hogar_actual: z.boolean().optional().default(true),
  direccion_origen: z.string().optional().default(''),
  zona_afectada_tag: z.string().optional().default(''),
  foto_estructura_b64: z.string().optional().default(''),
});

export const registrarBodySchema = z.union([
  reporteEmergenciaSchema,
  z.object({ reportes: z.array(reporteEmergenciaSchema).min(1) }),
]);

export type ReporteEmergenciaValidado = z.infer<typeof reporteEmergenciaSchema>;

export interface ZonaAgregada {
  tag: string;
  total: number;
  sin_vivienda: number;
  colapso_total: number;
  criticos: number;
}

function normalizar(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function coincideBusqueda(
  reporte: ReporteEmergenciaValidado,
  query: string
): boolean {
  const q = normalizar(query);
  if (!q) return false;

  const campos = [
    reporte.nombre_completo,
    reporte.notas_paramedicos,
    reporte.direccion_origen,
    reporte.zona_afectada_tag,
    reporte.ciudad ?? '',
    ...(reporte.censo_personas ?? []),
  ];

  return campos.some((c) => normalizar(c).includes(q));
}

export function agregarPorZonas(reportes: ReporteEmergenciaValidado[]): ZonaAgregada[] {
  const mapa = new Map<string, ZonaAgregada>();

  for (const r of reportes) {
    const tag = r.zona_afectada_tag?.trim() || r.ciudad?.trim() || 'Sin zona';
    const actual = mapa.get(tag) ?? {
      tag,
      total: 0,
      sin_vivienda: 0,
      colapso_total: 0,
      criticos: 0,
    };
    actual.total += 1;
    if (!r.tiene_hogar_actual) actual.sin_vivienda += 1;
    if (r.estado_estructura === 'COLAPSO_TOTAL') actual.colapso_total += 1;
    if (r.estado_actual === 'CRITICO') actual.criticos += 1;
    mapa.set(tag, actual);
  }

  return Array.from(mapa.values()).sort((a, b) => b.sin_vivienda - a.sin_vivienda);
}
