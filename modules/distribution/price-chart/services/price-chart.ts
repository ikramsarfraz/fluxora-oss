import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  customerProductPrices,
  customers,
  productCategories,
  products,
  productSupplierCosts,
  supplierInvoiceLines,
  supplierInvoices,
  suppliers,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

export async function getPriceChartData() {
  const tenant = await getCurrentTenant();
  const tid = tenant.id;

  const [allProducts, allCustomers, allPrices, allCosts, allProductCategories] =
    await Promise.all([
      db.query.products.findMany({
        where: eq(products.tenantId, tid),
        columns: { id: true, sku: true, name: true, defaultPricePerLb: true },
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
          isPrimary: productSupplierCosts.isPrimary,
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

  const invoiceCostRows = await db
    .selectDistinctOn([supplierInvoiceLines.productId, supplierInvoices.supplierId], {
      productId: supplierInvoiceLines.productId,
      supplierId: supplierInvoices.supplierId,
      supplierName: suppliers.name,
      costPerLb: supplierInvoiceLines.unitPrice,
      invoiceDate: supplierInvoices.invoiceDate,
    })
    .from(supplierInvoiceLines)
    .innerJoin(supplierInvoices, eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id))
    .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
    .where(eq(supplierInvoices.tenantId, tid))
    .orderBy(
      supplierInvoiceLines.productId,
      supplierInvoices.supplierId,
      supplierInvoices.invoiceDate,
    );

  const categoryByProduct = new Map<string, string>();
  for (const pc of allProductCategories) {
    if (!categoryByProduct.has(pc.productId)) {
      categoryByProduct.set(pc.productId, pc.categoryName);
    }
  }

  // Build vendor list per product (primary first, then by cost asc)
  const vendorsByProduct = new Map<
    string,
    {
      supplier_id: string;
      supplier_name: string;
      cost_per_lb: string;
      is_primary: boolean;
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
      is_primary: c.isPrimary,
      last_received_at: c.lastReceivedAt?.toISOString() ?? null,
      updated_at: c.updatedAt?.toISOString() ?? null,
    });
  }
  // Sort: primary first, then by cost asc
  for (const [, vendors] of vendorsByProduct) {
    vendors.sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return Number(a.cost_per_lb) - Number(b.cost_per_lb);
    });
  }

  const invoiceCostsByProduct = new Map<
    string,
    { supplier_id: string; supplier_name: string; cost_per_lb: string; invoice_date: string | null }[]
  >();
  for (const r of invoiceCostRows) {
    if (!invoiceCostsByProduct.has(r.productId)) invoiceCostsByProduct.set(r.productId, []);
    invoiceCostsByProduct.get(r.productId)!.push({
      supplier_id: r.supplierId,
      supplier_name: r.supplierName,
      cost_per_lb: r.costPerLb,
      invoice_date: r.invoiceDate ?? null,
    });
  }

  return {
    products: allProducts.map(p => {
      const vendors = vendorsByProduct.get(p.id) ?? [];
      const primaryVendor = vendors.find(v => v.is_primary) ?? vendors[0] ?? null;
      // Use primary vendor cost if available, otherwise fall back to defaultPricePerLb
      const cost = primaryVendor ? primaryVendor.cost_per_lb : p.defaultPricePerLb;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        cost,
        category: categoryByProduct.get(p.id) ?? null,
        vendors,
        costs_from_invoices: invoiceCostsByProduct.get(p.id) ?? [],
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
) {
  await db
    .insert(customerProductPrices)
    .values({ customerId, productId, pricePerLb })
    .onConflictDoUpdate({
      target: [customerProductPrices.customerId, customerProductPrices.productId],
      set: { pricePerLb, updatedAt: new Date() },
    });
}

export async function deleteCustomerProductPrice(customerId: string, productId: string) {
  await db
    .delete(customerProductPrices)
    .where(
      and(
        eq(customerProductPrices.customerId, customerId),
        eq(customerProductPrices.productId, productId),
      ),
    );
}

export async function setProductDefaultCost(productId: string, costPerLb: string) {
  const tenant = await getCurrentTenant();
  await db
    .update(products)
    .set({ defaultPricePerLb: costPerLb })
    .where(and(eq(products.id, productId), eq(products.tenantId, tenant.id)));
}

export async function applyMarkupToAllCustomers(productId: string, costPerLb: string) {
  const tenant = await getCurrentTenant();
  const markup = (parseFloat(costPerLb) * 1.07).toFixed(2);
  const allCustomers = await db.query.customers.findMany({
    where: eq(customers.tenantId, tenant.id),
    columns: { id: true },
  });
  if (allCustomers.length === 0) return;
  await db
    .insert(customerProductPrices)
    .values(allCustomers.map(c => ({ customerId: c.id, productId, pricePerLb: markup })))
    .onConflictDoUpdate({
      target: [customerProductPrices.customerId, customerProductPrices.productId],
      set: { pricePerLb: markup, updatedAt: new Date() },
    });
}

export async function applyMarkupToCustomer(customerId: string) {
  const tenant = await getCurrentTenant();
  const allProducts = await db.query.products.findMany({
    where: eq(products.tenantId, tenant.id),
    columns: { id: true, defaultPricePerLb: true },
  });
  const rows = allProducts
    .map(p => {
      const cost = parseFloat(p.defaultPricePerLb);
      if (!Number.isFinite(cost) || cost < 0) return null;
      return { customerId, productId: p.id, pricePerLb: (cost * 1.07).toFixed(2) };
    })
    .filter(Boolean) as { customerId: string; productId: string; pricePerLb: string }[];
  if (rows.length === 0) return;
  await db
    .insert(customerProductPrices)
    .values(rows)
    .onConflictDoUpdate({
      target: [customerProductPrices.customerId, customerProductPrices.productId],
      set: { pricePerLb: customerProductPrices.pricePerLb, updatedAt: new Date() },
    });
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
  // Check if this product already has any vendor rows; if not, make this one primary
  const existing = await db
    .select({ id: productSupplierCosts.id })
    .from(productSupplierCosts)
    .where(eq(productSupplierCosts.productId, productId))
    .limit(1);

  const isFirst = existing.length === 0;

  await db
    .insert(productSupplierCosts)
    .values({ productId, supplierId, costPerLb, isPrimary: isFirst })
    .onConflictDoUpdate({
      target: [productSupplierCosts.productId, productSupplierCosts.supplierId],
      set: { costPerLb, updatedAt: new Date() },
    });

  // If this is the first vendor, also update the product's defaultPricePerLb
  if (isFirst) {
    const tenant = await getCurrentTenant();
    await db
      .update(products)
      .set({ defaultPricePerLb: costPerLb })
      .where(and(eq(products.id, productId), eq(products.tenantId, tenant.id)));
  }
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

// Promote a vendor to primary for this product (atomic transaction).
// Unsets any existing primary, sets the new one, and syncs product.defaultPricePerLb.
export async function promoteProductVendor(productId: string, supplierId: string) {
  const tenant = await getCurrentTenant();

  await db.transaction(async tx => {
    // Unset existing primary
    await tx
      .update(productSupplierCosts)
      .set({ isPrimary: false })
      .where(
        and(
          eq(productSupplierCosts.productId, productId),
          eq(productSupplierCosts.isPrimary, true),
        ),
      );

    // Set new primary and fetch the cost
    const [updated] = await tx
      .update(productSupplierCosts)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(
        and(
          eq(productSupplierCosts.productId, productId),
          eq(productSupplierCosts.supplierId, supplierId),
        ),
      )
      .returning({ costPerLb: productSupplierCosts.costPerLb });

    if (!updated) throw new Error("Vendor not found for this product");

    // Sync product.defaultPricePerLb to the new primary's cost
    await tx
      .update(products)
      .set({ defaultPricePerLb: updated.costPerLb })
      .where(and(eq(products.id, productId), eq(products.tenantId, tenant.id)));
  });
}

export type PriceChartData = Awaited<ReturnType<typeof getPriceChartData>>;
