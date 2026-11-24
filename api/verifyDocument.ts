import {
  handleVerifyDocumentRequest,
  type VerifyDocumentEnv,
} from '../src/utils/documentVerificationServer.js';

interface ApiRequest {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => ApiResponse;
  json: (payload: unknown) => ApiResponse;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<unknown> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === 'string') {
      headers.set(key, value);
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      headers.set(key, value[0]);
    }
  }

  const targetUrl = new URL(req.url || '/api/verifyDocument', 'https://viridiannexus.local');
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (!targetUrl.searchParams.has(k)) {
        const val = Array.isArray(v) ? v[0] : v;
        if (typeof val === 'string') {
          targetUrl.searchParams.set(k, val);
        }
      }
    }
  }

  const method = req.method || 'GET';
  const rawBody =
    typeof req.body === 'string'
      ? req.body
      : req.body && typeof req.body === 'object'
        ? JSON.stringify(req.body)
        : '';

  const webRequest = new Request(targetUrl.toString(), {
    method,
    headers,
    ...(method !== 'GET' && method !== 'HEAD' ? { body: rawBody } : {}),
  });

  const webResponse = await handleVerifyDocumentRequest(
    webRequest,
    process.env as unknown as VerifyDocumentEnv
  );
  res.setHeader('Cache-Control', 'no-store');
  const payload = (await webResponse.json().catch(() => ({}))) as unknown;
  return res.status(webResponse.status).json(payload);
}
