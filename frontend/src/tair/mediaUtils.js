// طير — Client-side media helpers: image compression + video duration guard
// Uses canvas (no external deps) to keep bundle small.

/**
 * Compress an image file client-side.
 * - Downscales to at most `maxDim` on the longest side.
 * - Encodes as JPEG at `quality` (0-1).
 * - Falls back to the original file if the browser can't decode.
 *
 * @param {File} file
 * @param {{ maxDim?: number, quality?: number }} [opts]
 * @returns {Promise<File>}
 */
export async function compressImage(file, opts = {}) {
  const maxDim = opts.maxDim || 1600;
  const quality = opts.quality ?? 0.82;

  if (!file || !file.type.startsWith("image/")) return file;
  // Skip tiny files — not worth compressing
  if (file.size < 200 * 1024) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    let w = width, h = height;
    if (Math.max(w, h) > maxDim) {
      if (w >= h) { h = Math.round((h * maxDim) / w); w = maxDim; }
      else { w = Math.round((w * maxDim) / h); h = maxDim; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    // Only keep the compressed one if it's actually smaller
    if (blob.size >= file.size) return file;
    const outName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
  } catch (e) {
    console.warn("compressImage failed, using original:", e);
    return file;
  }
}

function loadBitmap(file) {
  if (window.createImageBitmap) {
    return window.createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/**
 * Read the duration of a video file (in seconds) using an offscreen <video> element.
 * @param {File} file
 * @returns {Promise<number>} duration in seconds (0 on failure)
 */
export function getVideoDuration(file) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith("video/")) return resolve(0);
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    const cleanup = () => { URL.revokeObjectURL(url); };
    v.onloadedmetadata = () => {
      const d = v.duration;
      cleanup();
      resolve(Number.isFinite(d) ? d : 0);
    };
    v.onerror = () => { cleanup(); resolve(0); };
  });
}
