/**
 * Client-safe image upload helpers (browser File API).
 */

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      const base64 = base64String.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // iOS Safari often reports empty file.type for HEIC. Accept by extension as fallback.
  const typeOk = file.type ? ALLOWED_MIMES.includes(file.type.toLowerCase()) : false;
  const extOk = ALLOWED_EXT.test(file.name);

  if (!typeOk && !extOk) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.",
    };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: "File size exceeds 20MB limit. Please upload a smaller image.",
    };
  }

  return { valid: true };
}
