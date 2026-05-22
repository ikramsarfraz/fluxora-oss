import { and, count, desc, eq, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  customers,
  customerProductPrices,
  inventoryItems,
  productCategories,
  products,
  productSupplierCosts,
  productUnits,
  salesInvoiceLines,
  salesOrderLines,
  supplierInvoiceLines,
  supplierInvoices,
  suppliers,
} from "@/db/schema";
import {
  buildSkuBase,
  nextSkuForBase,
} from "../utils/sku";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import {
  createPlanLimitReachedError,
  logSubscriptionEnforcementBlock,
} from "@/lib/subscription-enforcement";
import { countActiveProductsForTenant } from "@/modules/core/billing/services/subscription-usage";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

type ProductUnitInput = {
  unitId: string;
  purpose: "stock" | "purchase" | "sales" | "pricing" | "display";
  conversionToBase: string;
  isDefault?: boolean;
  allowsFractional?: boolean;
  sortOrder?: number;
};

const PG_UNIQUE_VIOLATION = "23505";
const PRODUCTS_SKU_UNIQUE_INDEX = "products_tenant_sku_unique";
const MAX_SKU_RETRY_ATTEMPTS = 5;

/** Walk the error chain looking for a Postgres `code` (e.g. "23505"). */
function extractPgCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const o = error as { code?: string; cause?: unknown };
  if (typeof o.code === "string") return o.code;
  if ("cause" in o && o.cause) return extractPgCode(o.cause);
  return undefined;
}

/**
 * True iff the error is a Postgres unique-violation on the
 * (tenant_id, sku) index — i.e. a SKU collision that the caller can
 * retry by picking a different SKU.
 */
function isProductSkuCollision(error: unknown): boolean {
  if (extractPgCode(error) !== PG_UNIQUE_VIOLATION) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return new RegExp(PRODUCTS_SKU_UNIQUE_INDEX, "i").test(msg);
}

export async function getProductById(productId: string) {
  const tenant = await getCurrentTenant();
  // Count each table the product is referenced from. `_purchaseCount` is
  // specifically supplier_invoice_lines because the price-intelligence
  // empty state is about purchase history. `_dependentRecordCount`
  // aggregates every reference that would be invalidated by changing
  // the base unit (orders/invoices/customer prices/supplier costs/bills)
  // — used by the form to lock the base-unit picker.
  const [
    result,
    [supplierInvoiceCountRow],
    [salesOrderCountRow],
    [salesInvoiceCountRow],
    [customerPriceCountRow],
    [supplierCostCountRow],
  ] = await Promise.all([
    db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.tenantId, tenant.id)),
      with: {
        productCategories: {
          with: { category: true },
        },
        productUnits: {
          with: { unit: true },
        },
        baseUnit: true,
        // Audit columns — surfaced as "Created by … on …" + "Last edited by … on …"
        // on the detail page. Columns are populated by createProduct /
        // updateProduct via getCurrentPortalUser(); legacy rows from before
        // those writes were wired up will have nullable relations.
        createdBy: {
          columns: { id: true, fullName: true, email: true },
        },
        updatedBy: {
          columns: { id: true, fullName: true, email: true },
        },
      },
    }),
    db
      .select({ count: count() })
      .from(supplierInvoiceLines)
      .where(eq(supplierInvoiceLines.productId, productId)),
    db
      .select({ count: count() })
      .from(salesOrderLines)
      .where(eq(salesOrderLines.productId, productId)),
    db
      .select({ count: count() })
      .from(salesInvoiceLines)
      .where(eq(salesInvoiceLines.productId, productId)),
    db
      .select({ count: count() })
      .from(customerProductPrices)
      .where(eq(customerProductPrices.productId, productId)),
    db
      .select({ count: count() })
      .from(productSupplierCosts)
      .where(eq(productSupplierCosts.productId, productId)),
  ]);

  if (!result) return null;
  const supplierInvoiceCount = supplierInvoiceCountRow?.count ?? 0;
  const dependentRecordCount =
    supplierInvoiceCount +
    (salesOrderCountRow?.count ?? 0) +
    (salesInvoiceCountRow?.count ?? 0) +
    (customerPriceCountRow?.count ?? 0) +
    (supplierCostCountRow?.count ?? 0);
  return {
    ...result,
    _purchaseCount: supplierInvoiceCount,
    _dependentRecordCount: dependentRecordCount,
  };
}

export type ProductDetail = NonNullable<
  Awaited<ReturnType<typeof getProductById>>
>;

export type ProductListSort =
  | "sku"
  | "name"
  | "defaultPricePerLb"
  | "createdAt";

/**
 * Filter for the paginated list page.
 *   - "active"   (default): only non-archived products
 *   - "archived": only archived products
 *   - "all":      everything
 */
export type ProductArchivedFilter = "active" | "archived" | "all";

export type ProductListParams = PaginatedQueryInput<ProductListSort> & {
  archived?: ProductArchivedFilter;
};

/**
 * Active (non-archived) products in the tenant. Archived products are
 * hidden from order / invoice / receiving pickers — selling or
 * receiving an archived product would re-introduce data nobody wants
 * to see in new business activity.
 *
 * Pass `{ includeArchived: true }` only for catalogs (e.g. CSV export)
 * where the archived rows are meaningful.
 */
export async function getProducts(
  options: { includeArchived?: boolean } = {},
) {
  const tenant = await getCurrentTenant();
  const result = await db.query.products.findMany({
    where: and(
      eq(products.tenantId, tenant.id),
      options.includeArchived ? undefined : isNull(products.archivedAt),
    ),
    with: {
      productCategories: {
        with: { category: true },
      },
      productUnits: {
        with: { unit: true },
      },
      baseUnit: true,
    },
  });

  return result ?? [];
}

export async function getProductsPage(input?: ProductListParams) {
  const tenant = await getCurrentTenant();
  const archived = input?.archived ?? "active";
  const query = normalizePaginatedQuery(input, {
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const archivedCondition =
    archived === "active"
      ? isNull(products.archivedAt)
      : archived === "archived"
        ? isNotNull(products.archivedAt)
        : undefined;
  const where = and(
    eq(products.tenantId, tenant.id),
    archivedCondition,
    buildTextSearchCondition(query.search, [products.sku, products.name]),
  );
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);
  const result = await db.query.products.findMany({
    where,
    with: {
      productCategories: {
        with: { category: true },
      },
      productUnits: {
        with: { unit: true },
      },
      baseUnit: true,
    },
    orderBy: resolveOrderBy({
      sort: query.sort,
      direction: query.direction,
      expressions: {
        sku: products.sku,
        name: products.name,
        defaultPricePerLb: products.defaultPricePerLb,
        createdAt: products.createdAt,
      },
    }),
    limit: query.pageSize,
    offset: getPaginationOffset(query.page, query.pageSize),
  });

  return createPaginatedResult({
    data: result ?? [],
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export async function getProductCategories() {
  const tenant = await getCurrentTenant();
  const result = await db.query.categories.findMany({
    where: eq(categories.tenantId, tenant.id),
  });
  return result ?? [];
}

/**
 * Pick the next available SKU for a new product with the given name and
 * (optional) first-category name. Runs against the tenant's catalog —
 * either the form preview or the persistence layer call this so client
 * and server agree on the increment as long as the catalog hasn't
 * changed between read and write.
 *
 * Returns `null` for an empty name (form hasn't yet entered enough info
 * to compute a base).
 */
export async function previewProductSku(input: {
  name: string;
  categoryName?: string | null;
}): Promise<string | null> {
  const trimmedName = (input.name ?? "").trim();
  if (!trimmedName) return null;
  const tenant = await getCurrentTenant();
  const base = buildSkuBase(trimmedName, input.categoryName ?? null);
  const existing = await db
    .select({ sku: products.sku })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenant.id),
        like(sql`upper(${products.sku})`, `${base.toUpperCase()}-%`),
      ),
    );
  return nextSkuForBase(
    base,
    existing.map(r => r.sku),
  );
}

export async function createProduct(input: {
  sku: string;
  name: string;
  categoryIds: string[];
  defaultPricePerLb?: string;
  baseUnitId?: string | null;
  units?: ProductUnitInput[];
}) {
  const [tenant, portalUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  const maxProducts = getPlanLimit(tenant, "maxProducts");
  if ((await countActiveProductsForTenant(tenant.id)) + 1 > maxProducts) {
    logSubscriptionEnforcementBlock({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
      },
      reason: "limit_reached",
      key: "maxProducts",
      limit: maxProducts,
    });
    throw createPlanLimitReachedError({
      tenant,
      limitKey: "maxProducts",
      limit: maxProducts,
      resourceLabel: "products",
      actionLabel: "add another product",
    });
  }

  let firstCategoryName: string | null = null;
  if (input.categoryIds.length > 0) {
    const validCategories = await db.query.categories.findMany({
      where: inArray(categories.id, input.categoryIds),
    });
    const invalidIds = input.categoryIds.filter(
      id => !validCategories.some(c => c.id === id && c.tenantId === tenant.id),
    );
    if (invalidIds.length > 0) {
      throw new Error("One or more category IDs are invalid.");
    }
    // Preserve the caller's category order so SKU regeneration on conflict
    // uses the same prefix the form previewed.
    const firstId = input.categoryIds[0];
    firstCategoryName =
      validCategories.find(c => c.id === firstId)?.name ?? null;
  }

  // Insert the product row + dependent rows in one transaction, retrying
  // the whole transaction with a freshly-picked SKU if another request
  // inserted the same SKU between the form's preview call and this write.
  // The `(tenant_id, sku)` unique index is the source of truth — the
  // client preview can be stale, so we resolve the collision here rather
  // than failing the user-facing request. The transaction keeps us from
  // ending up with an orphan product row if the categories/units inserts
  // fail.
  let attemptSku = input.sku.trim();
  let product: typeof products.$inferSelect | undefined;
  for (let attempt = 0; attempt < MAX_SKU_RETRY_ATTEMPTS; attempt += 1) {
    try {
      product = await db.transaction(async tx => {
        const [row] = await tx
          .insert(products)
          .values({
            tenantId: tenant.id,
            sku: attemptSku,
            name: input.name.trim(),
            defaultPricePerLb: input.defaultPricePerLb ?? "0",
            baseUnitId: input.baseUnitId ?? null,
            createdByUserId: portalUser.id,
            updatedByUserId: portalUser.id,
          })
          .returning();

        if (input.categoryIds.length > 0) {
          await tx.insert(productCategories).values(
            input.categoryIds.map(categoryId => ({
              productId: row.id,
              categoryId,
            })),
          );
        }

        if (input.units && input.units.length > 0) {
          await tx.insert(productUnits).values(
            input.units.map((u, i) => ({
              productId: row.id,
              unitId: u.unitId,
              purpose: u.purpose,
              conversionToBase: u.conversionToBase,
              isDefault: u.isDefault ?? i === 0,
              allowsFractional: u.allowsFractional ?? true,
              sortOrder: u.sortOrder ?? i,
            })),
          );
        }

        return row;
      });
      break;
    } catch (error) {
      if (!isProductSkuCollision(error)) throw error;
      const nextSku = await previewProductSku({
        name: input.name,
        categoryName: firstCategoryName,
      });
      if (!nextSku || nextSku === attemptSku) {
        throw new Error(
          "Couldn't allocate a unique SKU — try changing the product name.",
        );
      }
      attemptSku = nextSku;
    }
  }
  if (!product) {
    throw new Error(
      "Couldn't allocate a unique SKU after several attempts — try changing the product name.",
    );
  }

  return product;
}

export async function updateProduct(input: {
  id: string;
  sku: string;
  name: string;
  categoryIds: string[];
  defaultPricePerLb?: string;
  baseUnitId?: string | null;
  units?: ProductUnitInput[];
}) {
  const [tenant, portalUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);

  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, input.id), eq(products.tenantId, tenant.id)),
    columns: {
      id: true,
    },
  });
  if (!existing) {
    throw new Error("Product not found.");
  }

  if (input.categoryIds.length > 0) {
    const validCategories = await db.query.categories.findMany({
      where: inArray(categories.id, input.categoryIds),
    });
    const invalidIds = input.categoryIds.filter(
      id => !validCategories.some(c => c.id === id && c.tenantId === tenant.id),
    );
    if (invalidIds.length > 0) {
      throw new Error("One or more category IDs are invalid.");
    }
  }

  // Wrap update + categories rewrite + units rewrite in a transaction so a
  // failure between steps can't leave the product with its categories
  // wiped and no replacement.
  return await db.transaction(async tx => {
    const [updated] = await tx
      .update(products)
      .set({
        sku: input.sku.trim(),
        name: input.name.trim(),
        ...(input.defaultPricePerLb !== undefined && {
          defaultPricePerLb: input.defaultPricePerLb,
        }),
        baseUnitId: input.baseUnitId ?? null,
        updatedByUserId: portalUser.id,
      })
      .where(and(eq(products.id, input.id), eq(products.tenantId, tenant.id)))
      .returning();

    if (!updated) {
      throw new Error("Failed to update product.");
    }

    await tx
      .delete(productCategories)
      .where(eq(productCategories.productId, input.id));

    if (input.categoryIds.length > 0) {
      await tx.insert(productCategories).values(
        input.categoryIds.map(categoryId => ({
          productId: input.id,
          categoryId,
        })),
      );
    }

    await tx
      .delete(productUnits)
      .where(eq(productUnits.productId, input.id));

    if (input.units && input.units.length > 0) {
      await tx.insert(productUnits).values(
        input.units.map((u, i) => ({
          productId: input.id,
          unitId: u.unitId,
          purpose: u.purpose,
          conversionToBase: u.conversionToBase,
          isDefault: u.isDefault ?? i === 0,
          allowsFractional: u.allowsFractional ?? true,
          sortOrder: u.sortOrder ?? i,
        })),
      );
    }

    return updated;
  });
}

/**
 * Soft-delete a product. Sets `archivedAt` + `archivedByUserId`; the
 * row stays in the table so historical orders / invoices / prices /
 * bills keep working. Archived products are hidden from list pages
 * and order / receiving lookups by default, but are restorable.
 *
 * Use this — not `permanentlyDeleteProduct` — for any product that's
 * been used in business activity. Permanent delete is reserved for
 * orphan rows mistakenly created and never referenced.
 */
export async function archiveProduct(productId: string) {
  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  const [row] = await db
    .update(products)
    .set({
      archivedAt: new Date(),
      archivedByUserId: user.id,
    })
    .where(
      and(
        eq(products.id, productId),
        eq(products.tenantId, tenant.id),
        isNull(products.archivedAt),
      ),
    )
    .returning({ id: products.id });
  if (!row) {
    throw new Error("Product not found or already archived.");
  }
  return row;
}

/**
 * Reverse an archive. Clears `archivedAt` / `archivedByUserId`.
 * The `(tenant_id, sku)` unique constraint still applies — restoring
 * a product whose SKU has since been reassigned to a different row
 * will fail at the DB. The form's "Edit product" surface is the
 * fix-up path in that case.
 */
export async function restoreProduct(productId: string) {
  const tenant = await getCurrentTenant();
  const [row] = await db
    .update(products)
    .set({
      archivedAt: null,
      archivedByUserId: null,
    })
    .where(
      and(
        eq(products.id, productId),
        eq(products.tenantId, tenant.id),
        isNotNull(products.archivedAt),
      ),
    )
    .returning({ id: products.id });
  if (!row) {
    throw new Error("Product not found or not archived.");
  }
  return row;
}

/**
 * Permanently remove a product. Only allowed when no dependent record
 * references it — order lines, invoice lines, bill lines, customer
 * prices, and supplier-cost snapshots all have FKs to `products.id`.
 * The FK behaviour varies (some cascade, some restrict, some set null),
 * but a permanent delete is a footgun on a product with any history,
 * so we count first and surface a human-readable error.
 *
 * For products with history, use {@link archiveProduct}.
 */
export async function permanentlyDeleteProduct(productId: string) {
  const tenant = await getCurrentTenant();
  // Confirm the product belongs to this tenant before any of the
  // dependent-count probes run.
  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenant.id)),
    columns: { id: true, name: true },
  });
  if (!existing) {
    throw new Error("Product not found.");
  }
  const [
    [supplierInvoiceCountRow],
    [salesOrderCountRow],
    [salesInvoiceCountRow],
    [customerPriceCountRow],
    [supplierCostCountRow],
  ] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(supplierInvoiceLines)
      .where(eq(supplierInvoiceLines.productId, productId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(salesOrderLines)
      .where(eq(salesOrderLines.productId, productId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(salesInvoiceLines)
      .where(eq(salesInvoiceLines.productId, productId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(customerProductPrices)
      .where(eq(customerProductPrices.productId, productId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(productSupplierCosts)
      .where(eq(productSupplierCosts.productId, productId)),
  ]);

  const parts: string[] = [];
  const orderLines = salesOrderCountRow?.n ?? 0;
  const invoiceLines = salesInvoiceCountRow?.n ?? 0;
  const billLines = supplierInvoiceCountRow?.n ?? 0;
  const prices = customerPriceCountRow?.n ?? 0;
  const costs = supplierCostCountRow?.n ?? 0;
  if (orderLines > 0) parts.push(`${orderLines} order line${orderLines === 1 ? "" : "s"}`);
  if (invoiceLines > 0) parts.push(`${invoiceLines} invoice line${invoiceLines === 1 ? "" : "s"}`);
  if (billLines > 0) parts.push(`${billLines} bill line${billLines === 1 ? "" : "s"}`);
  if (prices > 0) parts.push(`${prices} customer price${prices === 1 ? "" : "s"}`);
  if (costs > 0) parts.push(`${costs} supplier cost${costs === 1 ? "" : "s"}`);
  if (parts.length > 0) {
    throw new Error(
      `This product has ${parts.join(", ")} on record and can't be permanently deleted. Archive instead — historical records will be preserved.`,
    );
  }

  await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenant.id)));
}

/**
 * One row's worth of conflict signal returned by the bulk-import preflight.
 *
 * Reasons:
 *   - `duplicate-sku-active`   — SKU collides with an active product in
 *     the tenant. Insert would fail at the unique index.
 *   - `duplicate-sku-archived` — SKU collides with an *archived* product.
 *     Insert would also fail (the index covers archived rows), but the
 *     friendlier path is to restore the archived product rather than
 *     re-importing a new one.
 *   - `duplicate-name-active`  — name matches an active product. Names
 *     aren't unique server-side, so this is informational ("you already
 *     have a product called X — sure you want a second?"). Skip-able.
 */
export type ProductImportConflict = {
  rowIndex: number;
  reason:
    | "duplicate-sku-active"
    | "duplicate-sku-archived"
    | "duplicate-name-active";
  existingProductId: string;
  existingProductName: string;
  existingProductSku: string;
};

/**
 * Preflight check for a CSV bulk import. Inspects the tenant's catalog
 * (active + archived) for collisions with the incoming `sku` / `name`
 * values. Caller renders each conflict as a row-level issue in the
 * import modal so the user can fix the CSV before applying.
 *
 * Mirrors `findCustomerImportConflicts`.
 */
export async function findProductImportConflicts(
  rows: ReadonlyArray<{ sku?: string; name?: string }>,
): Promise<ProductImportConflict[]> {
  const tenant = await getCurrentTenant();
  const skus = Array.from(
    new Set(
      rows
        .map(r => r.sku?.trim().toUpperCase())
        .filter((s): s is string => !!s && s.length > 0),
    ),
  );
  const names = Array.from(
    new Set(
      rows
        .map(r => r.name?.trim().toLowerCase())
        .filter((n): n is string => !!n && n.length > 0),
    ),
  );
  if (skus.length === 0 && names.length === 0) return [];

  const skuCondition =
    skus.length > 0
      ? sql`upper(${products.sku}) in (${sql.join(
          skus.map(s => sql`${s}`),
          sql`, `,
        )})`
      : null;
  const nameCondition =
    names.length > 0
      ? sql`lower(${products.name}) in (${sql.join(
          names.map(n => sql`${n}`),
          sql`, `,
        )})`
      : null;
  const conditions = [skuCondition, nameCondition].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );
  const matchCondition =
    conditions.length === 1 ? conditions[0] : or(...conditions);

  const existing = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      archivedAt: products.archivedAt,
    })
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), matchCondition!));

  // Lookups: by uppercased SKU and lowercased name, so the CSV row's
  // trimmed value can index in directly.
  const bySku = new Map<
    string,
    { id: string; sku: string; name: string; archived: boolean }
  >();
  const byName = new Map<string, { id: string; sku: string; name: string }>();
  for (const row of existing) {
    bySku.set(row.sku.toUpperCase(), {
      id: row.id,
      sku: row.sku,
      name: row.name,
      archived: !!row.archivedAt,
    });
    // Name conflicts only flagged against active rows — an archived
    // product's name doesn't block a new insert (the unique index is on
    // SKU, not name).
    if (!row.archivedAt) {
      byName.set(row.name.toLowerCase(), {
        id: row.id,
        sku: row.sku,
        name: row.name,
      });
    }
  }

  const conflicts: ProductImportConflict[] = [];
  rows.forEach((row, idx) => {
    const sku = row.sku?.trim().toUpperCase();
    const name = row.name?.trim().toLowerCase();
    // SKU conflict — blocks insert at the unique index. Report it
    // first; if SKU collides we don't bother flagging the name match
    // (it's the same row anyway).
    if (sku && bySku.has(sku)) {
      const hit = bySku.get(sku)!;
      conflicts.push({
        rowIndex: idx,
        reason: hit.archived
          ? "duplicate-sku-archived"
          : "duplicate-sku-active",
        existingProductId: hit.id,
        existingProductSku: hit.sku,
        existingProductName: hit.name,
      });
      return;
    }
    if (name && byName.has(name)) {
      const hit = byName.get(name)!;
      conflicts.push({
        rowIndex: idx,
        reason: "duplicate-name-active",
        existingProductId: hit.id,
        existingProductSku: hit.sku,
        existingProductName: hit.name,
      });
    }
  });
  return conflicts;
}

/**
 * Row shape accepted by {@link bulkCreateProducts}. CSV-level columns
 * resolved to FK ids (`categoryId`, `baseUnitId`) BEFORE calling. The
 * mapper in `utils/csv-row-mapping.ts` owns that translation.
 */
export type BulkCreateProductInput = {
  sku: string;
  name: string;
  categoryId?: string | null;
  baseUnitId?: string | null;
  defaultPricePerLb?: string;
};

export type BulkCreateProductsResult = {
  total: number;
  created: number;
  failed: Array<{ row: number; sku: string; name: string; message: string }>;
};

function formatBulkProductError(error: unknown): string {
  if (error instanceof Error) {
    if (
      isProductSkuCollision(error) ||
      new RegExp(PRODUCTS_SKU_UNIQUE_INDEX, "i").test(error.message)
    ) {
      return "A product with this SKU already exists.";
    }
    return error.message;
  }
  return "Unknown error.";
}

/**
 * Insert N products in one call. Single upfront plan-limit check so a
 * batch either fully fits or fully rejects — no partial commits when
 * the tenant is at the edge of their plan. Per-row failures past the
 * plan check (SKU collision with an archived row, validation, etc.)
 * are caught and returned in `failed` so the modal can render them
 * as per-row errors.
 *
 * Mirrors `bulkCreateCustomers`.
 */
export async function bulkCreateProducts(
  rows: BulkCreateProductInput[],
): Promise<BulkCreateProductsResult> {
  const [tenant, portalUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);

  const maxProducts = getPlanLimit(tenant, "maxProducts");
  const existing = await countActiveProductsForTenant(tenant.id);
  if (existing + rows.length > maxProducts) {
    logSubscriptionEnforcementBlock({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
      },
      reason: "limit_reached",
      key: "maxProducts",
      limit: maxProducts,
    });
    throw createPlanLimitReachedError({
      tenant,
      limitKey: "maxProducts",
      limit: maxProducts,
      resourceLabel: "products",
      actionLabel: `import ${rows.length} product${rows.length === 1 ? "" : "s"}`,
    });
  }

  let created = 0;
  const failed: BulkCreateProductsResult["failed"] = [];

  // Insert rows one-by-one inside a single shared connection. Each row
  // gets its own transaction via createProduct so a failure mid-batch
  // doesn't leave orphan product_categories/product_units rows.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      await db.transaction(async tx => {
        const [productRow] = await tx
          .insert(products)
          .values({
            tenantId: tenant.id,
            sku: row.sku.trim(),
            name: row.name.trim(),
            defaultPricePerLb: row.defaultPricePerLb ?? "0",
            baseUnitId: row.baseUnitId ?? null,
            createdByUserId: portalUser.id,
            updatedByUserId: portalUser.id,
          })
          .returning();
        if (row.categoryId) {
          await tx.insert(productCategories).values({
            productId: productRow.id,
            categoryId: row.categoryId,
          });
        }
        // Mirror the form's single-sales-unit-at-conversion-1 default
        // so the row passes the form's later edit validation without
        // a hand-fix. Only applies when a base unit was resolved.
        if (row.baseUnitId) {
          await tx.insert(productUnits).values({
            productId: productRow.id,
            unitId: row.baseUnitId,
            purpose: "sales",
            conversionToBase: "1",
            isDefault: true,
            allowsFractional: true,
            sortOrder: 0,
          });
        }
      });
      created++;
    } catch (error) {
      failed.push({
        row: i,
        sku: row.sku ?? "",
        name: row.name ?? "",
        message: formatBulkProductError(error),
      });
    }
  }

  return { total: rows.length, created, failed };
}

// ---------------------------------------------------------------------------
// Detail-page sections — keep these read-only and side-effect-free; they
// feed React Query hooks (see hooks/use-products.ts) and run on every
// detail page visit. Each function aggregates one logical surface (on-hand
// stock, recent purchases, customer overrides, purchase intelligence)
// so the detail page can lazy-load them in parallel instead of bundling
// the whole world into getProductById.
// ---------------------------------------------------------------------------

/**
 * Stock summary for the product detail page. Buckets `inventory_items`
 * statuses into three product-friendly groups so the page surfaces a
 * tight "on hand / in motion / problem" trio:
 *
 *   onHand   = in_stock + allocated   (sellable or earmarked-but-here)
 *   inMotion = picked + packed + shipped + sold
 *   problem  = damaged + expired
 *
 * For each bucket we report `cases` and a `weightLbs` aggregate; the
 * weight aggregate is meaningful for catch-weight products and a
 * defensible total for per-each items too (it's just unused there).
 * `lotCount` is the count of distinct lots represented in the on-hand
 * bucket — useful as a stale-stock signal at a glance.
 */
export async function getProductInventorySummary(productId: string) {
  const tenant = await getCurrentTenant();
  // Tenant-scope guard — the inventory tables don't carry tenantId
  // themselves, so we confirm the product first, then query.
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenant.id)),
    columns: { id: true },
  });
  if (!product) return null;

  const rows = await db
    .select({
      status: inventoryItems.status,
      totalCases: sql<number>`coalesce(sum(${inventoryItems.cases}), 0)::int`,
      totalWeight: sql<string>`coalesce(sum(${inventoryItems.exactWeightLbs}), 0)::text`,
      lotCount: sql<number>`count(distinct ${inventoryItems.lotId})::int`,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.productId, productId))
    .groupBy(inventoryItems.status);

  const onHandStatuses = new Set(["in_stock", "allocated"]);
  const inMotionStatuses = new Set(["picked", "packed", "shipped", "sold"]);
  const problemStatuses = new Set(["damaged", "expired"]);

  function bucketTotals(filter: (s: string) => boolean) {
    let cases = 0;
    let weight = 0;
    for (const row of rows) {
      if (!filter(row.status)) continue;
      cases += row.totalCases;
      weight += Number(row.totalWeight);
    }
    return { cases, weightLbs: weight.toString() };
  }

  // For the headline lot count we want "distinct lots backing on-hand
  // stock", regardless of status mix. One more lightweight query:
  const [{ onHandLotCount }] = await db
    .select({
      onHandLotCount: sql<number>`count(distinct ${inventoryItems.lotId})::int`,
    })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.productId, productId),
        inArray(inventoryItems.status, ["in_stock", "allocated"]),
      ),
    );

  return {
    onHand: bucketTotals(s => onHandStatuses.has(s)),
    inMotion: bucketTotals(s => inMotionStatuses.has(s)),
    problem: bucketTotals(s => problemStatuses.has(s)),
    onHandLotCount,
  };
}

/**
 * Last N supplier bills that referenced this product. Returns the line-
 * level snapshot (`unitPrice`, `weightLbs`, `quantityCases`) so the
 * detail page can render "what we paid, when, to whom" without a
 * second round-trip for join data.
 *
 * `limit` defaults to 5 — the MVP detail card is a "recent 5" strip.
 * Larger pagination ships as a separate feature (see GH issue).
 */
export async function getProductRecentPurchases(
  productId: string,
  options: { limit?: number } = {},
) {
  const tenant = await getCurrentTenant();
  const limit = options.limit ?? 5;
  const rows = await db
    .select({
      lineId: supplierInvoiceLines.id,
      unitPrice: supplierInvoiceLines.unitPrice,
      lineTotal: supplierInvoiceLines.lineTotal,
      weightLbs: supplierInvoiceLines.weightLbs,
      quantityCases: supplierInvoiceLines.quantityCases,
      unitType: supplierInvoiceLines.unitType,
      invoiceId: supplierInvoices.id,
      invoiceDate: supplierInvoices.invoiceDate,
      referenceNumber: supplierInvoices.referenceNumber,
      supplierId: suppliers.id,
      supplierName: suppliers.name,
    })
    .from(supplierInvoiceLines)
    .innerJoin(
      supplierInvoices,
      eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id),
    )
    .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
    .where(
      and(
        eq(supplierInvoiceLines.productId, productId),
        eq(supplierInvoices.tenantId, tenant.id),
      ),
    )
    .orderBy(desc(supplierInvoices.invoiceDate))
    .limit(limit);
  return rows;
}

export type ProductRecentPurchase = Awaited<
  ReturnType<typeof getProductRecentPurchases>
>[number];

/**
 * Customers that have a product-specific price override for this
 * product. Returns customer + override price + (optional) supplier scope
 * so the detail page can surface both flat overrides ("Customer X pays
 * $X for this product") and per-supplier overrides ("Customer X pays
 * $X when sourced from Supplier Y").
 */
export async function getProductCustomerPrices(productId: string) {
  const tenant = await getCurrentTenant();
  // Inner-join customers gives us tenant isolation (customers carry
  // tenantId) without a separate guard query.
  const rows = await db
    .select({
      id: customerProductPrices.id,
      customerId: customers.id,
      customerName: customers.name,
      customerArchivedAt: customers.archivedAt,
      pricePerLb: customerProductPrices.pricePerLb,
      supplierId: customerProductPrices.supplierId,
      supplierName: suppliers.name,
      updatedAt: customerProductPrices.updatedAt,
    })
    .from(customerProductPrices)
    .innerJoin(
      customers,
      and(
        eq(customerProductPrices.customerId, customers.id),
        eq(customers.tenantId, tenant.id),
      ),
    )
    .leftJoin(
      suppliers,
      eq(customerProductPrices.supplierId, suppliers.id),
    )
    .where(eq(customerProductPrices.productId, productId))
    .orderBy(desc(customerProductPrices.updatedAt));
  return rows;
}

export type ProductCustomerPrice = Awaited<
  ReturnType<typeof getProductCustomerPrices>
>[number];

/**
 * MVP price intelligence — running cost average over all completed
 * purchases of this product, plus the most-recent cost and its delta
 * vs. the average. Replaces the "unlocks after 3 purchases" empty
 * state on the detail page once we have enough history.
 *
 * Returns `null` when the product has no `supplier_invoice_lines` — the
 * caller renders the empty state. When `purchaseCount < 3` we still
 * return the numbers we have but the caller continues to gate display
 * on count so a single anomalous purchase doesn't masquerade as a
 * "baseline".
 *
 * Future shape (see GH issue): per-supplier breakdown, sparkline over
 * last 30/90 days, drift thresholds, anomaly flags.
 */
export async function getProductPurchaseIntelligence(productId: string) {
  const tenant = await getCurrentTenant();
  // Aggregate: count, average unit price, most recent unit price + date.
  // Done as one query with two CTEs so we don't pay two round-trips.
  const [agg] = await db
    .select({
      purchaseCount: sql<number>`count(*)::int`,
      averageUnitPrice: sql<string>`coalesce(avg(${supplierInvoiceLines.unitPrice}), 0)::text`,
    })
    .from(supplierInvoiceLines)
    .innerJoin(
      supplierInvoices,
      eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id),
    )
    .where(
      and(
        eq(supplierInvoiceLines.productId, productId),
        eq(supplierInvoices.tenantId, tenant.id),
      ),
    );

  if (!agg || agg.purchaseCount === 0) return null;

  // Most recent purchase — separate small query keeps the planner
  // happy (the agg above doesn't need ordering).
  const [mostRecent] = await db
    .select({
      unitPrice: supplierInvoiceLines.unitPrice,
      invoiceDate: supplierInvoices.invoiceDate,
    })
    .from(supplierInvoiceLines)
    .innerJoin(
      supplierInvoices,
      eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id),
    )
    .where(
      and(
        eq(supplierInvoiceLines.productId, productId),
        eq(supplierInvoices.tenantId, tenant.id),
      ),
    )
    .orderBy(desc(supplierInvoices.invoiceDate))
    .limit(1);

  const avg = Number(agg.averageUnitPrice);
  const last = mostRecent ? Number(mostRecent.unitPrice) : null;
  // Delta as a fraction of the average. NaN-safe when avg is 0.
  const deltaFraction =
    last != null && avg > 0 ? (last - avg) / avg : null;

  return {
    purchaseCount: agg.purchaseCount,
    averageUnitPrice: agg.averageUnitPrice,
    mostRecentUnitPrice: mostRecent?.unitPrice ?? null,
    mostRecentDate: mostRecent?.invoiceDate ?? null,
    deltaFraction,
  };
}

export type ProductPurchaseIntelligence = NonNullable<
  Awaited<ReturnType<typeof getProductPurchaseIntelligence>>
>;

/** Row shape returned by `getProducts()` / `GET /api/products` (for client `import type` only). */
export type ProductListItem = Awaited<ReturnType<typeof getProducts>>[number];
export type ProductCategory = Awaited<
  ReturnType<typeof getProductCategories>
>[number];
