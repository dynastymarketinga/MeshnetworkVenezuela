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
});

export const registrarBodySchema = z.union([
  reporteEmergenciaSchema,
  z.object({ reportes: z.array(reporteEmergenciaSchema).min(1) }),
]);

export type ReporteEmergenciaValidado = z.infer<typeof reporteEmergenciaSchema>;
