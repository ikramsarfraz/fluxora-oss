const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

export type FileValidationOk = {
  ok: true;
  safeName: string;
  originalName: string;
};
export type FileValidationFail = { ok: false; error: string };
export type FileValidationResult = FileValidationOk | FileValidationFail;

/**
 * Strip path separators, control chars, null bytes; NFC-normalize Unicode;
 * collapse runs of dots (prevents `../`); truncate to 255 chars. Returns
 * empty string when nothing usable remains — caller must reject.
 */
export function sanitizeFilename(name: string): string {
  return name
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[/\\]/g, "")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 255);
}

/**
 * Server-side validation for PDF uploads. Never trust the client `Content-Type`
 * header — sniff the magic bytes instead. Reject anything larger than 10 MB,
 * not starting with `%PDF-`, or with a filename that sanitizes to empty.
 */
export async function validatePdfUpload(
  file: File,
): Promise<FileValidationResult> {
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return { ok: false, error: "File must be PDF, max 10MB" };
  }

  const headBytes = Buffer.from(await file.slice(0, 5).arrayBuffer());
  if (!headBytes.equals(PDF_MAGIC)) {
    return { ok: false, error: "File must be PDF, max 10MB" };
  }

  const safeName = sanitizeFilename(file.name);
  if (!safeName) {
    return { ok: false, error: "Filename contains invalid characters" };
  }

  return { ok: true, safeName, originalName: file.name };
}

export const MAX_PDF_SIZE = MAX_PDF_SIZE_BYTES;
