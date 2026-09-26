import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server missing Supabase credentials' });
  }

  if (!url.includes(supabaseUrl)) {
    return res.status(400).json({ error: 'Not a valid Supabase storage URL' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/object/public/');
    if (pathParts.length < 2) return res.status(400).json({ error: 'Could not parse Supabase storage URL' });

    const [bucket, ...fileParts] = pathParts[1].split('/');
    const filePath = decodeURIComponent(fileParts.join('/'));

    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ result: 'ok' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
