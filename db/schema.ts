import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

export const platformRoleEnum = pgEnum("platform_role", [
  "platform_admin",
  "support",
  "qa",
]);

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "sales",
  "warehouse",
  "accounting",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "sales_order",
  "fulfilled",
  "invoiced",
  "cancelled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);

export const inventoryItemStatusEnum = pgEnum("inventory_item_status", [
  "in_stock",
  "picked",
  "shipped",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "zelle",
  "check",
  "credit_card",
  "ach",
]);

export const addressTypeEnum = pgEnum("address_type", [
  "billing",
  "shipping",
  "warehouse",
  "other",
]);

export const lineUnitTypeEnum = pgEnum("line_unit_type", [
  "catch_weight",
  "case",
  "packet",
]);

export const creditTypeEnum = pgEnum("credit_type", [
  "early_payment",
  "volume",
  "promotional",
  "other",
]);

export const fileCategoryEnum = pgEnum("file_category", [
  "tenant_branding",
  "supplier_invoice_attachment",
  "sales_invoice_pdf",
  "sales_invoice_attachment",
  "other",
]);

export const fileStatusEnum = pgEnum("file_status", [
  "uploading",
  "ready",
  "failed",
  "deleted",
]);

export const fileStorageProviderEnum = pgEnum("file_storage_provider", ["r2"]);

export const platformUsers = pgTable(
  "platform_users",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: platformRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("platform_users_auth_user_id_unique").on(table.authUserId),
    index("platform_users_role_idx").on(table.role),
    index("platform_users_is_active_idx").on(table.isActive),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("tenants_slug_unique").on(table.slug),
    index("tenants_is_active_idx").on(table.isActive),
  ],
);

export const tenantBranding = pgTable(
  "tenant_branding",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),

    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    companyLegalName: varchar("company_legal_name", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),

    primaryColor: varchar("primary_color", { length: 32 }),
    secondaryColor: varchar("secondary_color", { length: 32 }),
    accentColor: varchar("accent_color", { length: 32 }),

    invoiceFooterText: text("invoice_footer_text"),
    invoiceNotesDefault: text("invoice_notes_default"),

    logoFileId: integer("logo_file_id"),
    faviconFileId: integer("favicon_file_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [uniqueIndex("tenant_branding_tenant_id_unique").on(table.tenantId)],
);

export const portalUsers = pgTable(
  "portal_users",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("admin"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("portal_users_auth_user_id_tenant_id_unique").on(
      table.authUserId,
      table.tenantId,
    ),
    uniqueIndex("portal_users_tenant_email_unique").on(
      table.tenantId,
      table.email,
    ),
    index("portal_users_auth_user_id_idx").on(table.authUserId),
    index("portal_users_tenant_id_idx").on(table.tenantId),
    index("portal_users_email_idx").on(table.email),
    index("portal_users_is_active_idx").on(table.isActive),
    index("portal_users_role_idx").on(table.role),
  ],
);

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    token: text("token").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedByUserId: integer("invited_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("user_invitations_tenant_id_idx").on(table.tenantId),
    index("user_invitations_email_idx").on(table.email),
    index("user_invitations_token_idx").on(table.token),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 64 }),
    fuelSurchargeAmount: numeric("fuel_surcharge_amount", {
      precision: 10,
      scale: 2,
    }),
    invoicePrefix: varchar("invoice_prefix", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("customers_tenant_id_idx").on(table.tenantId),
    uniqueIndex("customers_tenant_name_unique").on(table.tenantId, table.name),
  ],
);

export const customerAddresses = pgTable("customer_addresses", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  addressType: addressTypeEnum("address_type").notNull().default("shipping"),
  street: varchar("street", { length: 255 }).notNull(),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  zip: varchar("zip", { length: 32 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const unitsOfMeasure = pgTable("units_of_measure", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  abbreviation: varchar("abbreviation", { length: 16 }),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    defaultPricePerLb: numeric("default_price_per_lb", {
      precision: 10,
      scale: 4,
    }).notNull(),
    stockUnitId: integer("stock_unit_id").references(() => unitsOfMeasure.id, {
      onDelete: "set null",
    }),
    purchaseUnitId: integer("purchase_unit_id").references(
      () => unitsOfMeasure.id,
      { onDelete: "set null" },
    ),
    salesUnitId: integer("sales_unit_id").references(() => unitsOfMeasure.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("products_tenant_sku_unique").on(table.tenantId, table.sku),
    index("products_tenant_id_idx").on(table.tenantId),
    index("products_name_idx").on(table.name),
    index("products_stock_unit_id_idx").on(table.stockUnitId),
    index("products_purchase_unit_id_idx").on(table.purchaseUnitId),
    index("products_sales_unit_id_idx").on(table.salesUnitId),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("categories_tenant_name_unique").on(table.tenantId, table.name),
    uniqueIndex("categories_tenant_slug_unique").on(table.tenantId, table.slug),
    index("categories_tenant_id_idx").on(table.tenantId),
    index("categories_is_active_idx").on(table.isActive),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    primaryKey({
      name: "product_categories_pkey",
      columns: [table.productId, table.categoryId],
    }),
    index("product_categories_product_id_idx").on(table.productId),
    index("product_categories_category_id_idx").on(table.categoryId),
  ],
);

export const customerProductPrices = pgTable(
  "customer_product_prices",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    pricePerLb: numeric("price_per_lb", { precision: 10, scale: 4 }).notNull(),
  },
  table => [
    uniqueIndex("uq_customer_product").on(table.customerId, table.productId),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("suppliers_tenant_id_idx").on(table.tenantId),
    uniqueIndex("suppliers_tenant_name_unique").on(table.tenantId, table.name),
  ],
);

export const productSupplierCosts = pgTable(
  "product_supplier_costs",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    costPerLb: numeric("cost_per_lb", { precision: 10, scale: 4 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("uq_product_supplier_cost").on(
      table.productId,
      table.supplierId,
    ),
  ],
);

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(),
    invoiceDate: date("invoice_date").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    paymentMethod: paymentMethodEnum("payment_method"),
    notes: text("notes"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("supplier_invoices_tenant_id_idx").on(table.tenantId),
    index("supplier_invoices_supplier_id_idx").on(table.supplierId),
    uniqueIndex("supplier_invoices_tenant_invoice_number_unique").on(
      table.tenantId,
      table.invoiceNumber,
    ),
  ],
);

export const supplierInvoiceLines = pgTable("supplier_invoice_lines", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  supplierInvoiceId: integer("supplier_invoice_id")
    .notNull()
    .references(() => supplierInvoices.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantityCases: integer("quantity_cases").notNull().default(0),
  weightLbs: numeric("weight_lbs", { precision: 12, scale: 4 })
    .notNull()
    .default("0"),
  unitType: lineUnitTypeEnum("unit_type").notNull().default("catch_weight"),
  caseWeightsLbs: text("case_weights_lbs"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 4 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lots = pgTable(
  "lots",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    lotNumber: varchar("lot_number", { length: 128 }).notNull(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    receiveDate: date("receive_date").notNull(),
    expirationDate: date("expiration_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("lots_tenant_lot_number_unique").on(
      table.tenantId,
      table.lotNumber,
    ),
    index("lots_tenant_id_idx").on(table.tenantId),
    index("ix_lots_expiration_date").on(table.expirationDate),
  ],
);

export const lotReceipts = pgTable("lot_receipts", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  lotId: integer("lot_id")
    .notNull()
    .references(() => lots.id, { onDelete: "cascade" }),
  supplierInvoiceLineId: integer("supplier_invoice_line_id")
    .notNull()
    .references(() => supplierInvoiceLines.id, { onDelete: "cascade" }),
  receivedCases: integer("received_cases").notNull().default(0),
  receivedWeightLbs: numeric("received_weight_lbs", { precision: 12, scale: 4 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "restrict" }),
    barcodeId: varchar("barcode_id", { length: 128 }).notNull().unique(),
    exactWeightLbs: numeric("exact_weight_lbs", {
      precision: 10,
      scale: 4,
    }).notNull(),
    cases: integer("cases").notNull().default(1),
    status: inventoryItemStatusEnum("status").notNull().default("in_stock"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("ix_inventory_items_lot_id").on(table.lotId),
    index("ix_inventory_items_status").on(table.status),
  ],
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    orderNumber: varchar("order_number", { length: 32 }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderDate: date("order_date").notNull(),
    dueDate: date("due_date"),
    status: orderStatusEnum("status").notNull().default("sales_order"),
    addFuelSurcharge: boolean("add_fuel_surcharge").notNull().default(true),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    updatedByUserId: integer("updated_by_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("sales_orders_tenant_id_idx").on(table.tenantId),
    index("sales_orders_customer_id_idx").on(table.customerId),
    uniqueIndex("sales_orders_tenant_order_number_unique").on(
      table.tenantId,
      table.orderNumber,
    ),
  ],
);
export const salesOrderLines = pgTable("sales_order_lines", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  salesOrderId: integer("sales_order_id")
    .notNull()
    .references(() => salesOrders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  expectedCases: integer("expected_cases").notNull(),
  fulfilledCases: integer("fulfilled_cases").notNull().default(0),
  unitType: lineUnitTypeEnum("unit_type").notNull().default("catch_weight"),
  totalBilledWeightLbs: numeric("total_billed_weight_lbs", {
    precision: 12,
    scale: 4,
  })
    .notNull()
    .default("0"),
  pricePerLbOverride: numeric("price_per_lb_override", {
    precision: 10,
    scale: 4,
  }),
  caseWeightsLbs: text("case_weights_lbs"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const salesOrderLineAllocations = pgTable(
  "sales_order_line_allocations",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    salesOrderLineId: integer("sales_order_line_id")
      .notNull()
      .references(() => salesOrderLines.id, { onDelete: "cascade" }),
    inventoryItemId: integer("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    allocatedWeightLbs: numeric("allocated_weight_lbs", {
      precision: 10,
      scale: 4,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("uq_sales_line_inventory_item").on(
      table.salesOrderLineId,
      table.inventoryItemId,
    ),
  ],
);

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(),
    salesOrderId: integer("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    invoiceDate: date("invoice_date").notNull(),
    dueDate: date("due_date"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    creditType: creditTypeEnum("credit_type"),
    creditAmount: numeric("credit_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    fuelSurchargeAmount: numeric("fuel_surcharge_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    balanceDue: numeric("balance_due", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("sales_invoices_tenant_id_idx").on(table.tenantId),
    index("sales_invoices_customer_id_idx").on(table.customerId),
    index("sales_invoices_sales_order_id_idx").on(table.salesOrderId),
    uniqueIndex("sales_invoices_tenant_invoice_number_unique").on(
      table.tenantId,
      table.invoiceNumber,
    ),
  ],
);

export const salesInvoiceLines = pgTable("sales_invoice_lines", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  salesInvoiceId: integer("sales_invoice_id")
    .notNull()
    .references(() => salesInvoices.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantityCases: integer("quantity_cases").notNull().default(0),
  billedWeightLbs: numeric("billed_weight_lbs", { precision: 12, scale: 4 })
    .notNull()
    .default("0"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const payments = pgTable(
  "payments",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    salesInvoiceId: integer("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    paymentDate: date("payment_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    checkNumber: varchar("check_number", { length: 64 }),
    referenceNumber: varchar("reference_number", { length: 128 }),
    notes: text("notes"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("payments_tenant_id_idx").on(table.tenantId),
    index("payments_sales_invoice_id_idx").on(table.salesInvoiceId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    expenseDate: date("expense_date").notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    paymentMethod: paymentMethodEnum("payment_method"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("expenses_tenant_id_idx").on(table.tenantId),
    check("expenses_amount_nonnegative", sql`${table.amount} >= 0`),
  ],
);

export const files = pgTable(
  "files",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),

    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    category: fileCategoryEnum("category").notNull(),

    storageProvider: fileStorageProviderEnum("storage_provider")
      .default("r2")
      .notNull(),

    status: fileStatusEnum("status").default("ready").notNull(),

    objectKey: varchar("object_key", { length: 1024 }).notNull(),
    bucket: varchar("bucket", { length: 255 }),

    originalFilename: varchar("original_filename", { length: 512 }),
    mimeType: varchar("mime_type", { length: 255 }),
    extension: varchar("extension", { length: 32 }),

    sizeBytes: integer("size_bytes"),
    checksumSha256: varchar("checksum_sha256", { length: 128 }),

    uploadedByUserId: integer("uploaded_by_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),

    metadataJson: text("metadata_json"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  table => [
    uniqueIndex("files_object_key_unique").on(table.objectKey),

    index("files_tenant_created_at_idx").on(table.tenantId, table.createdAt),

    index("files_tenant_category_created_at_idx").on(
      table.tenantId,
      table.category,
      table.createdAt,
    ),

    index("files_tenant_status_created_at_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const supplierInvoiceAttachments = pgTable(
  "supplier_invoice_attachments",
  {
    supplierInvoiceId: integer("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),

    fileId: integer("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => [
    primaryKey({
      name: "supplier_invoice_attachments_pkey",
      columns: [table.supplierInvoiceId, table.fileId],
    }),

    index("supplier_invoice_attachments_file_id_idx").on(table.fileId),
  ],
);

export const salesInvoiceFiles = pgTable(
  "sales_invoice_files",
  {
    salesInvoiceId: integer("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),

    fileId: integer("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),

    kind: fileCategoryEnum("kind").notNull(),

    isPrimary: boolean("is_primary").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => [
    primaryKey({
      name: "sales_invoice_files_pkey",
      columns: [table.salesInvoiceId, table.fileId],
    }),

    index("sales_invoice_files_file_id_idx").on(table.fileId),
  ],
);

export * from "./auth-schema";
