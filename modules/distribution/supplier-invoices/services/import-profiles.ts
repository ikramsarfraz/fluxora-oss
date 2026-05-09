import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { supplierImportProfiles } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { normalizeSupplierName } from "../utils/normalization";

export type ImportProfileParsingRules = {
  headerFields?: Record<string, string>;
  lineParsing?: Record<string, unknown>;
  exclusions?: string[];
  feePatterns?: string[];
  totalsPattern?: string;
};

export type ImportProfile = {
  id: string;
  tenantId: string;
  supplierId: string;
  profileName: string;
  detectionKeywords: string[];
  parserType: "deterministic" | "ai_fallback" | "hybrid";
  parsingRules: ImportProfileParsingRules;
  confidenceThreshold: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateImportProfileInput = {
  supplierId: string;
  profileName: string;
  detectionKeywords?: string[];
  parserType?: "deterministic" | "ai_fallback" | "hybrid";
  parsingRules?: ImportProfileParsingRules;
  confidenceThreshold?: number;
};

export type UpdateImportProfileInput = {
  id: string;
  profileName?: string;
  detectionKeywords?: string[];
  parserType?: "deterministic" | "ai_fallback" | "hybrid";
  parsingRules?: ImportProfileParsingRules;
  confidenceThreshold?: number;
  active?: boolean;
};

function rowToProfile(row: typeof supplierImportProfiles.$inferSelect): ImportProfile {
  return {
    id: row.id,
    tenantId: row.tenantId,
    supplierId: row.supplierId,
    profileName: row.profileName,
    detectionKeywords: (row.detectionKeywords as string[]) ?? [],
    parserType: row.parserType,
    parsingRules: (row.parsingRules as ImportProfileParsingRules) ?? {},
    confidenceThreshold: Number(row.confidenceThreshold),
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getImportProfilesForSupplier(
  supplierId: string,
): Promise<ImportProfile[]> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "view_supplier_invoice");

  const rows = await db
    .select()
    .from(supplierImportProfiles)
    .where(
      and(
        eq(supplierImportProfiles.tenantId, tenant.id),
        eq(supplierImportProfiles.supplierId, supplierId),
        eq(supplierImportProfiles.active, true),
      ),
    );

  return rows.map(rowToProfile);
}

export async function createImportProfile(
  input: CreateImportProfileInput,
): Promise<ImportProfile> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const [row] = await db
    .insert(supplierImportProfiles)
    .values({
      tenantId: tenant.id,
      supplierId: input.supplierId,
      profileName: input.profileName.trim(),
      detectionKeywords: input.detectionKeywords ?? [],
      parserType: input.parserType ?? "deterministic",
      parsingRules: input.parsingRules ?? {},
      confidenceThreshold: String(input.confidenceThreshold ?? 60),
      active: true,
      createdByUserId: currentUser.id,
    })
    .returning();

  return rowToProfile(row);
}

export async function updateImportProfile(
  input: UpdateImportProfileInput,
): Promise<ImportProfile> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const updates: Partial<typeof supplierImportProfiles.$inferInsert> = {};
  if (input.profileName !== undefined) updates.profileName = input.profileName.trim();
  if (input.detectionKeywords !== undefined)
    updates.detectionKeywords = input.detectionKeywords;
  if (input.parserType !== undefined) updates.parserType = input.parserType;
  if (input.parsingRules !== undefined) updates.parsingRules = input.parsingRules;
  if (input.confidenceThreshold !== undefined)
    updates.confidenceThreshold = String(input.confidenceThreshold);
  if (input.active !== undefined) updates.active = input.active;

  const [row] = await db
    .update(supplierImportProfiles)
    .set(updates)
    .where(
      and(
        eq(supplierImportProfiles.id, input.id),
        eq(supplierImportProfiles.tenantId, tenant.id),
      ),
    )
    .returning();

  if (!row) throw new Error("Import profile not found.");
  return rowToProfile(row);
}

export async function deactivateImportProfile(id: string): Promise<void> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  await db
    .update(supplierImportProfiles)
    .set({ active: false })
    .where(
      and(
        eq(supplierImportProfiles.id, id),
        eq(supplierImportProfiles.tenantId, tenant.id),
      ),
    );
}

// ---------------------------------------------------------------------------
// Profile detection — called server-side during parsing, not user-triggered.
// Does NOT enforce user auth; caller must gate appropriately.
// ---------------------------------------------------------------------------

export async function detectImportProfile(args: {
  tenantId: string;
  supplierId: string | null;
  extractedText: string;
  filename: string;
}): Promise<ImportProfile | null> {
  if (!args.tenantId) return null;

  const conditions = [
    eq(supplierImportProfiles.tenantId, args.tenantId),
    eq(supplierImportProfiles.active, true),
  ];
  if (args.supplierId) {
    conditions.push(eq(supplierImportProfiles.supplierId, args.supplierId));
  }

  const profiles = await db
    .select()
    .from(supplierImportProfiles)
    .where(and(...conditions));

  if (profiles.length === 0) return null;

  const normalizedText = args.extractedText.toUpperCase();
  const normalizedFilename = args.filename.toUpperCase();

  let bestProfile: ImportProfile | null = null;
  let bestKeywordHits = 0;

  for (const row of profiles) {
    const profile = rowToProfile(row);
    if (!args.supplierId) {
      // If no supplier known yet, check keywords against text + filename
      const keywords = profile.detectionKeywords;
      let hits = 0;
      for (const kw of keywords) {
        const normalized = normalizeSupplierName(kw);
        if (normalizedText.includes(normalized) || normalizedFilename.includes(normalized)) {
          hits++;
        }
      }
      if (hits > bestKeywordHits) {
        bestKeywordHits = hits;
        bestProfile = profile;
      }
    } else {
      // Supplier matched — pick the first active profile for that supplier
      return profile;
    }
  }

  return bestProfile;
}
