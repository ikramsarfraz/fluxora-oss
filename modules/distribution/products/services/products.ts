import { and, count, eq, inArray, isNotNull, isNull, like, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  customerProductPrices,
  productCategories,
  products,
  productSupplierCosts,
  productUnits,
  salesInvoiceLines,
  salesOrderLines,
  supplierInvoiceLines,
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

/** Row shape returned by `getProducts()` / `GET /api/products` (for client `import type` only). */
export type ProductListItem = Awaited<ReturnType<typeof getProducts>>[number];
export type ProductCategory = Awaited<
  ReturnType<typeof getProductCategories>
>[number];
