/**
 * Central utility for Cloudinary media deletion
 */

/**
 * Deletes a media file from Cloudinary via our secure backend function.
 * @param {string} url - The Cloudinary secure URL to delete
 * @returns {Promise<boolean>} True if successful or skipped, false on error
 */
export const deleteCloudinaryMedia = async (url) => {
  if (!url || !url.includes('cloudinary.com')) return true;
  
  try {
    const res = await fetch('/api/deleteMedia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!res.ok) {
      console.warn("Media deletion skipped. Note: /api/deleteMedia requires Wrangler for local testing or a deployed Cloudflare environment.");
      return false; 
    }
    
    return true;
  } catch (err) {
    console.error("Deletion API error:", err);
    return false;
  }
};

/**
 * Fallback deletion using navigator.sendBeacon, 
 * useful for cleaning up when a component unmounts or page unloads.
 * Converts JSON to a Blob because sendBeacon expects specific types.
 */
export const deleteCloudinaryMediaBeacon = (url) => {
  if (!url || !url.includes('cloudinary.com') || !navigator.sendBeacon) return;
  
  try {
    const blob = new Blob([JSON.stringify({ url })], { type: 'application/json' });
    navigator.sendBeacon('/api/deleteMedia', blob);
  } catch (err) {
    console.error("Beacon deletion error:", err);
  }
};
