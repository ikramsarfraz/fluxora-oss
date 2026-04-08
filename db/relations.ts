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
} from "./schema";

export const portalUsersRelations = relations(portalUsers, ({ many }) => ({
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

export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(customerAddresses),
  productPrices: many(customerProductPrices),
  salesOrders: many(salesOrders),
  salesInvoices: many(salesInvoices),
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
  customerPrices: many(customerProductPrices),
  supplierCosts: many(productSupplierCosts),
  supplierInvoiceLines: many(supplierInvoiceLines),
  inventoryItems: many(inventoryItems),
  salesOrderLines: many(salesOrderLines),
  salesInvoiceLines: many(salesInvoiceLines),
}));

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

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  productCosts: many(productSupplierCosts),
  supplierInvoices: many(supplierInvoices),
  lots: many(lots),
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
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  createdBy: one(portalUsers, {
    fields: [expenses.createdByUserId],
    references: [portalUsers.id],
  }),
}));
