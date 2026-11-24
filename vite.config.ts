import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import {
  handleVerifyDocumentRequest,
  type VerifyDocumentEnv,
} from './src/utils/documentVerificationServer.js';

function readNodeRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

function localVerifyDocumentApiPlugin(env: VerifyDocumentEnv): Plugin {
  return {
    name: 'local-verify-document-api',
    configureServer(server) {
      server.middlewares.use(
        '/api/verifyDocument',
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const method = req.method || 'GET';
          if (method !== 'GET' && method !== 'POST') {
            next();
            return;
          }

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value) && typeof value[0] === 'string') headers.set(key, value[0]);
          }

          const body = method === 'POST' ? await readNodeRequestBody(req) : '';
          const requestUrl = `http://localhost${req.url || '/'}`;
          const webReq = new Request(requestUrl, {
            method,
            headers,
            ...(method === 'POST' ? { body } : {}),
          });

          const webRes = await handleVerifyDocumentRequest(webReq, env);
          res.statusCode = webRes.status;
          webRes.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });
          res.end(await webRes.text());
        }
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') as VerifyDocumentEnv;
  return {
    plugins: [react(), localVerifyDocumentApiPlugin(env)],
  };
});
