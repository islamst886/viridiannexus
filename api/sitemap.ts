import {
  handleSitemapRequest,
  type SitemapEnv,
} from '../src/utils/sitemapServer.js';
import { getProcessEnv } from '../src/utils/serverEnv.js';

interface ApiRequest {
  method?: string;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => ApiResponse;
  send: (body: string) => unknown;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<unknown> {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Method Not Allowed');
  }

  const result = await handleSitemapRequest(getProcessEnv() as unknown as SitemapEnv);
  res.status(result.status);
  for (const [name, value] of Object.entries(result.headers)) {
    res.setHeader(name, value);
  }
  return res.send(req.method === 'HEAD' ? '' : result.body);
}
