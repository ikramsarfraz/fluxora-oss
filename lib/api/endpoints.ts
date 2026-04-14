/** API paths and typed responses for ERP resources. */

const P = {
  auth: "/api/auth",
  portalUsers: "/api/portal-users",
  dashboard: "/api/dashboard",
  banking: "/api/banking",
  monthlyReport: "/api/monthly-report",
  expenses: "/api/expenses",
  suppliers: "/api/suppliers",
  supplierInvoices: "/api/supplier-invoices",
  customers: "/api/customers",
  products: "/api/products",
  lots: "/api/lots",
  inventory: "/api/inventory-items",
  salesOrders: "/api/sales-orders",
  priceChart: "/api/price-chart",
  unitsOfMeasure: "/api/units-of-measure",
};

export type Expense = {
  id: number;
  expense_date: string;
  category: string;
  amount: string;
  note: string | null;
  payment_method: string | null;
  created_at: string;
};

export type DashboardSummary = {
  sales_orders_pending: number;
  invoices_count: number;
  total_outstanding: string;
  total_customers: number;
  total_products: number;
  inventory_items_count: number;
  inventory_chicken: number;
  inventory_beef: number;
  inventory_processed_food: number;
  profit_this_week: string;
  profit_this_month: string;
  total_bank_balance: string;
};

export type BankAccount = {
  id: number;
  name: string;
  institution_name: string | null;
  account_type: string;
  last_four: string | null;
  opening_balance: string;
  opening_balance_date: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ledger_balance: string;
};

export type BankTransaction = {
  id: number;
  bank_account_id: number;
  txn_date: string;
  description: string;
  amount: string;
  memo: string | null;
  created_at: string;
};

export type BankRegisterRow = BankTransaction & { running_balance: string };

export type ExpenseCategorySummary = {
  category: string;
  total_amount: string;
  count: number;
};
export type ExpenseDetailRow = {
  expense_date: string;
  category: string;
  amount: string;
  note: string | null;
  payment_method: string | null;
};
export type MonthlyExpensesSummary = {
  total_amount: string;
  count: number;
  by_category: ExpenseCategorySummary[];
  detail: ExpenseDetailRow[];
};
export type SalesInvoiceDetailRow = {
  order_id: number;
  order_number: string | null;
  order_date: string;
  customer_name: string;
  total_amount: string;
  amount_paid: string;
  payment_method: string | null;
  check_number: string | null;
  paid: boolean;
};
export type MonthlySalesSummary = {
  total_revenue: string;
  count: number;
  detail: SalesInvoiceDetailRow[];
};
export type PurchaseDetailRow = {
  invoice_id: number;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  amount_paid: string;
  payment_method: string | null;
  outstanding: string;
};
export type MonthlyPurchasesSummary = {
  total_amount: string;
  count: number;
  detail: PurchaseDetailRow[];
};
export type MonthlyReport = {
  year: number;
  month: number;
  expenses: MonthlyExpensesSummary;
  sales: MonthlySalesSummary;
  purchases: MonthlyPurchasesSummary;
};

export type Supplier = { id: number; name: string; created_at: string };
export type SupplierInvoiceLine = {
  id: number;
  supplier_invoice_id: number;
  product_id: number;
  product_sku: string;
  product_name: string;
  quantity_cases: number;
  weight_lbs: string;
  unit_type: string; // "catch_weight" | "case" | "packet"
  case_weights?: number[] | null; // per-case weights for catch_weight
  unit_price: string;
  line_total: string;
  created_at: string;
};
export type SupplierInvoice = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  amount_paid?: string;
  payment_method?: string | null;
  notes: string | null;
  created_at: string;
  lines: SupplierInvoiceLine[];
};

export type SupplierInvoiceSummary = {
  invoice_id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  amount_paid: string;
  outstanding: string;
  payment_method: string | null;
};
export type SupplierPortfolioMonth = {
  month: string;
  total_spent: string;
  total_paid: string;
  total_outstanding: string;
  invoices: SupplierInvoiceSummary[];
};
export type SupplierPortfolio = {
  supplier_id: number;
  supplier_name: string;
  total_spent: string;
  total_paid: string;
  total_outstanding: string;
  months: SupplierPortfolioMonth[];
};
export type Customer = {
  id: number;
  name: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone_number?: string | null;
  fuel_surcharge_amount?: string | null;
  invoice_prefix?: string | null;
  created_at: string;
};
export type CustomerPrice = {
  id: number;
  customer_id: number;
  product_id: number;
  price_per_lb: string;
  product_sku?: string;
  product_name?: string;
};
export type UnitOfMeasure = {
  id: number;
  name: string;
  abbreviation: string | null;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  default_price_per_lb: string;
  species: string;
  created_at: string;
  updated_at: string;
  stock_unit_id?: number | null;
  purchase_unit_id?: number | null;
  sales_unit_id?: number | null;
  stock_unit_label?: string | null;
  purchase_unit_label?: string | null;
  sales_unit_label?: string | null;
};
export type Lot = {
  id: number;
  lot_number: string;
  supplier_id: number;
  supplier_name?: string | null;
  receive_date: string;
  expiration_date: string;
  created_at: string;
};
export type CustomerPortfolioInvoice = {
  order_id: number;
  order_number: string | null;
  order_date: string;
  status: string;
  month: string;
  total_revenue: string;
  total_cost: string;
  total_profit: string;
  amount_paid: string;
  outstanding_amount: string;
  payment_method?: string | null;
  check_number?: string | null;
};
export type CustomerPortfolioMonth = {
  month: string;
  total_revenue: string;
  total_cost: string;
  total_profit: string;
  total_outstanding: string;
  invoices: CustomerPortfolioInvoice[];
};
export type CustomerPortfolio = {
  customer_id: number;
  customer_name: string;
  total_revenue: string;
  total_cost: string;
  total_profit: string;
  total_outstanding: string;
  months: CustomerPortfolioMonth[];
};
export type InventoryItem = {
  id: number;
  product_id: number;
  lot_id: number;
  barcode_id: string;
  cases: number;
  exact_weight_lbs: string;
  status: string;
  supplier_name?: string | null;
  lot_number?: string | null;
  sales_order_line_id: number | null;
  sales_order_id: number | null;
  sales_order_number: string | null;
  created_at: string;
  updated_at: string;
};
export type BoxAllocation = {
  barcode_id: string;
  weight_lbs: number;
};
export type SalesOrderLine = {
  id: number;
  sales_order_id: number;
  product_id: number;
  expected_cases: number;
  fulfilled_cases: number;
  unit_type: string; // "catch_weight" | "packet" | "case"
  total_billed_weight_lbs: string;
  price_per_lb_override?: string | null;
  case_weights_lbs?: string | null;
  box_allocations?: BoxAllocation[] | null;
  created_at: string;
  updated_at: string;
};
export type SalesOrder = {
  id: number;
  order_number: string | null;
  customer_id: number;
  order_date: string;
  due_date?: string | null;
  status: string;
  amount_paid: string;
  discount_amount: string;
  credit_type: string | null;
  credit_amount: string;
  add_fuel_surcharge: boolean;
  created_at: string;
  updated_at: string;
  lines: SalesOrderLine[];
  /** Invoice total (from list endpoint). */
  total_amount?: string | null;
  /** total_amount − amount_paid when total_amount set. */
  outstanding?: string | null;
};

export type InvoiceLine = {
  product_id: number;
  product_sku: string;
  product_name: string;
  unit_type?: string; // "catch_weight" | "packet" | "case"
  expected_cases: number;
  total_billed_weight_lbs: string;
  case_weights?: number[];
  price_per_lb: string;
  line_total: string;
};

export type Invoice = {
  order_id: number;
  order_number: string | null;
  customer_id: number;
  customer_name: string;
  customer_street?: string | null;
  customer_city?: string | null;
  customer_state?: string | null;
  customer_zip?: string | null;
  customer_phone?: string | null;
  order_date: string;
  due_date: string | null;
  status: string;
  lines: InvoiceLine[];
  subtotal: string;
  discount_amount: string;
  credit_type: string | null;
  credit_amount: string;
  fuel_surcharge_amount: string;
  total_amount: string;
  /** Estimated cost of goods sold (allocated inventory × cost per lb). */
  cogs_total?: string;
  /** total_amount − cogs_total. */
  gross_profit?: string;
  /** Gross profit as % of total_amount. */
  gross_margin_pct?: string | null;
};

export type PriceChartProductCostBySupplier = {
  supplier_id: number;
  supplier_name: string;
  cost_per_lb: string;
  updated_at?: string | null;
};
export type PriceChartCostFromInvoice = {
  supplier_id: number;
  supplier_name: string;
  cost_per_lb: string;
  invoice_date: string | null;
};
export type PriceChartProduct = {
  id: number;
  sku: string;
  name: string;
  species?: string;
  cost: string;
  costs_by_supplier?: PriceChartProductCostBySupplier[];
  costs_from_invoices?: PriceChartCostFromInvoice[];
};
export type PriceChartCustomer = {
  id: number;
  name: string;
  fuel_surcharge_amount: string | null;
};
export type PriceChartPrice = {
  customer_id: number;
  product_id: number;
  price_per_lb: string;
};
export type PriceChartData = {
  products: PriceChartProduct[];
  customers: PriceChartCustomer[];
  prices: PriceChartPrice[];
};

export type AuthMe = {
  portal_user_id: number;
  clerk_user_id: string;
  tenant_id: number;
  tenant_name: string;
  email: string | null;
  role: string;
  clerk_auth_enabled: boolean;
};

export const endpoints = {
  auth: {
    me: () => `${P.auth}/me`,
  },
  portalUsers: {
    /** POST: ensure `portal_users` row for the current Better Auth session user. */
    create: () => `${P.portalUsers}`,
  },
  dashboard: {
    get: () => P.dashboard,
  },
  banking: {
    accounts: {
      list: () => `${P.banking}/accounts`,
      one: (id: number) => `${P.banking}/accounts/${id}`,
      create: () => `${P.banking}/accounts`,
      update: (id: number) => `${P.banking}/accounts/${id}`,
      delete: (id: number) => `${P.banking}/accounts/${id}`,
      register: (id: number) => `${P.banking}/accounts/${id}/register`,
      addTransaction: (id: number) =>
        `${P.banking}/accounts/${id}/transactions`,
    },
    transactions: {
      update: (id: number) => `${P.banking}/transactions/${id}`,
      delete: (id: number) => `${P.banking}/transactions/${id}`,
    },
  },
  monthlyReport: {
    get: (year: number, month: number) =>
      `${P.monthlyReport}?year=${year}&month=${month}`,
  },
  expenses: {
    list: () => P.expenses,
    one: (id: number) => `${P.expenses}/${id}`,
    create: () => P.expenses,
    update: (id: number) => `${P.expenses}/${id}`,
    delete: (id: number) => `${P.expenses}/${id}`,
  },
  priceChart: {
    get: () => P.priceChart,
    setProductSupplierCost: (productId: number) =>
      `${P.priceChart}/product-supplier-cost/${productId}`,
    deleteProductSupplierCost: (productId: number, supplierId: number) =>
      `${P.priceChart}/product-supplier-cost/${productId}/${supplierId}`,
  },
  suppliers: {
    list: () => P.suppliers,
    one: (id: number) => `${P.suppliers}/${id}`,
    portfolio: (id: number) => `${P.suppliers}/${id}/portfolio`,
    create: () => P.suppliers,
    update: (id: number) => `${P.suppliers}/${id}`,
    delete: (id: number) => `${P.suppliers}/${id}`,
  },
  supplierInvoices: {
    list: () => P.supplierInvoices,
    one: (id: number) => `${P.supplierInvoices}/${id}`,
    create: () => P.supplierInvoices,
    update: (id: number) => `${P.supplierInvoices}/${id}`,
    updateLines: (id: number) => `${P.supplierInvoices}/${id}/lines`,
    upload: () => `${P.supplierInvoices}/upload`,
    delete: (id: number) => `${P.supplierInvoices}/${id}`,
  },
  customers: {
    list: () => P.customers,
    one: (id: number) => `${P.customers}/${id}`,
    portfolio: (id: number) => `${P.customers}/${id}/portfolio`,
    create: () => P.customers,
    update: (id: number) => `${P.customers}/${id}`,
    delete: (id: number) => `${P.customers}/${id}`,
    prices: (id: number) => `${P.customers}/${id}/prices`,
    setPrice: (id: number) => `${P.customers}/${id}/prices`,
    deletePrice: (customerId: number, productId: number) =>
      `${P.customers}/${customerId}/prices/${productId}`,
  },
  unitsOfMeasure: {
    list: () => P.unitsOfMeasure,
    one: (id: number) => `${P.unitsOfMeasure}/${id}`,
    create: () => P.unitsOfMeasure,
    update: (id: number) => `${P.unitsOfMeasure}/${id}`,
    delete: (id: number) => `${P.unitsOfMeasure}/${id}`,
  },
  products: {
    list: () => P.products,
    one: (id: number) => `${P.products}/${id}`,
    create: () => P.products,
    update: (id: number) => `${P.products}/${id}`,
    delete: (id: number) => `${P.products}/${id}`,
  },
  lots: {
    list: () => P.lots,
    one: (id: number) => `${P.lots}/${id}`,
    create: () => P.lots,
    update: (id: number) => `${P.lots}/${id}`,
    delete: (id: number) => `${P.lots}/${id}`,
  },
  inventory: {
    list: () => P.inventory,
    one: (id: number) => `${P.inventory}/${id}`,
    create: () => P.inventory,
    update: (id: number) => `${P.inventory}/${id}`,
    delete: (id: number) => `${P.inventory}/${id}`,
    deleteAll: () => `${P.inventory}/all`,
  },
  salesOrders: {
    list: () => P.salesOrders,
    one: (id: number) => `${P.salesOrders}/${id}`,
    invoice: (id: number) => `${P.salesOrders}/${id}/invoice`,
    createInvoice: (id: number) => `${P.salesOrders}/${id}/create-invoice`,
    create: () => P.salesOrders,
    update: (id: number) => `${P.salesOrders}/${id}`,
    delete: (id: number) => `${P.salesOrders}/${id}`,
    lines: (orderId: number) => `${P.salesOrders}/${orderId}/lines`,
    addLine: (orderId: number) => `${P.salesOrders}/${orderId}/lines`,
    updateLine: (orderId: number, lineId: number) =>
      `${P.salesOrders}/${orderId}/lines/${lineId}`,
  },
};
