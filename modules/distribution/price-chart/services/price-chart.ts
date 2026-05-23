import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  customerProductPrices,
  customers,
  productCategories,
  products,
  productSupplierCosts,
  suppliers,
  unitsOfMeasure,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
  type PaginatedResult,
} from "@/lib/pagination";

export async function getPriceChartData() {
  const tenant = await getCurrentTenant();
  const tid = tenant.id;

  const [allProducts, allCustomers, allPrices, allCosts, allProductCategories] =
    await Promise.all([
      db.query.products.findMany({
        where: eq(products.tenantId, tid),
        columns: { id: true, sku: true, name: true },
      }),
      db.query.customers.findMany({
        where: eq(customers.tenantId, tid),
        columns: { id: true, name: true, fuelSurchargeAmount: true },
      }),
      db
        .select({
          customerId: customerProductPrices.customerId,
          productId: customerProductPrices.productId,
          pricePerLb: customerProductPrices.pricePerLb,
        })
        .from(customerProductPrices)
        .innerJoin(products, eq(customerProductPrices.productId, products.id))
        .where(eq(products.tenantId, tid)),
      db
        .select({
          productId: productSupplierCosts.productId,
          supplierId: productSupplierCosts.supplierId,
          costPerLb: productSupplierCosts.costPerLb,
          lastReceivedAt: productSupplierCosts.lastReceivedAt,
          updatedAt: productSupplierCosts.updatedAt,
          supplierName: suppliers.name,
        })
        .from(productSupplierCosts)
        .innerJoin(suppliers, eq(productSupplierCosts.supplierId, suppliers.id))
        .innerJoin(products, eq(productSupplierCosts.productId, products.id))
        .where(eq(products.tenantId, tid)),
      db
        .select({
          productId: productCategories.productId,
          categoryName: categories.name,
        })
        .from(productCategories)
        .innerJoin(categories, eq(productCategories.categoryId, categories.id))
        .innerJoin(products, eq(productCategories.productId, products.id))
        .where(eq(products.tenantId, tid)),
    ]);

  const categoryByProduct = new Map<string, string>();
  for (const pc of allProductCategories) {
    if (!categoryByProduct.has(pc.productId)) {
      categoryByProduct.set(pc.productId, pc.categoryName);
    }
  }

  // Build vendor list per product, sorted by cost ascending.
  const vendorsByProduct = new Map<
    string,
    {
      supplier_id: string;
      supplier_name: string;
      cost_per_lb: string;
      last_received_at: string | null;
      updated_at: string | null;
    }[]
  >();
  for (const c of allCosts) {
    if (!vendorsByProduct.has(c.productId)) vendorsByProduct.set(c.productId, []);
    vendorsByProduct.get(c.productId)!.push({
      supplier_id: c.supplierId,
      supplier_name: c.supplierName,
      cost_per_lb: c.costPerLb,
      last_received_at: c.lastReceivedAt?.toISOString() ?? null,
      updated_at: c.updatedAt?.toISOString() ?? null,
    });
  }
  for (const [, vendors] of vendorsByProduct) {
    vendors.sort((a, b) => Number(a.cost_per_lb) - Number(b.cost_per_lb));
  }

  return {
    products: allProducts.map(p => {
      const vendors = vendorsByProduct.get(p.id) ?? [];
      const cheapestVendor = vendors[0] ?? null;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        cost: cheapestVendor?.cost_per_lb ?? null,
        category: categoryByProduct.get(p.id) ?? null,
        vendors,
      };
    }),
    customers: allCustomers.map(c => ({
      id: c.id,
      name: c.name,
      fuel_surcharge_amount: c.fuelSurchargeAmount,
    })),
    prices: allPrices.map(p => ({
      customer_id: p.customerId,
      product_id: p.productId,
      price_per_lb: p.pricePerLb,
    })),
  };
}

export async function setCustomerProductPrice(
  customerId: string,
  productId: string,
  pricePerLb: string,
  supplierId: string | null = null,
) {
  await db
    .insert(customerProductPrices)
    .values({ customerId, productId, supplierId, pricePerLb })
    .onConflictDoUpdate({
      target: [
        customerProductPrices.customerId,
        customerProductPrices.productId,
        customerProductPrices.supplierId,
      ],
      set: { pricePerLb, updatedAt: new Date() },
    });
}

export async function deleteCustomerProductPrice(
  customerId: string,
  productId: string,
  supplierId: string | null = null,
) {
  await db
    .delete(customerProductPrices)
    .where(
      and(
        eq(customerProductPrices.customerId, customerId),
        eq(customerProductPrices.productId, productId),
        supplierId == null
          ? sql`${customerProductPrices.supplierId} IS NULL`
          : eq(customerProductPrices.supplierId, supplierId),
      ),
    );
}

export async function applyMarkupToCustomer(customerId: string, markupPercent = 7) {
  const tenant = await getCurrentTenant();
  const markup = Number(markupPercent);
  if (!Number.isFinite(markup) || markup < 0) {
    throw new Error("Markup must be a non-negative number.");
  }

  const [allProducts, vendorRows] = await Promise.all([
    db.query.products.findMany({
      where: eq(products.tenantId, tenant.id),
      columns: { id: true },
    }),
    db
      .select({
        productId: productSupplierCosts.productId,
        costPerLb: productSupplierCosts.costPerLb,
      })
      .from(productSupplierCosts)
      .innerJoin(products, eq(productSupplierCosts.productId, products.id))
      .where(eq(products.tenantId, tenant.id)),
  ]);

  const vendorsByProduct = new Map<string, { costPerLb: string }[]>();
  for (const row of vendorRows) {
    if (!vendorsByProduct.has(row.productId)) vendorsByProduct.set(row.productId, []);
    vendorsByProduct.get(row.productId)!.push({ costPerLb: row.costPerLb });
  }
  for (const [, vendors] of vendorsByProduct) {
    vendors.sort((a, b) => Number(a.costPerLb) - Number(b.costPerLb));
  }

  const multiplier = 1 + markup / 100;
  const rows = allProducts
    .map(p => {
      const vendors = vendorsByProduct.get(p.id) ?? [];
      const cheapestVendor = vendors[0] ?? null;
      if (!cheapestVendor) return null;
      const cost = parseFloat(cheapestVendor.costPerLb);
      if (!Number.isFinite(cost) || cost <= 0) return null;
      return {
        customerId,
        productId: p.id,
        supplierId: null,
        pricePerLb: (cost * multiplier).toFixed(2),
      };
    })
    .filter(Boolean) as {
    customerId: string;
    productId: string;
    supplierId: null;
    pricePerLb: string;
  }[];
  if (rows.length === 0) return { rowsApplied: 0 };
  // Bulk markup updates the customer's DEFAULT price only (supplier_id IS NULL).
  await db
    .insert(customerProductPrices)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        customerProductPrices.customerId,
        customerProductPrices.productId,
        customerProductPrices.supplierId,
      ],
      set: {
        pricePerLb: sql`excluded.price_per_lb`,
        updatedAt: new Date(),
      },
    });
  return { rowsApplied: rows.length };
}

export async function updateCustomerFuelSurcharge(
  customerId: string,
  fuelSurchargeAmount: string | null,
) {
  const tenant = await getCurrentTenant();
  await db
    .update(customers)
    .set({ fuelSurchargeAmount })
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenant.id)));
}

export async function setProductSupplierCost(
  productId: string,
  supplierId: string,
  costPerLb: string,
) {
  await db
    .insert(productSupplierCosts)
    .values({ productId, supplierId, costPerLb })
    .onConflictDoUpdate({
      target: [productSupplierCosts.productId, productSupplierCosts.supplierId],
      set: { costPerLb, updatedAt: new Date() },
    });
}

export async function deleteProductSupplierCost(productId: string, supplierId: string) {
  await db
    .delete(productSupplierCosts)
    .where(
      and(
        eq(productSupplierCosts.productId, productId),
        eq(productSupplierCosts.supplierId, supplierId),
      ),
    );
}

export type PriceChartData = Awaited<ReturnType<typeof getPriceChartData>>;

export type CustomerProductSort = "name" | "sku";
export type CustomerProductFilters = { category?: string; overridesOnly?: string };
export type CustomerProductsParams = PaginatedQueryInput<CustomerProductSort, CustomerProductFilters>;

export type CustomerProductRow = {
  id: string;
  sku: string;
  name: string;
  cost: string | null;
  category: string | null;
  /**
   * Abbreviation of the product's base UOM ("lb", "ea", "gal"). Drives
   * the "/lb" vs "/ea" vs "/gal" suffix in the customer-price chart so
   * mixed catalogs render correctly. Null for legacy products without
   * a base unit set.
   */
  baseUnitAbbreviation: string | null;
  /** Customer's default price for this product (applies when no per-supplier price is set). */
  customerPrice: string | null;
  vendors: {
    supplier_id: string;
    supplier_name: string;
    cost_per_lb: string;
    last_received_at: string | null;
    updated_at: string | null;
    /** Per-supplier customer price (overrides the default when the line's lot comes from this supplier). */
    customer_price: string | null;
  }[];
};

export type CustomerProductsPage = PaginatedResult<CustomerProductRow> & {
  totalProducts: number;
  overrideCount: number;
  allCategories: string[];
};

export async function getCustomerProductPricesPage(
  customerId: string,
  input?: CustomerProductsParams,
): Promise<CustomerProductsPage> {
  const tenant = await getCurrentTenant();
  const tid = tenant.id;

  const query = normalizePaginatedQuery(input, {
    defaultSort: "name",
    defaultDirection: "asc",
    defaultPageSize: 10,
    defaultFilters: {},
  });

  const { category, overridesOnly } = (query.filters ?? {}) as CustomerProductFilters;
  const isOverridesOnly = overridesOnly === "true";

  const searchCond = buildTextSearchCondition(query.search, [products.name, products.sku]);

  const where = and(
    eq(products.tenantId, tid),
    searchCond,
    category
      ? inArray(
          products.id,
          db
            .select({ id: productCategories.productId })
            .from(productCategories)
            .innerJoin(categories, eq(categories.id, productCategories.categoryId))
            .where(eq(categories.name, category)),
        )
      : undefined,
    isOverridesOnly
      ? inArray(
          products.id,
          db
            .select({ id: customerProductPrices.productId })
            .from(customerProductPrices)
            .where(eq(customerProductPrices.customerId, customerId)),
        )
      : undefined,
  );

  const [[{ total }], [{ totalProducts }], [{ overrideCount }], allCategoryRows] =
    await Promise.all([
      db.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
      db
        .select({ totalProducts: sql<number>`count(*)::int` })
        .from(products)
        .where(eq(products.tenantId, tid)),
      db
        .select({ overrideCount: sql<number>`count(*)::int` })
        .from(customerProductPrices)
        .innerJoin(products, eq(products.id, customerProductPrices.productId))
        .where(and(eq(customerProductPrices.customerId, customerId), eq(products.tenantId, tid))),
      db
        .selectDistinct({ categoryName: categories.name })
        .from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .innerJoin(products, eq(products.id, productCategories.productId))
        .where(eq(products.tenantId, tid))
        .orderBy(asc(categories.name)),
    ]);

  const allCategories = allCategoryRows.map(r => r.categoryName);

  const pagedProducts = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      // Base UOM abbreviation surfaces the product's pricing unit on the
      // chart row (e.g. "lb" for meat, "ea" for beverages) so the suffix
      // renders correctly across mixed catalogs.
      baseUnitAbbreviation: unitsOfMeasure.abbreviation,
    })
    .from(products)
    .leftJoin(unitsOfMeasure, eq(unitsOfMeasure.id, products.baseUnitId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: { name: products.name, sku: products.sku },
      }),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));

  if (pagedProducts.length === 0) {
    return {
      ...createPaginatedResult({ data: [], page: query.page, pageSize: query.pageSize, total }),
      totalProducts,
      overrideCount,
      allCategories,
    };
  }

  const productIds = pagedProducts.map(p => p.id);

  const [categoryRows, priceRows, vendorRows] = await Promise.all([
    db
      .select({ productId: productCategories.productId, categoryName: categories.name })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(inArray(productCategories.productId, productIds)),
    db
      .select({
        productId: customerProductPrices.productId,
        supplierId: customerProductPrices.supplierId,
        pricePerLb: customerProductPrices.pricePerLb,
      })
      .from(customerProductPrices)
      .where(
        and(
          eq(customerProductPrices.customerId, customerId),
          inArray(customerProductPrices.productId, productIds),
        ),
      ),
    db
      .select({
        productId: productSupplierCosts.productId,
        supplierId: productSupplierCosts.supplierId,
        costPerLb: productSupplierCosts.costPerLb,
        lastReceivedAt: productSupplierCosts.lastReceivedAt,
        updatedAt: productSupplierCosts.updatedAt,
        supplierName: suppliers.name,
      })
      .from(productSupplierCosts)
      .innerJoin(suppliers, eq(productSupplierCosts.supplierId, suppliers.id))
      .where(inArray(productSupplierCosts.productId, productIds)),
  ]);

  const categoryByProduct = new Map<string, string>();
  for (const r of categoryRows) {
    if (!categoryByProduct.has(r.productId)) categoryByProduct.set(r.productId, r.categoryName);
  }

  const defaultPriceByProduct = new Map<string, string>();
  // (productId, supplierId) → pricePerLb
  const priceByProductSupplier = new Map<string, string>();
  for (const r of priceRows) {
    if (r.supplierId == null) {
      defaultPriceByProduct.set(r.productId, r.pricePerLb);
    } else {
      priceByProductSupplier.set(`${r.productId}:${r.supplierId}`, r.pricePerLb);
    }
  }

  const vendorsByProduct = new Map<string, CustomerProductRow["vendors"]>();
  for (const r of vendorRows) {
    if (!vendorsByProduct.has(r.productId)) vendorsByProduct.set(r.productId, []);
    vendorsByProduct.get(r.productId)!.push({
      supplier_id: r.supplierId,
      supplier_name: r.supplierName,
      cost_per_lb: r.costPerLb,
      last_received_at: r.lastReceivedAt?.toISOString() ?? null,
      updated_at: r.updatedAt?.toISOString() ?? null,
      customer_price:
        priceByProductSupplier.get(`${r.productId}:${r.supplierId}`) ?? null,
    });
  }
  for (const [, vendors] of vendorsByProduct) {
    vendors.sort((a, b) => Number(a.cost_per_lb) - Number(b.cost_per_lb));
  }

  const data: CustomerProductRow[] = pagedProducts.map(p => {
    const vendors = vendorsByProduct.get(p.id) ?? [];
    const cheapestVendor = vendors[0] ?? null;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      cost: cheapestVendor?.cost_per_lb ?? null,
      category: categoryByProduct.get(p.id) ?? null,
      baseUnitAbbreviation: p.baseUnitAbbreviation,
      customerPrice: defaultPriceByProduct.get(p.id) ?? null,
      vendors,
    };
  });

  return {
    ...createPaginatedResult({ data, page: query.page, pageSize: query.pageSize, total }),
    totalProducts,
    overrideCount,
    allCategories,
  };
}
