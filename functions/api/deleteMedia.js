export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { url } = body;
    
    if (!url || !url.includes('cloudinary.com')) {
      return new Response(JSON.stringify({ error: "Valid Cloudinary URL required" }), { status: 400 });
    }

    // Determine resource type based on URL (image, video, raw)
    let resourceType = 'image';
    if (url.includes('/video/upload/')) {
      resourceType = 'video';
    }

    // Extract the public_id from the URL (everything after upload/ or v12345/ and before the extension)
    // Example: https://res.cloudinary.com/demo/image/upload/v1570979139/sample.jpg -> 'sample'
    const regex = /\/upload\/(?:v\d+\/)?([^\.]+)/;
    const match = url.match(regex);
    
    if (!match) {
      return new Response(JSON.stringify({ error: "Could not extract public_id from URL" }), { status: 400 });
    }
    const publicId = decodeURIComponent(match[1]);

    // Get securely stored credentials from Cloudflare Environment Variables and trim to avoid hidden whitespaces
    const rawApiKey = context.env.VITE_CLOUDINARY_API_KEY || context.env.CLOUDINARY_API_KEY;
    const rawApiSecret = context.env.VITE_CLOUDINARY_API_SECRET || context.env.CLOUDINARY_API_SECRET;
    const rawCloudName = context.env.VITE_CLOUDINARY_CLOUD_NAME || context.env.CLOUDINARY_CLOUD_NAME;

    const apiKey = rawApiKey ? rawApiKey.trim() : null;
    const apiSecret = rawApiSecret ? rawApiSecret.trim() : null;
    const cloudName = rawCloudName ? rawCloudName.trim() : null;

    if (!apiKey || !apiSecret || !cloudName) {
      return new Response(JSON.stringify({ error: "Server missing Cloudinary credentials" }), { status: 500 });
    }

    // Cloudinary requires a timestamp and a SHA-1 signature of the parameters
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Sort parameters alphabetically (public_id, timestamp) and append API Secret
    const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    
    // Generate SHA-1 hash using standard Web Crypto API (supported by Cloudflare Workers)
    const buffer = new TextEncoder().encode(strToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;

    // Send the deletion payload
    const formData = new URLSearchParams();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    // Return the response back to the frontend
    return new Response(JSON.stringify(result), { 
      status: response.status,
      headers: {
        "content-type": "application/json;charset=UTF-8",
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
