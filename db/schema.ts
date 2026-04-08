import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "sales",
  "warehouse",
  "accounting",
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

export const portalUsers = pgTable("portal_users", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  authUserId: varchar("auth_user_id", { length: 128 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: userRoleEnum("role").notNull().default("sales"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customers = pgTable("customers", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
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
});

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
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    defaultPricePerLb: numeric("default_price_per_lb", {
      precision: 10,
      scale: 4,
    }).notNull(),
    species: varchar("species", { length: 64 }).notNull(),
    stockUnitId: integer("stock_unit_id").references(() => unitsOfMeasure.id, {
      onDelete: "set null",
    }),
    purchaseUnitId: integer("purchase_unit_id").references(
      () => unitsOfMeasure.id,
      {
        onDelete: "set null",
      },
    ),
    salesUnitId: integer("sales_unit_id").references(() => unitsOfMeasure.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => ({
    skuUnique: uniqueIndex("products_sku_unique").on(table.sku),
  }),
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
  table => ({
    customerProductUnique: uniqueIndex("uq_customer_product").on(
      table.customerId,
      table.productId,
    ),
  }),
);

export const suppliers = pgTable("suppliers", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  table => ({
    productSupplierUnique: uniqueIndex("uq_product_supplier_cost").on(
      table.productId,
      table.supplierId,
    ),
  }),
);

export const supplierInvoices = pgTable("supplier_invoices", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
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
});

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
    lotNumber: varchar("lot_number", { length: 128 }).notNull().unique(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    receiveDate: date("receive_date").notNull(),
    expirationDate: date("expiration_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => ({
    expirationIdx: index("ix_lots_expiration_date").on(table.expirationDate),
  }),
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
  table => ({
    lotIdx: index("ix_inventory_items_lot_id").on(table.lotId),
    statusIdx: index("ix_inventory_items_status").on(table.status),
  }),
);

export const salesOrders = pgTable("sales_orders", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  orderNumber: varchar("order_number", { length: 32 }).unique(),
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
  updatedByUserId: integer("updated_by_user_id").references(() => portalUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  table => ({
    allocationUnique: uniqueIndex("uq_sales_line_inventory_item").on(
      table.salesOrderLineId,
      table.inventoryItemId,
    ),
  }),
);

export const salesInvoices = pgTable("sales_invoices", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 64 }).notNull().unique(),
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
});

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

export const payments = pgTable("payments", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
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
});

export const expenses = pgTable(
  "expenses",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
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
  table => ({
    amountPositive: check(
      "expenses_amount_nonnegative",
      sql`${table.amount} >= 0`,
    ),
  }),
);

export * from "./auth-schema";
