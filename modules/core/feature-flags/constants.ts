export const FEATURES = {
  DISTRIBUTION_ORDERS: "distribution.orders",
  DISTRIBUTION_INVENTORY: "distribution.inventory",
  DISTRIBUTION_INVOICES: "distribution.invoices",
  DISTRIBUTION_SUPPLIERS: "distribution.suppliers",
  DISTRIBUTION_SUPPLIER_INVOICES: "distribution.supplierInvoices",
  DISTRIBUTION_CUSTOMERS: "distribution.customers",
  DISTRIBUTION_PRODUCTS: "distribution.products",
  DISTRIBUTION_PAYMENTS: "distribution.payments",
  DISTRIBUTION_EXPENSES: "distribution.expenses",
  DISTRIBUTION_LOTS: "distribution.lots",
  DISTRIBUTION_UNITS_OF_MEASURE: "distribution.unitsOfMeasure",
  DISTRIBUTION_CATEGORIES: "distribution.categories",
  DISTRIBUTION_PRICE_CHART: "distribution.priceChart",
  DISTRIBUTION_CONFIGURATION: "distribution.configuration",
  DISTRIBUTION_INBOX: "distribution.inbox",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];
