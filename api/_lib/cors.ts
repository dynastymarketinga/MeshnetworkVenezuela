import type { VercelResponse } from '@vercel/node';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Api-Key',
};

export function aplicarCors(res: VercelResponse): void {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

export function responderJson(
  res: VercelResponse,
  status: number,
  body: Record<string, unknown>
): void {
  aplicarCors(res);
  res.status(status).json(body);
}

export function responderError(
  res: VercelResponse,
  status: number,
  code: string,
  error: string
): void {
  responderJson(res, status, { error, code });
}
