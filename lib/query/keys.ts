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
    joinRequests: ["users", "join-requests"] as const,
    detail: (id: string) => ["users", id] as const,
    auth: (authUserId: string) => ["users", "auth", authUserId] as const,
  },
  dashboard: {
    summary: ["dashboard"] as const,
    arAging: ["dashboard", "ar-aging"] as const,
    apAging: ["dashboard", "ap-aging"] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: (params: unknown) => ["customers", "list", params] as const,
    detail: (id: string) => ["customers", id] as const,
    portfolio: (id: string) => ["customers", id, "portfolio"] as const,
    prices: (id: string) => ["customers", id, "prices"] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: (params: unknown) => ["suppliers", "list", params] as const,
    detail: (id: string) => ["suppliers", id] as const,
  },
  products: {
    all: ["products"] as const,
    list: (params: unknown) => ["products", "list", params] as const,
    detail: (id: string) => ["products", id] as const,
  },
  unitsOfMeasure: {
    all: ["unitsOfMeasure"] as const,
    detail: (id: string) => ["unitsOfMeasure", id] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    list: (params: unknown) => ["inventory", "list", params] as const,
    detail: (id: string) => ["inventory", id] as const,
  },
  lots: {
    all: ["lots"] as const,
    detail: (id: string) => ["lots", id] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (params: unknown) => ["invoices", "list", params] as const,
    detail: (id: string) => ["invoices", id] as const,
  },
  supplierInvoices: {
    all: ["supplier-invoices"] as const,
    list: (params: unknown) => ["supplier-invoices", "list", params] as const,
    detail: (id: string) => ["supplier-invoices", id] as const,
    activity: (id: string) => ["supplier-invoices", id, "activity"] as const,
  },
  salesOrders: {
    all: ["sales-orders"] as const,
    list: (params: unknown) => ["sales-orders", "list", params] as const,
    detail: (id: string) => ["sales-orders", id] as const,
    activity: (id: string) => ["sales-orders", id, "activity"] as const,
    invoice: (id: string) => ["sales-orders", id, "invoice"] as const,
    allocationEditor: (orderId: string, lineId: string) =>
      ["sales-orders", orderId, "allocation-editor", lineId] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (params: unknown) => ["payments", "list", params] as const,
    detail: (id: string) => ["payments", id] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    list: (params: unknown) => ["expenses", "list", params] as const,
    detail: (id: string) => ["expenses", id] as const,
  },
  tenant: {
    branding: ["tenant", "branding"] as const,
    logoUrl: ["tenant", "branding", "logo-url"] as const,
  },
} as const;
