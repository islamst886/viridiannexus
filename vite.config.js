import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import crypto from 'crypto';

// A Vite plugin to mock our Cloudflare Pages Function during local development (npm run dev)
// so that /api/deleteMedia works without needing Wrangler.
function localCloudflareApiPlugin() {
  return {
    name: 'local-cloudflare-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/deleteMedia' && req.method === 'POST') {
          const env = loadEnv(server.config.mode, process.cwd(), '');
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const { url } = JSON.parse(body);
              if (!url || !url.includes('cloudinary.com')) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: "Valid Cloudinary URL required" }));
              }
              
              let resourceType = 'image';
              if (url.includes('/video/upload/')) resourceType = 'video';
              
              const regex = /\/upload\/(?:v\d+\/)?([^\.]+)/;
              const match = url.match(regex);
              if (!match) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: "Could not extract public_id" }));
              }
              
              const publicId = match[1];
              const apiKey = env.VITE_CLOUDINARY_API_KEY || env.CLOUDINARY_API_KEY;
              const apiSecret = env.VITE_CLOUDINARY_API_SECRET || env.CLOUDINARY_API_SECRET;
              const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME;
              
              if (!apiKey || !apiSecret || !cloudName) {
                res.statusCode = 500;
                return res.end(JSON.stringify({ error: "Server missing Cloudinary API credentials in .env file (VITE_CLOUDINARY_API_KEY, VITE_CLOUDINARY_API_SECRET)" }));
              }
              
              const timestamp = Math.round(new Date().getTime() / 1000);
              const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
              
              const shasum = crypto.createHash('sha1');
              shasum.update(strToSign);
              const signature = shasum.digest('hex');
              
              const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;
              const formData = new URLSearchParams();
              formData.append('public_id', publicId);
              formData.append('timestamp', timestamp.toString());
              formData.append('api_key', apiKey);
              formData.append('signature', signature);
              
              const response = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
              const data = await response.json();
              
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = response.status;
              res.end(JSON.stringify(data));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localCloudflareApiPlugin()],
});
