import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Better Auth tables
import {
  user,
  session,
  account,
  verification,
} from "./auth-schema";

// ERP tables
import {
  tenants,
  platformUsers,
  portalUsers,
  userInvitations,
  tenantJoinRequests,
  tenantBranding,
  files,
  inventoryAdjustments,
  unitsOfMeasure,
  categories,
  products,
  productCategories,
  customers,
  customerAddresses,
  customerProductPrices,
  suppliers,
  productSupplierCosts,
  supplierInvoices,
  supplierInvoiceLines,
  supplierInvoiceAttachments,
  lots,
  lotReceipts,
  inventoryItems,
  salesOrders,
  salesOrderLines,
  salesOrderLineAllocations,
  salesOrderFulfillments,
  salesInvoices,
  salesInvoiceLines,
  salesInvoiceFiles,
  payments,
  expenses,
  supportTicketAttachments,
  supportTicketUpdates,
  supportTickets,
  auditLogs,
} from "./schema";

// -------------------- Better Auth --------------------

export type AuthUser = InferSelectModel<typeof user>;
export type NewAuthUser = InferInsertModel<typeof user>;

export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;

export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;

// -------------------- Multi-tenant / auth-adjacent --------------------

export type Tenant = InferSelectModel<typeof tenants>;
export type NewTenant = InferInsertModel<typeof tenants>;

export type PlatformUser = InferSelectModel<typeof platformUsers>;
export type NewPlatformUser = InferInsertModel<typeof platformUsers>;

export type PortalUser = InferSelectModel<typeof portalUsers>;
export type NewPortalUser = InferInsertModel<typeof portalUsers>;

export type UserInvitation = InferSelectModel<typeof userInvitations>;
export type NewUserInvitation = InferInsertModel<typeof userInvitations>;

export type TenantJoinRequest = InferSelectModel<typeof tenantJoinRequests>;
export type NewTenantJoinRequest = InferInsertModel<typeof tenantJoinRequests>;

// -------------------- Reference / config --------------------

export type TenantBranding = InferSelectModel<typeof tenantBranding>;
export type NewTenantBranding = InferInsertModel<typeof tenantBranding>;

export type File = InferSelectModel<typeof files>;
export type NewFile = InferInsertModel<typeof files>;

export type UnitOfMeasure = InferSelectModel<typeof unitsOfMeasure>;
export type NewUnitOfMeasure = InferInsertModel<typeof unitsOfMeasure>;

// -------------------- Master data --------------------

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export type ProductCategory = InferSelectModel<typeof productCategories>;
export type NewProductCategory = InferInsertModel<typeof productCategories>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type CustomerAddress = InferSelectModel<typeof customerAddresses>;
export type NewCustomerAddress = InferInsertModel<typeof customerAddresses>;

export type CustomerProductPrice = InferSelectModel<typeof customerProductPrices>;
export type NewCustomerProductPrice = InferInsertModel<typeof customerProductPrices>;

export type Supplier = InferSelectModel<typeof suppliers>;
export type NewSupplier = InferInsertModel<typeof suppliers>;

export type ProductSupplierCost = InferSelectModel<typeof productSupplierCosts>;
export type NewProductSupplierCost = InferInsertModel<typeof productSupplierCosts>;

// -------------------- Purchasing / inventory --------------------

export type SupplierInvoice = InferSelectModel<typeof supplierInvoices>;
export type NewSupplierInvoice = InferInsertModel<typeof supplierInvoices>;

export type SupplierInvoiceLine = InferSelectModel<typeof supplierInvoiceLines>;
export type NewSupplierInvoiceLine = InferInsertModel<typeof supplierInvoiceLines>;

export type SupplierInvoiceAttachment = InferSelectModel<typeof supplierInvoiceAttachments>;
export type NewSupplierInvoiceAttachment = InferInsertModel<typeof supplierInvoiceAttachments>;

export type Lot = InferSelectModel<typeof lots>;
export type NewLot = InferInsertModel<typeof lots>;

export type LotReceipt = InferSelectModel<typeof lotReceipts>;
export type NewLotReceipt = InferInsertModel<typeof lotReceipts>;

export type InventoryItem = InferSelectModel<typeof inventoryItems>;
export type NewInventoryItem = InferInsertModel<typeof inventoryItems>;

export type InventoryAdjustment = InferSelectModel<typeof inventoryAdjustments>;
export type NewInventoryAdjustment = InferInsertModel<typeof inventoryAdjustments>;

// -------------------- Sales / finance --------------------

export type SalesOrder = InferSelectModel<typeof salesOrders>;
export type NewSalesOrder = InferInsertModel<typeof salesOrders>;

export type SalesOrderLine = InferSelectModel<typeof salesOrderLines>;
export type NewSalesOrderLine = InferInsertModel<typeof salesOrderLines>;

export type SalesOrderLineAllocation = InferSelectModel<typeof salesOrderLineAllocations>;
export type NewSalesOrderLineAllocation = InferInsertModel<typeof salesOrderLineAllocations>;

export type SalesOrderFulfillment = InferSelectModel<typeof salesOrderFulfillments>;
export type NewSalesOrderFulfillment = InferInsertModel<typeof salesOrderFulfillments>;

export type SalesInvoice = InferSelectModel<typeof salesInvoices>;
export type NewSalesInvoice = InferInsertModel<typeof salesInvoices>;

export type SalesInvoiceLine = InferSelectModel<typeof salesInvoiceLines>;
export type NewSalesInvoiceLine = InferInsertModel<typeof salesInvoiceLines>;

export type SalesInvoiceFile = InferSelectModel<typeof salesInvoiceFiles>;
export type NewSalesInvoiceFile = InferInsertModel<typeof salesInvoiceFiles>;

export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;

export type SupportTicket = InferSelectModel<typeof supportTickets>;
export type NewSupportTicket = InferInsertModel<typeof supportTickets>;

export type SupportTicketUpdate = InferSelectModel<typeof supportTicketUpdates>;
export type NewSupportTicketUpdate = InferInsertModel<
  typeof supportTicketUpdates
>;

export type SupportTicketAttachment = InferSelectModel<
  typeof supportTicketAttachments
>;
export type NewSupportTicketAttachment = InferInsertModel<
  typeof supportTicketAttachments
>;

// -------------------- Audit --------------------

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
