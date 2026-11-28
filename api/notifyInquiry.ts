import {
  handleNotifyInquiryRequest,
  type NotifyInquiryEnv,
} from '../src/utils/inquiryWhatsAppServer.js';
import { getProcessEnv } from '../src/utils/serverEnv.js';

interface ApiRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
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

  const method = req.method || 'GET';
  const rawBody =
    typeof req.body === 'string'
      ? req.body
      : req.body && typeof req.body === 'object'
        ? JSON.stringify(req.body)
        : '';

  const webRequest = new Request('https://viridiannexus.local/api/notifyInquiry', {
    method,
    headers,
    ...(method !== 'GET' && method !== 'HEAD' ? { body: rawBody } : {}),
  });

  const webResponse = await handleNotifyInquiryRequest(
    webRequest,
    getProcessEnv() as unknown as NotifyInquiryEnv
  );
  const payload = (await webResponse.json().catch(() => ({}))) as unknown;
  return res.status(webResponse.status).json(payload);
}
