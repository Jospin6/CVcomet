/** Small, signature-verified bitmap previews. Never store arbitrary uploaded content as images. */
export const MAX_TEMPLATE_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_TEMPLATE_FORM_BYTES = MAX_TEMPLATE_IMAGE_BYTES + 64 * 1024;
export type PreviewMime = "image/png" | "image/jpeg" | "image/webp";

export function detectPreviewMime(bytes: Uint8Array): PreviewMime | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return "image/png";
  if (bytes.length >= 4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes[bytes.length-2]===255 && bytes[bytes.length-1]===217) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8,12)) === "WEBP") return "image/webp";
  return null;
}

export function validTemplatePreview(bytes: Uint8Array, declaredType?: string): PreviewMime | null {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_TEMPLATE_IMAGE_BYTES) return null;
  const mime = detectPreviewMime(bytes);
  if (!mime || (declaredType && declaredType !== mime && declaredType !== "application/octet-stream")) return null;
  return mime;
}
