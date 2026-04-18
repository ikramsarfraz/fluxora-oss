export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  /** ERP staff profile linked to Better Auth (`portal_users`). */
  users: {
    all: ["users"] as const,
    invitations: ["users", "invitations"] as const,
    detail: (id: number) => ["users", id] as const,
    auth: (authUserId: string) => ["users", "auth", authUserId] as const,
  },
  dashboard: {
    summary: ["dashboard"] as const,
  },
  customers: {
    all: ["customers"] as const,
    detail: (id: number) => ["customers", id] as const,
    portfolio: (id: number) => ["customers", id, "portfolio"] as const,
    prices: (id: number) => ["customers", id, "prices"] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    detail: (id: number) => ["suppliers", id] as const,
  },
  products: {
    all: ["products"] as const,
    detail: (id: number) => ["products", id] as const,
  },
  unitsOfMeasure: {
    all: ["unitsOfMeasure"] as const,
    detail: (id: number) => ["unitsOfMeasure", id] as const,
  },
  salesOrders: {
    all: ["sales-orders"] as const,
    detail: (id: number) => ["sales-orders", id] as const,
    invoice: (id: number) => ["sales-orders", id, "invoice"] as const,
  },
} as const;
