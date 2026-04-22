import { relations } from "drizzle-orm";
import { user } from "./auth-schema";
import {
  auditLogs,
  categories,
  customerAddresses,
  customerProductPrices,
  customers,
  expenses,
  files,
  inventoryItems,
  lotReceipts,
  lots,
  payments,
  platformUsers,
  portalUsers,
  productCategories,
  products,
  productSupplierCosts,
  productUnits,
  salesInvoiceFiles,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLineAllocations,
  salesOrderFulfillments,
  salesOrderLines,
  salesOrders,
  supplierInvoiceAttachments,
  supplierInvoiceLines,
  supplierInvoices,
  suppliers,
  tenantBranding,
  tenants,
  unitsOfMeasure,
  userInvitations,
} from "./schema";

export const platformUsersRelations = relations(
  platformUsers,
  ({ one, many }) => ({
    authUser: one(user, {
      fields: [platformUsers.authUserId],
      references: [user.id],
    }),
    auditLogs: many(auditLogs, {
      relationName: "audit_logs_actor_platform_user",
    }),
  }),
);

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
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
  files: many(files),
  branding: one(tenantBranding, {
    fields: [tenants.id],
    references: [tenantBranding.tenantId],
  }),
  auditLogs: many(auditLogs),
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
  salesOrdersCreated: many(salesOrders, {
    relationName: "sales_orders_created_by",
  }),
  salesOrdersUpdated: many(salesOrders, {
    relationName: "sales_orders_updated_by",
  }),
  salesOrderLinesShortShipped: many(salesOrderLines, {
    relationName: "sales_order_lines_short_shipped_by",
  }),
  customersCreated: many(customers, {
    relationName: "customers_created_by",
  }),
  customersUpdated: many(customers, {
    relationName: "customers_updated_by",
  }),
  customersArchived: many(customers, {
    relationName: "customers_archived_by",
  }),
  suppliersCreated: many(suppliers, {
    relationName: "suppliers_created_by",
  }),
  suppliersUpdated: many(suppliers, {
    relationName: "suppliers_updated_by",
  }),
  suppliersArchived: many(suppliers, {
    relationName: "suppliers_archived_by",
  }),
  productsCreated: many(products, {
    relationName: "products_created_by",
  }),
  productsUpdated: many(products, {
    relationName: "products_updated_by",
  }),
  productsArchived: many(products, {
    relationName: "products_archived_by",
  }),
  categoriesCreated: many(categories, {
    relationName: "categories_created_by",
  }),
  categoriesUpdated: many(categories, {
    relationName: "categories_updated_by",
  }),
  categoriesArchived: many(categories, {
    relationName: "categories_archived_by",
  }),
  supplierInvoicesCreated: many(supplierInvoices, {
    relationName: "supplier_invoices_created_by",
  }),
  supplierInvoicesUpdated: many(supplierInvoices, {
    relationName: "supplier_invoices_updated_by",
  }),
  supplierInvoicesCompleted: many(supplierInvoices, {
    relationName: "supplier_invoices_completed_by",
  }),
  salesInvoicesCreated: many(salesInvoices, {
    relationName: "sales_invoices_created_by",
  }),
  salesInvoicesUpdated: many(salesInvoices, {
    relationName: "sales_invoices_updated_by",
  }),
  paymentsCreated: many(payments),
  expensesCreated: many(expenses),
  uploadedFiles: many(files, {
    relationName: "files_uploaded_by_user",
  }),
  archivedFiles: many(files, {
    relationName: "files_archived_by_user",
  }),
  brandingCreated: many(tenantBranding, {
    relationName: "tenant_branding_created_by",
  }),
  brandingUpdated: many(tenantBranding, {
    relationName: "tenant_branding_updated_by",
  }),
  invitationsSent: many(userInvitations),
  auditLogs: many(auditLogs, {
    relationName: "audit_logs_actor_portal_user",
  }),
  salesOrderFulfillments: many(salesOrderFulfillments, {
    relationName: "sales_order_fulfillments_fulfilled_by",
  }),
  reversedSalesOrderFulfillments: many(salesOrderFulfillments, {
    relationName: "sales_order_fulfillments_reversed_by",
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

export const customersRelations = relations(customers, ({ many, one }) => ({
  addresses: many(customerAddresses),
  productPrices: many(customerProductPrices),
  salesOrders: many(salesOrders),
  salesInvoices: many(salesInvoices),
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(portalUsers, {
    fields: [customers.createdByUserId],
    references: [portalUsers.id],
    relationName: "customers_created_by",
  }),
  updatedBy: one(portalUsers, {
    fields: [customers.updatedByUserId],
    references: [portalUsers.id],
    relationName: "customers_updated_by",
  }),
  archivedBy: one(portalUsers, {
    fields: [customers.archivedByUserId],
    references: [portalUsers.id],
    relationName: "customers_archived_by",
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

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(portalUsers, {
    fields: [products.createdByUserId],
    references: [portalUsers.id],
    relationName: "products_created_by",
  }),
  updatedBy: one(portalUsers, {
    fields: [products.updatedByUserId],
    references: [portalUsers.id],
    relationName: "products_updated_by",
  }),
  archivedBy: one(portalUsers, {
    fields: [products.archivedByUserId],
    references: [portalUsers.id],
    relationName: "products_archived_by",
  }),
  baseUnit: one(unitsOfMeasure, {
    fields: [products.baseUnitId],
    references: [unitsOfMeasure.id],
    relationName: "product_base_unit",
  }),
  productCategories: many(productCategories),
  productUnits: many(productUnits),
  customerPrices: many(customerProductPrices),
  supplierCosts: many(productSupplierCosts),
  supplierInvoiceLines: many(supplierInvoiceLines),
  inventoryItems: many(inventoryItems),
  salesOrderLines: many(salesOrderLines),
  salesInvoiceLines: many(salesInvoiceLines),
}));

export const productUnitsRelations = relations(productUnits, ({ one }) => ({
  product: one(products, {
    fields: [productUnits.productId],
    references: [products.id],
  }),
  unit: one(unitsOfMeasure, {
    fields: [productUnits.unitId],
    references: [unitsOfMeasure.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(portalUsers, {
    fields: [categories.createdByUserId],
    references: [portalUsers.id],
    relationName: "categories_created_by",
  }),
  updatedBy: one(portalUsers, {
    fields: [categories.updatedByUserId],
    references: [portalUsers.id],
    relationName: "categories_updated_by",
  }),
  archivedBy: one(portalUsers, {
    fields: [categories.archivedByUserId],
    references: [portalUsers.id],
    relationName: "categories_archived_by",
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
  createdBy: one(portalUsers, {
    fields: [suppliers.createdByUserId],
    references: [portalUsers.id],
    relationName: "suppliers_created_by",
  }),
  updatedBy: one(portalUsers, {
    fields: [suppliers.updatedByUserId],
    references: [portalUsers.id],
    relationName: "suppliers_updated_by",
  }),
  archivedBy: one(portalUsers, {
    fields: [suppliers.archivedByUserId],
    references: [portalUsers.id],
    relationName: "suppliers_archived_by",
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
      relationName: "supplier_invoices_created_by",
    }),
    updatedBy: one(portalUsers, {
      fields: [supplierInvoices.updatedByUserId],
      references: [portalUsers.id],
      relationName: "supplier_invoices_updated_by",
    }),
    completedBy: one(portalUsers, {
      fields: [supplierInvoices.completedByUserId],
      references: [portalUsers.id],
      relationName: "supplier_invoices_completed_by",
    }),
    lines: many(supplierInvoiceLines),
    tenant: one(tenants, {
      fields: [supplierInvoices.tenantId],
      references: [tenants.id],
    }),
    attachments: many(supplierInvoiceAttachments),
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
  salesOrderFulfillments: many(salesOrderFulfillments),
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
    fulfillments: many(salesOrderFulfillments),
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
  fulfillments: many(salesOrderFulfillments),
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
    salesUnit: one(unitsOfMeasure, {
      fields: [salesOrderLines.salesUnitId],
      references: [unitsOfMeasure.id],
    }),
    baseUnitSnapshot: one(unitsOfMeasure, {
      fields: [salesOrderLines.baseUnitIdSnapshot],
      references: [unitsOfMeasure.id],
    }),
    shortShippedBy: one(portalUsers, {
      fields: [salesOrderLines.shortShippedByUserId],
      references: [portalUsers.id],
      relationName: "sales_order_lines_short_shipped_by",
    }),
    allocations: many(salesOrderLineAllocations),
    fulfillments: many(salesOrderFulfillments),
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

export const salesOrderFulfillmentsRelations = relations(
  salesOrderFulfillments,
  ({ one }) => ({
    salesOrder: one(salesOrders, {
      fields: [salesOrderFulfillments.salesOrderId],
      references: [salesOrders.id],
    }),
    salesOrderLine: one(salesOrderLines, {
      fields: [salesOrderFulfillments.salesOrderLineId],
      references: [salesOrderLines.id],
    }),
    fulfilledBy: one(portalUsers, {
      fields: [salesOrderFulfillments.fulfilledByUserId],
      references: [portalUsers.id],
      relationName: "sales_order_fulfillments_fulfilled_by",
    }),
    reversedBy: one(portalUsers, {
      fields: [salesOrderFulfillments.reversedByUserId],
      references: [portalUsers.id],
      relationName: "sales_order_fulfillments_reversed_by",
    }),
    inventoryItem: one(inventoryItems, {
      fields: [salesOrderFulfillments.inventoryItemId],
      references: [inventoryItems.id],
    }),
    lot: one(lots, {
      fields: [salesOrderFulfillments.lotId],
      references: [lots.id],
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
      relationName: "sales_invoices_created_by",
    }),
    updatedBy: one(portalUsers, {
      fields: [salesInvoices.updatedByUserId],
      references: [portalUsers.id],
      relationName: "sales_invoices_updated_by",
    }),
    lines: many(salesInvoiceLines),
    payments: many(payments),
    tenant: one(tenants, {
      fields: [salesInvoices.tenantId],
      references: [tenants.id],
    }),
    files: many(salesInvoiceFiles),
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

export const tenantBrandingRelations = relations(tenantBranding, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantBranding.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(portalUsers, {
    fields: [tenantBranding.createdByUserId],
    references: [portalUsers.id],
    relationName: "tenant_branding_created_by",
  }),
  updatedBy: one(portalUsers, {
    fields: [tenantBranding.updatedByUserId],
    references: [portalUsers.id],
    relationName: "tenant_branding_updated_by",
  }),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [files.tenantId],
    references: [tenants.id],
  }),
  uploadedByUser: one(portalUsers, {
    fields: [files.uploadedByUserId],
    references: [portalUsers.id],
    relationName: "files_uploaded_by_user",
  }),
  archivedByUser: one(portalUsers, {
    fields: [files.archivedByUserId],
    references: [portalUsers.id],
    relationName: "files_archived_by_user",
  }),
  supplierInvoiceAttachments: many(supplierInvoiceAttachments),
  salesInvoiceFiles: many(salesInvoiceFiles),
}));

export const supplierInvoiceAttachmentsRelations = relations(
  supplierInvoiceAttachments,
  ({ one }) => ({
    supplierInvoice: one(supplierInvoices, {
      fields: [supplierInvoiceAttachments.supplierInvoiceId],
      references: [supplierInvoices.id],
    }),
    file: one(files, {
      fields: [supplierInvoiceAttachments.fileId],
      references: [files.id],
    }),
  }),
);

export const salesInvoiceFilesRelations = relations(
  salesInvoiceFiles,
  ({ one }) => ({
    salesInvoice: one(salesInvoices, {
      fields: [salesInvoiceFiles.salesInvoiceId],
      references: [salesInvoices.id],
    }),
    file: one(files, {
      fields: [salesInvoiceFiles.fileId],
      references: [files.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  actorPortalUser: one(portalUsers, {
    fields: [auditLogs.actorPortalUserId],
    references: [portalUsers.id],
    relationName: "audit_logs_actor_portal_user",
  }),
  actorPlatformUser: one(platformUsers, {
    fields: [auditLogs.actorPlatformUserId],
    references: [platformUsers.id],
    relationName: "audit_logs_actor_platform_user",
  }),
}));
