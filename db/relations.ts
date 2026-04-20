import { relations } from "drizzle-orm";
import {
  customerAddresses,
  customerProductPrices,
  customers,
  expenses,
  inventoryItems,
  lotReceipts,
  lots,
  payments,
  productSupplierCosts,
  products,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLineAllocations,
  salesOrderLines,
  salesOrders,
  supplierInvoiceLines,
  supplierInvoices,
  suppliers,
  unitsOfMeasure,
  portalUsers,
  categories,
  tenants,
  productCategories,
  platformUsers,
  userInvitations,
} from "./schema";
import { user } from "./auth-schema";

export const platformUsersRelations = relations(platformUsers, ({ one }) => ({
  authUser: one(user, {
    fields: [platformUsers.authUserId],
    references: [user.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  portalUsers: many(portalUsers),
  products: many(products),
  categories: many(categories),
  customers: many(customers),
  suppliers: many(suppliers),
  supplierInvoices: many(supplierInvoices),
  lots: many(lots),
  salesOrders: many(salesOrders),
  salesInvoices: many(salesInvoices),
  payments: many(payments),
  expenses: many(expenses),
  userInvitations: many(userInvitations),
}));

export const portalUsersRelations = relations(portalUsers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [portalUsers.tenantId],
    references: [tenants.id],
  }),
  authUser: one(user, {
    fields: [portalUsers.authUserId],
    references: [user.id],
  }),
  invitationsSent: many(userInvitations),
  salesOrdersCreated: many(salesOrders, {
    relationName: "sales_orders_created_by",
  }),
  salesOrdersUpdated: many(salesOrders, {
    relationName: "sales_orders_updated_by",
  }),
  supplierInvoicesCreated: many(supplierInvoices),
  salesInvoicesCreated: many(salesInvoices),
  paymentsCreated: many(payments),
  expensesCreated: many(expenses),
}));
export const customersRelations = relations(customers, ({ many, one }) => ({
  addresses: many(customerAddresses),
  productPrices: many(customerProductPrices),
  salesOrders: many(salesOrders),
  salesInvoices: many(salesInvoices),
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
}));

export const customerAddressesRelations = relations(
  customerAddresses,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerAddresses.customerId],
      references: [customers.id],
    }),
  }),
);

export const unitsOfMeasureRelations = relations(
  unitsOfMeasure,
  ({ many }) => ({
    stockProducts: many(products, { relationName: "product_stock_unit" }),
    purchaseProducts: many(products, { relationName: "product_purchase_unit" }),
    salesProducts: many(products, { relationName: "product_sales_unit" }),
  }),
);

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  stockUnit: one(unitsOfMeasure, {
    fields: [products.stockUnitId],
    references: [unitsOfMeasure.id],
    relationName: "product_stock_unit",
  }),
  purchaseUnit: one(unitsOfMeasure, {
    fields: [products.purchaseUnitId],
    references: [unitsOfMeasure.id],
    relationName: "product_purchase_unit",
  }),
  salesUnit: one(unitsOfMeasure, {
    fields: [products.salesUnitId],
    references: [unitsOfMeasure.id],
    relationName: "product_sales_unit",
  }),
  productCategories: many(productCategories),
  customerPrices: many(customerProductPrices),
  supplierCosts: many(productSupplierCosts),
  supplierInvoiceLines: many(supplierInvoiceLines),
  inventoryItems: many(inventoryItems),
  salesOrderLines: many(salesOrderLines),
  salesInvoiceLines: many(salesInvoiceLines),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  productCategories: many(productCategories),
}));

export const productCategoriesRelations = relations(
  productCategories,
  ({ one }) => ({
    product: one(products, {
      fields: [productCategories.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [productCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const customerProductPricesRelations = relations(
  customerProductPrices,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerProductPrices.customerId],
      references: [customers.id],
    }),
    product: one(products, {
      fields: [customerProductPrices.productId],
      references: [products.id],
    }),
  }),
);

export const suppliersRelations = relations(suppliers, ({ many, one }) => ({
  productCosts: many(productSupplierCosts),
  supplierInvoices: many(supplierInvoices),
  lots: many(lots),
  tenant: one(tenants, {
    fields: [suppliers.tenantId],
    references: [tenants.id],
  }),
}));

export const productSupplierCostsRelations = relations(
  productSupplierCosts,
  ({ one }) => ({
    product: one(products, {
      fields: [productSupplierCosts.productId],
      references: [products.id],
    }),
    supplier: one(suppliers, {
      fields: [productSupplierCosts.supplierId],
      references: [suppliers.id],
    }),
  }),
);

export const supplierInvoicesRelations = relations(
  supplierInvoices,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [supplierInvoices.supplierId],
      references: [suppliers.id],
    }),
    createdBy: one(portalUsers, {
      fields: [supplierInvoices.createdByUserId],
      references: [portalUsers.id],
    }),
    lines: many(supplierInvoiceLines),
    tenant: one(tenants, {
      fields: [supplierInvoices.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const supplierInvoiceLinesRelations = relations(
  supplierInvoiceLines,
  ({ one, many }) => ({
    supplierInvoice: one(supplierInvoices, {
      fields: [supplierInvoiceLines.supplierInvoiceId],
      references: [supplierInvoices.id],
    }),
    product: one(products, {
      fields: [supplierInvoiceLines.productId],
      references: [products.id],
    }),
    lotReceipts: many(lotReceipts),
  }),
);

export const lotsRelations = relations(lots, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [lots.supplierId],
    references: [suppliers.id],
  }),
  lotReceipts: many(lotReceipts),
  inventoryItems: many(inventoryItems),
  tenant: one(tenants, {
    fields: [lots.tenantId],
    references: [tenants.id],
  }),
}));

export const lotReceiptsRelations = relations(lotReceipts, ({ one }) => ({
  lot: one(lots, {
    fields: [lotReceipts.lotId],
    references: [lots.id],
  }),
  supplierInvoiceLine: one(supplierInvoiceLines, {
    fields: [lotReceipts.supplierInvoiceLineId],
    references: [supplierInvoiceLines.id],
  }),
}));

export const inventoryItemsRelations = relations(
  inventoryItems,
  ({ one, many }) => ({
    product: one(products, {
      fields: [inventoryItems.productId],
      references: [products.id],
    }),
    lot: one(lots, {
      fields: [inventoryItems.lotId],
      references: [lots.id],
    }),
    allocations: many(salesOrderLineAllocations),
  }),
);

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  createdBy: one(portalUsers, {
    fields: [salesOrders.createdByUserId],
    references: [portalUsers.id],
    relationName: "sales_orders_created_by",
  }),
  updatedBy: one(portalUsers, {
    fields: [salesOrders.updatedByUserId],
    references: [portalUsers.id],
    relationName: "sales_orders_updated_by",
  }),
  lines: many(salesOrderLines),
  invoices: many(salesInvoices),
  tenant: one(tenants, {
    fields: [salesOrders.tenantId],
    references: [tenants.id],
  }),
}));

export const salesOrderLinesRelations = relations(
  salesOrderLines,
  ({ one, many }) => ({
    salesOrder: one(salesOrders, {
      fields: [salesOrderLines.salesOrderId],
      references: [salesOrders.id],
    }),
    product: one(products, {
      fields: [salesOrderLines.productId],
      references: [products.id],
    }),
    allocations: many(salesOrderLineAllocations),
  }),
);

export const salesOrderLineAllocationsRelations = relations(
  salesOrderLineAllocations,
  ({ one }) => ({
    salesOrderLine: one(salesOrderLines, {
      fields: [salesOrderLineAllocations.salesOrderLineId],
      references: [salesOrderLines.id],
    }),
    inventoryItem: one(inventoryItems, {
      fields: [salesOrderLineAllocations.inventoryItemId],
      references: [inventoryItems.id],
    }),
  }),
);

export const salesInvoicesRelations = relations(
  salesInvoices,
  ({ one, many }) => ({
    salesOrder: one(salesOrders, {
      fields: [salesInvoices.salesOrderId],
      references: [salesOrders.id],
    }),
    customer: one(customers, {
      fields: [salesInvoices.customerId],
      references: [customers.id],
    }),
    createdBy: one(portalUsers, {
      fields: [salesInvoices.createdByUserId],
      references: [portalUsers.id],
    }),
    lines: many(salesInvoiceLines),
    payments: many(payments),
    tenant: one(tenants, {
      fields: [salesInvoices.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const salesInvoiceLinesRelations = relations(
  salesInvoiceLines,
  ({ one }) => ({
    salesInvoice: one(salesInvoices, {
      fields: [salesInvoiceLines.salesInvoiceId],
      references: [salesInvoices.id],
    }),
    product: one(products, {
      fields: [salesInvoiceLines.productId],
      references: [products.id],
    }),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  salesInvoice: one(salesInvoices, {
    fields: [payments.salesInvoiceId],
    references: [salesInvoices.id],
  }),
  createdBy: one(portalUsers, {
    fields: [payments.createdByUserId],
    references: [portalUsers.id],
  }),
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  createdBy: one(portalUsers, {
    fields: [expenses.createdByUserId],
    references: [portalUsers.id],
  }),
  tenant: one(tenants, {
    fields: [expenses.tenantId],
    references: [tenants.id],
  }),
}));

export const userInvitationsRelations = relations(
  userInvitations,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [userInvitations.tenantId],
      references: [tenants.id],
    }),
    invitedByUser: one(portalUsers, {
      fields: [userInvitations.invitedByUserId],
      references: [portalUsers.id],
    }),
  }),
);
