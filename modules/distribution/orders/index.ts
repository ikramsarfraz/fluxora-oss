export { ORDERS_FEATURE, AI_ASSISTED_ENTRY_FEATURE } from "./feature";
export type * from "./types";
export * from "./actions";

export type {
  ParseSalesOrderTextResult,
  ParseSalesOrderTextLine,
} from "./actions/parse-order-text.types";

export {
  matchCustomerByName,
  type CustomerMatchCandidate,
  type CustomerMatchResult,
} from "./services/customer-matching";

export {
  extractSalesOrderFromText,
  type AiOrderExtractionInput,
  type AiOrderExtractionResult,
  type AiOrderExtractionErrorCode,
  type AiOrderCallUsage,
} from "./services/ai-order-extraction";
