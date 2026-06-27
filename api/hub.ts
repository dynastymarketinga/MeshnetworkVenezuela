import type { VercelRequest, VercelResponse } from '@vercel/node';
import { aplicarCors, responderError, responderJson } from './_lib/cors';
import { consultarTodos, registrar } from './_lib/hubStore';
import { registrarBodySchema, type ReporteEmergenciaValidado } from './_lib/validateReporte';

function validarApiKey(req: VercelRequest): boolean {
  const requerida = process.env.HUB_API_KEY;
  if (!requerida) return true;
  const enviada = req.headers['x-hub-api-key'];
  return typeof enviada === 'string' && enviada === requerida;
}

function extraerReportes(body: unknown): ReporteEmergenciaValidado[] {
  const parsed = registrarBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('BODY_INVALIDO');
  }
  if ('reportes' in parsed.data) {
    return parsed.data.reportes;
  }
  return [parsed.data];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  aplicarCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const action =
    typeof req.query.action === 'string'
      ? req.query.action
      : Array.isArray(req.query.action)
        ? req.query.action[0]
        : undefined;

  if (!action) {
    responderError(res, 400, 'ACCION_REQUERIDA', 'Use ?action=consultar o ?action=registrar');
    return;
  }

  try {
    if (action === 'consultar') {
      if (req.method !== 'GET') {
        responderError(res, 405, 'METODO_NO_PERMITIDO', 'consultar requiere GET');
        return;
      }
      const reportes = await consultarTodos();
      responderJson(res, 200, {
        version: '1.0',
        protocolo: 'MNv2',
        total: reportes.length,
        reportes,
      });
      return;
    }

    if (action === 'registrar') {
      if (req.method !== 'POST') {
        responderError(res, 405, 'METODO_NO_PERMITIDO', 'registrar requiere POST');
        return;
      }
      if (!validarApiKey(req)) {
        responderError(res, 401, 'API_KEY_INVALIDA', 'Header X-Hub-Api-Key inválido o ausente');
        return;
      }
      const reportes = extraerReportes(req.body);
      const resultado = await registrar(reportes);
      responderJson(res, 200, {
        version: '1.0',
        protocolo: 'MNv2',
        ...resultado,
        total: resultado.importados + resultado.actualizados + resultado.ignorados,
      });
      return;
    }

    responderError(res, 400, 'ACCION_DESCONOCIDA', `Acción no soportada: ${action}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'KV_NO_CONFIGURADO') {
      responderError(
        res,
        503,
        'KV_NO_CONFIGURADO',
        'Vercel KV no está configurado. Active KV en el proyecto y vincule KV_REST_API_URL y KV_REST_API_TOKEN.'
      );
      return;
    }
    if (error instanceof Error && error.message === 'BODY_INVALIDO') {
      responderError(res, 400, 'BODY_INVALIDO', 'Cuerpo JSON no coincide con ReporteEmergencia');
      return;
    }
    responderError(res, 500, 'ERROR_INTERNO', 'Error interno del Hub');
  }
}
