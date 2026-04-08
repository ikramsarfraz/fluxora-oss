import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
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

export type PortalUser = InferSelectModel<typeof portalUsers>;
export type NewPortalUser = InferInsertModel<typeof portalUsers>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type CustomerAddress = InferSelectModel<typeof customerAddresses>;
export type NewCustomerAddress = InferInsertModel<typeof customerAddresses>;

export type UnitOfMeasure = InferSelectModel<typeof unitsOfMeasure>;
export type NewUnitOfMeasure = InferInsertModel<typeof unitsOfMeasure>;

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export type CustomerProductPrice = InferSelectModel<
  typeof customerProductPrices
>;
export type NewCustomerProductPrice = InferInsertModel<
  typeof customerProductPrices
>;

export type Supplier = InferSelectModel<typeof suppliers>;
export type NewSupplier = InferInsertModel<typeof suppliers>;

export type ProductSupplierCost = InferSelectModel<typeof productSupplierCosts>;
export type NewProductSupplierCost = InferInsertModel<
  typeof productSupplierCosts
>;

export type SupplierInvoice = InferSelectModel<typeof supplierInvoices>;
export type NewSupplierInvoice = InferInsertModel<typeof supplierInvoices>;

export type SupplierInvoiceLine = InferSelectModel<typeof supplierInvoiceLines>;
export type NewSupplierInvoiceLine = InferInsertModel<
  typeof supplierInvoiceLines
>;

export type Lot = InferSelectModel<typeof lots>;
export type NewLot = InferInsertModel<typeof lots>;

export type LotReceipt = InferSelectModel<typeof lotReceipts>;
export type NewLotReceipt = InferInsertModel<typeof lotReceipts>;

export type InventoryItem = InferSelectModel<typeof inventoryItems>;
export type NewInventoryItem = InferInsertModel<typeof inventoryItems>;

export type SalesOrder = InferSelectModel<typeof salesOrders>;
export type NewSalesOrder = InferInsertModel<typeof salesOrders>;

export type SalesOrderLine = InferSelectModel<typeof salesOrderLines>;
export type NewSalesOrderLine = InferInsertModel<typeof salesOrderLines>;

export type SalesOrderLineAllocation = InferSelectModel<
  typeof salesOrderLineAllocations
>;
export type NewSalesOrderLineAllocation = InferInsertModel<
  typeof salesOrderLineAllocations
>;

export type SalesInvoice = InferSelectModel<typeof salesInvoices>;
export type NewSalesInvoice = InferInsertModel<typeof salesInvoices>;

export type SalesInvoiceLine = InferSelectModel<typeof salesInvoiceLines>;
export type NewSalesInvoiceLine = InferInsertModel<typeof salesInvoiceLines>;

export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;
