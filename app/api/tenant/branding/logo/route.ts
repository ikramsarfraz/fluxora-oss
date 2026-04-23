export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { removeTenantLogo, uploadTenantLogo } from "@/services/tenants";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — enforced server-side as well

/**
 * POST /api/tenant/branding/logo
 * Body: multipart/form-data with a single `file` field.
 * Returns: { logoFileId, url } on success.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.byteLength > MAX_BYTES) {
      return Response.json(
        { error: "File too large. Maximum size is 2 MB." },
        { status: 413 },
      );
    }

    await uploadTenantLogo({
      bytes: buffer,
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload logo.";
    return Response.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/tenant/branding/logo
 * Removes the current tenant logo from R2 and clears the branding reference.
 */
export async function DELETE() {
  try {
    await removeTenantLogo();
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to remove logo.";
    return Response.json({ error: message }, { status: 400 });
  }
}
