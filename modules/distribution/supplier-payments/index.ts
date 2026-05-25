/**
 * Public entry point for the supplier-payments module (AP side of the
 * payments domain). Mirrors the modules/distribution/payments AR module.
 *
 * Listing and detail surfaces at /bill-payments. Mutation actions
 * (record / void / update) live in modules/distribution/supplier-invoices
 * because they belong to the bill's transactional scope; this module
 * is read-only.
 */

export type {
  BillPaymentDetail,
  BillPaymentFilters,
  BillPaymentListItem,
  BillPaymentListParams,
  BillPaymentListSort,
  BillPaymentMethod,
  BillPaymentsSummary,
  OpenBillForPayment,
} from "./services/supplier-payments";
