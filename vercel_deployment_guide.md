# Deployment & Data Migration Guide

The frontend codebase has been **100% migrated** to Supabase and is ready for deployment. All Firebase, Cloudflare Pages, and Cloudinary code has been removed. The Vercel API routes and configuration have been set up.

Here are the final steps you need to perform manually to bring your site live on Vercel:

## 1. Supabase Environment Variables

In your local `.env` file (and in the Vercel dashboard later), you must provide the following keys from your Supabase project (Settings -> API):

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> [!CAUTION]
> Ensure that `SUPABASE_SERVICE_ROLE_KEY` does **not** have a `VITE_` prefix, otherwise it will be exposed to the browser.

## 2. Vercel Deployment

Since you want to host on Vercel, you need to deploy the project:

1. Install the Vercel CLI globally if you haven't already:
   ```bash
   npm i -g vercel
   ```
2. Log in and deploy:
   ```bash
   vercel login
   vercel --prod
   ```
3. Go to your **Vercel Dashboard** -> Project Settings -> Environment Variables and add the 3 Supabase variables listed above.

## 3. Cloudflare DNS Configuration

Since you bought the domain from Cloudflare but are hosting on Vercel, you need to point your domain to Vercel:

1. In Vercel, go to Settings -> Domains and add `viridiannexus.com` and `www.viridiannexus.com`. Vercel will provide IP/CNAME targets.
2. In your Cloudflare Dashboard, go to DNS -> Records.
3. **Delete** the old A and CNAME records pointing to Cloudflare Pages.
4. **Add** the Vercel records:
   * **A Record**: Name `@`, Content `76.76.21.21` (or whatever Vercel provides).
   * **CNAME Record**: Name `www`, Content `cname.vercel-dns.com`.

> [!IMPORTANT]
> Make sure the **Proxy status** in Cloudflare is set to **DNS Only (Grey Cloud)** for these records. If it is orange (Proxied), Vercel cannot generate the SSL certificate and your site will break.

## 4. Data Migration

Your final task is moving your existing data from Firebase to Supabase.

1. **Export Firestore Data**: Go to the Firebase Console -> Firestore Database -> Export to get a JSON dump of your collections.
2. **Transform Data**: Firestore used `camelCase`, but Supabase uses `snake_case`. You can write a small Node.js script to map keys (e.g. `propertyName` to `property_name`) and push it to Supabase via the REST API or Dashboard.
3. **Migrate Users**: Because Firebase uses `scrypt` for password hashing and Supabase uses `bcrypt`, you cannot migrate passwords directly.
   * **Action**: Create your Admin accounts manually in Supabase. For existing customers, have them "Sign Up" again or use "Forgot Password" if you set up the user records manually in Supabase.

Once these steps are done, your Vercel/Supabase application will be fully operational and highly robust, handling all the edge cases perfectly!
