export const queryKeys = {
  categories: {
    all: ["categories"] as const,
    detail: (id: string) => ["categories", id] as const,
  },
  auth: {
    me: ["auth", "me"] as const,
  },
  currentUser: {
    portal: ["current-user", "portal"] as const,
  },
  /** ERP staff profile linked to Better Auth (`portal_users`). */
  users: {
    all: ["users"] as const,
    list: (params: unknown) => ["users", "list", params] as const,
    invitations: ["users", "invitations"] as const,
    detail: (id: string) => ["users", id] as const,
    auth: (authUserId: string) => ["users", "auth", authUserId] as const,
  },
  dashboard: {
    summary: ["dashboard"] as const,
    arAging: ["dashboard", "ar-aging"] as const,
    apAging: ["dashboard", "ap-aging"] as const,
    setupChecklist: ["dashboard", "setup-checklist"] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: (params: unknown) => ["customers", "list", params] as const,
    search: (query: string) => ["customers", "search", query] as const,
    detail: (id: string) => ["customers", id] as const,
    portfolio: (id: string) => ["customers", id, "portfolio"] as const,
    prices: (id: string) => ["customers", id, "prices"] as const,
    ordersPage: (id: string, params: unknown) => ["customers", id, "orders", params] as const,
    invoicesPage: (id: string, params: unknown) => ["customers", id, "invoices", params] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: (params: unknown) => ["suppliers", "list", params] as const,
    detail: (id: string) => ["suppliers", id] as const,
    comparison: (categoryId?: string | null) => ["suppliers", "comparison", categoryId ?? null] as const,
    portfolio: (id: string) => ["suppliers", id, "portfolio"] as const,
    invoicesPage: (id: string, params: unknown) => ["suppliers", id, "invoices", params] as const,
    lotsPage: (id: string, params: unknown) => ["suppliers", id, "lots", params] as const,
  },
  products: {
    all: ["products"] as const,
    list: (params: unknown) => ["products", "list", params] as const,
    detail: (id: string) => ["products", id] as const,
    skuPreview: (name: string, categoryName: string | null) =>
      ["products", "sku-preview", name, categoryName ?? null] as const,
    inventorySummary: (id: string) =>
      ["products", id, "inventory-summary"] as const,
    recentPurchases: (id: string) =>
      ["products", id, "recent-purchases"] as const,
    customerPrices: (id: string) =>
      ["products", id, "customer-prices"] as const,
    purchaseIntelligence: (id: string) =>
      ["products", id, "purchase-intelligence"] as const,
    activity: (id: string) => ["products", id, "activity"] as const,
  },
  unitsOfMeasure: {
    all: ["unitsOfMeasure"] as const,
    detail: (id: string) => ["unitsOfMeasure", id] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    list: (params: unknown) => ["inventory", "list", params] as const,
    detail: (id: string) => ["inventory", id] as const,
    activity: (id: string) => ["inventory", id, "activity"] as const,
    casesOnHand: ["inventory", "cases-on-hand"] as const,
    productSummary: ["inventory", "product-summary"] as const,
    fifoAllocation: (productId: string, cases: number) =>
      ["inventory", "fifo-allocation", productId, cases] as const,
  },
  lots: {
    all: ["lots"] as const,
    detail: (id: string) => ["lots", id] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (params: unknown) => ["invoices", "list", params] as const,
    detail: (id: string) => ["invoices", id] as const,
    payments: (id: string) => ["invoices", id, "payments"] as const,
  },
  supplierInvoices: {
    all: ["supplier-invoices"] as const,
    list: (params: unknown) => ["supplier-invoices", "list", params] as const,
    detail: (id: string) => ["supplier-invoices", id] as const,
    activity: (id: string) => ["supplier-invoices", id, "activity"] as const,
    costDiff: (supplierId: string, productIds: string[]) =>
      ["supplier-invoices", "cost-diff", supplierId, [...productIds].sort()] as const,
    reversalPreview: (id: string) => ["supplier-invoices", id, "reversal-preview"] as const,
  },
  salesOrders: {
    all: ["sales-orders"] as const,
    list: (params: unknown) => ["sales-orders", "list", params] as const,
    detail: (id: string) => ["sales-orders", id] as const,
    activity: (id: string) => ["sales-orders", id, "activity"] as const,
    invoice: (id: string) => ["sales-orders", id, "invoice"] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (params: unknown) => ["payments", "list", params] as const,
    detail: (id: string) => ["payments", id] as const,
  },
  /**
   * AP-side (supplier-invoice) payments. Mirrors the AR `payments` keys.
   * Surfaces at /bill-payments. Kept separate from `payments` because the
   * underlying tables and query shapes are different — sharing the prefix
   * would cause inadvertent cross-invalidation.
   */
  billPayments: {
    all: ["bill-payments"] as const,
    list: (params: unknown) => ["bill-payments", "list", params] as const,
    detail: (id: string) => ["bill-payments", id] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    list: (params: unknown) => ["expenses", "list", params] as const,
    detail: (id: string) => ["expenses", id] as const,
    attachments: (id: string) => ["expenses", id, "attachments"] as const,
    bankLink: (id: string) => ["expenses", id, "bank-link"] as const,
  },
  tenant: {
    branding: ["tenant", "branding"] as const,
    logoUrl: ["tenant", "branding", "logo-url"] as const,
  },
  priceChart: {
    all: ["price-chart"] as const,
    customerProducts: (id: string, params: unknown) =>
      ["price-chart", "customer-products", id, params] as const,
  },
  disposition: {
    forLot: (lotId: string) => ["disposition", "lot", lotId] as const,
    detail: (id: string) => ["disposition", id] as const,
  },
  dataReadiness: {
    all: (context?: Record<string, string>) => ["data-readiness", context] as const,
    flag: (flag: string, context?: Record<string, string>) =>
      ["data-readiness", flag, context] as const,
  },
  markdownHistories: {
    byCategory: (category: string) => ["markdown-histories", "category", category] as const,
  },
  onboarding: {
    status: ["onboarding", "status"] as const,
  },
  inbox: {
    bellSummary: ["inbox", "bell-summary"] as const,
  },
  bankConnections: {
    all: ["bank-connections"] as const,
    detail: (id: string) => ["bank-connections", id] as const,
  },
  bankActivity: {
    all: (filter?: string) => ["bank-activity", filter ?? "all"] as const,
  },
  paymentMatches: {
    all: ["payment-matches"] as const,
    forInvoice: (invoiceId: string) => ["payment-matches", "invoice", invoiceId] as const,
  },
} as const;
