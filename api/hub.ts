import type { VercelRequest, VercelResponse } from '@vercel/node';
import { aplicarCors, responderError, responderJson } from './_lib/cors';
import { buscarPersona, consultarTodos, consultarZonas, registrar } from './_lib/hubStore';
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

function queryParam(req: VercelRequest, key: string): string | undefined {
  const val = req.query[key];
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  aplicarCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const action = queryParam(req, 'action');

  if (!action) {
    responderError(
      res,
      400,
      'ACCION_REQUERIDA',
      'Use ?action=consultar|registrar|buscar|zonas'
    );
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
        version: '1.2',
        protocolo: 'MNv2.1',
        total: reportes.length,
        reportes,
      });
      return;
    }

    if (action === 'buscar') {
      if (req.method !== 'GET') {
        responderError(res, 405, 'METODO_NO_PERMITIDO', 'buscar requiere GET');
        return;
      }
      const query = queryParam(req, 'query')?.trim() ?? '';
      if (!query) {
        responderError(res, 400, 'QUERY_REQUERIDA', 'Use ?action=buscar&query=NombrePersona');
        return;
      }
      const incluirFoto = queryParam(req, 'incluir_foto') === '1';
      const coincidencias = await buscarPersona(query, incluirFoto);
      responderJson(res, 200, {
        version: '1.2',
        protocolo: 'MNv2.1',
        query,
        total: coincidencias.length,
        coincidencias,
      });
      return;
    }

    if (action === 'zonas') {
      if (req.method !== 'GET') {
        responderError(res, 405, 'METODO_NO_PERMITIDO', 'zonas requiere GET');
        return;
      }
      const zonas = await consultarZonas();
      responderJson(res, 200, {
        version: '1.2',
        protocolo: 'MNv2.1',
        total: zonas.length,
        zonas,
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
        version: '1.2',
        protocolo: 'MNv2.1',
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
