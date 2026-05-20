"use server";

import { and, desc, eq, gte, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, supplierInvoices } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

// ── Output types ────────────────────────────────────────────────────────────

export type SupplierInComparison = {
  id: string;
  name: string;
  invoiceCount: number;
  totalSpend: number;
  lastInvoiceDate: string | null;
  daysSinceLast: number | null;
  /**
   * Engagement score 0–100 — a coarse "is this relationship active" signal
   * derived from recency of the last invoice and total invoice volume. NOT
   * a reliability metric: we don't track on-time delivery, weight variance,
   * or quality defects yet. See GH issue #157 for the planned reliability
   * scoring work.
   */
  engagement: number;
  skuCoverage: number; // # products in category
};

export type ProductInComparison = {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  annualSpend: number;
  annualWeightLbs: number;
  supplierCount: number;
  isSingleSourced: boolean;
};

export type PriceCell = {
  price: number;
  lastDate: string;
  isBest: boolean;
  vsMedian: number;
  status: "best" | "competitive" | "above" | "way-above" | "only-source";
};

export type ComparisonOpportunity = {
  type: "switch_primary" | "add_supplier" | "test_new";
  title: string;
  description: string;
  savingsPerYear: number;
  productId: string;
  productName: string;
  fromSupplierId?: string;
  toSupplierId?: string;
  fromSupplierName?: string;
  toSupplierName?: string;
};

export type ComparisonRisk = {
  type: "concentration" | "single_source" | "stale_supplier";
  title: string;
  description: string;
  severity: "high" | "medium";
  supplierId?: string;
  productIds?: string[];
};

export type SupplierComparisonData = {
  categoryId: string | null;
  categories: { id: string; name: string; skuCount: number }[];
  suppliers: SupplierInComparison[];
  products: ProductInComparison[];
  priceMatrix: Record<string, Record<string, PriceCell | null>>;
  aggregateBySupplier: Record<string, { avgPrice: number; skusWon: number; skusCarried: number }>;
  opportunities: ComparisonOpportunity[];
  risks: ComparisonRisk[];
  summary: {
    categorySpend12mo: number;
    activeSupplierCount: number;
    vsMarketAvgPct: number | null;
    concentrationPct: number | null;
    concentrationSupplierName: string | null;
    singleSourcedCount: number;
    identifiedSavings: number;
  };
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function twelveMonthsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0]!;
}

/**
 * Coarse engagement score combining recency of the last invoice (40%) and
 * total invoice volume capped at 20 invoices (60%). Useful for spotting
 * dormant suppliers — NOT a reliability/quality metric.
 */
function computeEngagement(
  invs: { totalAmount: string; invoiceDate: string }[],
  daysSinceLast: number | null,
): number {
  if (invs.length === 0) return 0;
  const recency = daysSinceLast === null ? 40
    : daysSinceLast < 7 ? 100
    : daysSinceLast < 30 ? 90
    : daysSinceLast < 60 ? 78
    : daysSinceLast < 90 ? 65
    : 40;
  const volume = Math.min(100, invs.length * 5);
  return Math.round(recency * 0.4 + volume * 0.6);
}

// ── Main service ─────────────────────────────────────────────────────────────

export async function getSupplierComparisonData(
  categoryId?: string | null,
): Promise<SupplierComparisonData> {
  const tenant = await getCurrentTenant();

  // 1. All non-archived suppliers
  const allSuppliers = await db.query.suppliers.findMany({
    where: and(eq(suppliers.tenantId, tenant.id), isNull(suppliers.archivedAt)),
    orderBy: [suppliers.name],
  });

  // 2. Invoices (last 12 months, non-draft) with lines → products → categories
  const since = twelveMonthsAgo();
  const allInvoices = await db.query.supplierInvoices.findMany({
    where: and(
      eq(supplierInvoices.tenantId, tenant.id),
      gte(supplierInvoices.invoiceDate, since),
      ne(supplierInvoices.status, "draft"),
    ),
    with: {
      lines: {
        with: {
          product: {
            with: {
              productCategories: { with: { category: true } },
            },
          },
        },
      },
    },
    orderBy: [desc(supplierInvoices.invoiceDate)],
  });

  // 3. Index products seen in invoices
  const productMap = new Map<string, {
    id: string; name: string; sku: string;
    categories: { id: string; name: string }[];
    totalSpend: number; totalWeightLbs: number;
  }>();

  // Index invoices per supplier (desc order already)
  const supplierInvMap = new Map<string, typeof allInvoices>();

  for (const inv of allInvoices) {
    const bucket = supplierInvMap.get(inv.supplierId) ?? [];
    bucket.push(inv);
    supplierInvMap.set(inv.supplierId, bucket);

    for (const line of inv.lines) {
      const prod = line.product;
      if (!prod) continue;
      const existing = productMap.get(prod.id) ?? {
        id: prod.id, name: prod.name, sku: prod.sku,
        categories: prod.productCategories.map(pc => ({
          id: pc.categoryId, name: pc.category?.name ?? "",
        })),
        totalSpend: 0, totalWeightLbs: 0,
      };
      existing.totalSpend += Number(line.lineTotal);
      existing.totalWeightLbs += Number(line.weightLbs);
      productMap.set(prod.id, existing);
    }
  }

  // 4. Build category set
  const categorySet = new Map<string, { id: string; name: string; products: Set<string> }>();
  for (const [, prod] of productMap) {
    for (const cat of prod.categories) {
      if (!cat.id || !cat.name) continue;
      const existing = categorySet.get(cat.id) ?? { id: cat.id, name: cat.name, products: new Set() };
      existing.products.add(prod.id);
      categorySet.set(cat.id, existing);
    }
  }

  // 5. Filter to category
  const filteredProductIds: Set<string> = categoryId
    ? new Set([...(categorySet.get(categoryId)?.products ?? [])])
    : new Set(productMap.keys());

  // 6. Latest price per (productId, supplierId) — invoices already sorted desc
  const latestPriceMap = new Map<string, Map<string, { price: number; lastDate: string }>>();
  for (const inv of allInvoices) {
    for (const line of inv.lines) {
      if (!filteredProductIds.has(line.productId)) continue;
      const prodPrices = latestPriceMap.get(line.productId) ?? new Map();
      if (!prodPrices.has(inv.supplierId)) {
        prodPrices.set(inv.supplierId, {
          price: Number(line.unitPrice),
          lastDate: inv.invoiceDate,
        });
      }
      latestPriceMap.set(line.productId, prodPrices);
    }
  }

  // 7. Build price matrix
  const priceMatrix: SupplierComparisonData["priceMatrix"] = {};
  for (const productId of filteredProductIds) {
    priceMatrix[productId] = {};
    const supplierPrices = latestPriceMap.get(productId) ?? new Map();
    const priceList = [...supplierPrices.values()].map(v => v.price);
    const bestPrice = priceList.length > 0 ? Math.min(...priceList) : null;
    const sortedPrices = [...priceList].sort((a, b) => a - b);
    const medianPrice = sortedPrices.length > 0
      ? sortedPrices[Math.floor(sortedPrices.length / 2)]!
      : null;
    const isOnlySource = supplierPrices.size === 1;

    for (const supplier of allSuppliers) {
      const info = supplierPrices.get(supplier.id);
      if (!info) { priceMatrix[productId]![supplier.id] = null; continue; }

      const { price, lastDate } = info;
      const isBest = bestPrice !== null && price <= bestPrice * 1.001;
      const vsMedian = medianPrice ? ((price - medianPrice) / medianPrice) * 100 : 0;
      let status: PriceCell["status"] = "competitive";
      if (isOnlySource) status = "only-source";
      else if (isBest) status = "best";
      else if (bestPrice !== null && price > bestPrice * 1.15) status = "way-above";
      else if (bestPrice !== null && price > bestPrice * 1.05) status = "above";

      priceMatrix[productId]![supplier.id] = { price, lastDate, isBest, vsMedian, status };
    }
  }

  // 8. Supplier stats
  const supplierStats: SupplierInComparison[] = allSuppliers
    .map(supplier => {
      const invs = supplierInvMap.get(supplier.id) ?? [];
      const totalSpend = invs.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const lastDate = invs.length > 0 ? invs[0]!.invoiceDate : null;
      const daysSinceLast = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
        : null;
      const skuCoverage = [...filteredProductIds].filter(
        pid => priceMatrix[pid]?.[supplier.id] !== null && priceMatrix[pid]?.[supplier.id] !== undefined,
      ).length;
      return {
        id: supplier.id, name: supplier.name,
        invoiceCount: invs.length, totalSpend,
        lastInvoiceDate: lastDate, daysSinceLast,
        engagement: computeEngagement(invs, daysSinceLast),
        skuCoverage,
      };
    })
    .filter(s => s.invoiceCount > 0)
    .sort((a, b) => b.totalSpend - a.totalSpend);

  // 9. Product stats
  const productStats: ProductInComparison[] = [...filteredProductIds]
    .map(productId => {
      const prod = productMap.get(productId)!;
      const supplierPrices = latestPriceMap.get(productId) ?? new Map();
      const supplierCount = supplierPrices.size;
      return {
        id: productId, name: prod.name, sku: prod.sku,
        categoryId: categoryId ?? prod.categories[0]?.id ?? null,
        categoryName: categoryId
          ? (categorySet.get(categoryId)?.name ?? null)
          : (prod.categories[0]?.name ?? null),
        annualSpend: prod.totalSpend, annualWeightLbs: prod.totalWeightLbs,
        supplierCount, isSingleSourced: supplierCount === 1,
      };
    })
    .sort((a, b) => b.annualSpend - a.annualSpend);

  // 10. Aggregate by supplier
  const aggregateBySupplier: SupplierComparisonData["aggregateBySupplier"] = {};
  for (const supplier of supplierStats) {
    const prices: number[] = [];
    let skusWon = 0, skusCarried = 0;
    for (const productId of filteredProductIds) {
      const cell = priceMatrix[productId]?.[supplier.id];
      if (cell) {
        prices.push(cell.price); skusCarried++;
        if (cell.isBest) skusWon++;
      }
    }
    aggregateBySupplier[supplier.id] = {
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      skusWon, skusCarried,
    };
  }

  // 11. Opportunities
  const opportunities: ComparisonOpportunity[] = [];
  for (const product of productStats) {
    const supplierPrices = latestPriceMap.get(product.id);
    if (!supplierPrices || supplierPrices.size < 2) continue;
    const sorted = [...supplierPrices.entries()].sort((a, b) => a[1].price - b[1].price);
    const [bestSuppId, bestInfo] = sorted[0]!;
    const bestSupplier = allSuppliers.find(s => s.id === bestSuppId);
    for (const [worseSuppId, worseInfo] of sorted.slice(1)) {
      if (worseInfo.price <= bestInfo.price * 1.10) continue;
      const savings = (worseInfo.price - bestInfo.price) * product.annualWeightLbs;
      if (savings < 50) continue;
      const worseSupplier = allSuppliers.find(s => s.id === worseSuppId);
      opportunities.push({
        type: "switch_primary",
        title: `Move ${product.name} to ${bestSupplier?.name}`,
        description: `${worseSupplier?.name} $${worseInfo.price.toFixed(2)}/lb → ${bestSupplier?.name} $${bestInfo.price.toFixed(2)}/lb. Save $${Math.round(savings).toLocaleString()}/yr on ~${Math.round(product.annualWeightLbs)} lb.`,
        savingsPerYear: savings,
        productId: product.id, productName: product.name,
        fromSupplierId: worseSuppId, toSupplierId: bestSuppId,
        fromSupplierName: worseSupplier?.name, toSupplierName: bestSupplier?.name,
      });
    }
  }
  opportunities.sort((a, b) => b.savingsPerYear - a.savingsPerYear);

  for (const product of productStats.filter(p => p.isSingleSourced)) {
    opportunities.push({
      type: "add_supplier",
      title: `Get backup quote for ${product.name}`,
      description: `Only 1 supplier carries this SKU. Get a backup before you need one.`,
      savingsPerYear: 0,
      productId: product.id, productName: product.name,
    });
  }

  // 12. Risks
  const risks: ComparisonRisk[] = [];
  const totalCategorySpend = supplierStats.reduce((s, x) => s + x.totalSpend, 0);
  if (totalCategorySpend > 0 && supplierStats.length > 0) {
    const top = supplierStats[0]!;
    const pct = (top.totalSpend / totalCategorySpend) * 100;
    if (pct > 50) {
      risks.push({
        type: "concentration",
        title: `Concentration: ${Math.round(pct)}% with ${top.name}`,
        description: `If ${top.name} has a delivery problem, ${top.skuCoverage} SKU${top.skuCoverage > 1 ? "s" : ""} go dark. Target < 50%.`,
        severity: pct > 70 ? "high" : "medium",
        supplierId: top.id,
      });
    }
  }
  const singleSourced = productStats.filter(p => p.isSingleSourced);
  if (singleSourced.length > 0) {
    risks.push({
      type: "single_source",
      title: `${singleSourced.length} SKU${singleSourced.length > 1 ? "s" : ""} single-sourced`,
      description: `${singleSourced.map(p => p.name).slice(0, 3).join(", ")}${singleSourced.length > 3 ? ` +${singleSourced.length - 3} more` : ""} — no backup supplier.`,
      severity: "high",
      productIds: singleSourced.map(p => p.id),
    });
  }
  for (const s of supplierStats.filter(s => s.daysSinceLast !== null && s.daysSinceLast > 21 && s.skuCoverage > 0)) {
    risks.push({
      type: "stale_supplier",
      title: `${s.name} is going stale`,
      description: `${s.daysSinceLast} days since last order. They carry ${s.skuCoverage} SKU${s.skuCoverage > 1 ? "s" : ""} in this category — keep the relationship warm.`,
      severity: "medium",
      supplierId: s.id,
    });
  }

  // 13. Summary
  const deviations: number[] = [];
  for (const productId of filteredProductIds) {
    const sp = latestPriceMap.get(productId);
    if (!sp || sp.size < 2) continue;
    const prices = [...sp.values()].map(v => v.price);
    const min = Math.min(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    deviations.push(((avg - min) / min) * 100);
  }
  const vsMarketAvgPct = deviations.length > 0
    ? deviations.reduce((a, b) => a + b, 0) / deviations.length
    : null;
  const topSupplier = supplierStats[0] ?? null;
  const concentrationPct = topSupplier && totalCategorySpend > 0
    ? (topSupplier.totalSpend / totalCategorySpend) * 100 : null;
  const activeSupplierCount = supplierStats.filter(s => s.daysSinceLast !== null && s.daysSinceLast <= 90).length;

  return {
    categoryId: categoryId ?? null,
    categories: [...categorySet.values()]
      .map(c => ({ id: c.id, name: c.name, skuCount: c.products.size }))
      .sort((a, b) => b.skuCount - a.skuCount),
    suppliers: supplierStats,
    products: productStats,
    priceMatrix,
    aggregateBySupplier,
    opportunities: opportunities.slice(0, 5),
    risks,
    summary: {
      categorySpend12mo: totalCategorySpend,
      activeSupplierCount,
      vsMarketAvgPct,
      concentrationPct,
      concentrationSupplierName: topSupplier?.name ?? null,
      singleSourcedCount: singleSourced.length,
      identifiedSavings: opportunities.reduce((s, o) => s + o.savingsPerYear, 0),
    },
  };
}
