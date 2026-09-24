# Viridian Nexus

Viridian Nexus is a premium, luxury real estate web application built with React, Vite, Tailwind CSS, and Firebase.

## 🚀 Complete Project Setup Guide

If you are setting up this project from scratch for a new client or on a new set of accounts, follow these step-by-step instructions to configure all required external services.

### 1. Firebase Configuration (Database, Auth & Storage)
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. **Enable Authentication**: Go to Build -> Authentication. Enable the **Email/Password** sign-in provider.
3. **Enable Firestore Database**: Go to Build -> Firestore Database. Create a database in production mode.
   - **CRITICAL SECURITY STEP**: By default, Firebase will set your rules to "Test Mode" which leaves your database completely open to hackers. You MUST open the `firestore.rules` file located in the root of this project, copy all of the code inside it, and paste it into the **Rules** tab of your Firestore Database in the Firebase Console. Hit **Publish**.
4. **Enable Firebase Storage**: Go to Build -> Storage. *(Note: We use this specifically for uploading large PDF project brochures because Cloudinary restricts PDF delivery on their free tier).*
5. **Get Project Settings**: Go to Project Settings (gear icon) -> General. Scroll down to "Your apps" and create a new Web App (</>). Copy the `firebaseConfig` object values into your local `.env` file (refer to `.env.example`).

### 2. Google Cloud Console (API & Browser Key Security)
To secure your Firebase API keys and prevent unauthorized use from other websites:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your newly created Firebase project from the top dropdown.
3. Go to **APIs & Services** -> **Credentials**.
4. Find the **Browser key (auto created by Firebase)**.
5. Click edit (pencil icon) and under "Application restrictions", select **HTTP referrers (web sites)**.
6. Add your authorized domains (e.g., `https://your-cloudflare-pages.pages.dev/*` and `http://localhost:*` for local testing).
7. Click **Save**. This ensures your `VITE_FIREBASE_API_KEY` can only be used by your actual website.

### 3. Cloudinary Setup (Image Hosting)
Cloudinary is used for highly optimized, fast image delivery (Project Hero images, Maps, Galleries).
1. Create a free account at [Cloudinary](https://cloudinary.com/).
2. From the Dashboard, copy your **Cloud Name**, **API Key**, and **API Secret** to your `.env` file.
3. **Create an Upload Preset**:
   - Go to Settings (gear icon) -> **Upload** -> Scroll down to **Upload presets**.
   - Click **Add upload preset**.
   - Name it (and copy this exact name to `VITE_CLOUDINARY_UPLOAD_PRESET` in your `.env`).
   - Set **Signing Mode** to **Unsigned**.
   - Save the preset. *(This crucial step allows your frontend React admin panel to upload images directly to Cloudinary without needing a separate backend server).*

### 4. Cloudflare Pages Deployment
1. Push all your code to your GitHub repository.
2. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages**.
3. Click **Create** -> **Pages** -> **Connect to Git**.
4. Select your connected GitHub repository.
5. Configure the Build settings:
   - **Framework preset**: `Vite` (or None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. **Environment Variables**: Expand the "Environment variables (advanced)" section. You must paste **all** the variables from your local `.env` file here (Firebase and Cloudinary keys), otherwise the production build will fail to connect to your services.
7. Click **Save and Deploy**.

---

## 🛠 Cloudflare Deployment Tricks

If Cloudflare Pages ever gets stuck or fails to automatically deploy after you have pushed your latest code to GitHub, you can force a brand new deployment without changing any of your actual code files.

Run the following command in your terminal:

```bash
git commit --allow-empty -m "chore: force cloudflare deployment"
git push
```

**Why this works:**
- `--allow-empty`: Tells Git to create a new commit even if zero files were changed.
- `git push`: Sends this "empty" commit to GitHub.
- When GitHub receives the push, it triggers the Cloudflare webhook, forcing Cloudflare to pull the latest code and deploy it instantly.