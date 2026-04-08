import { createCustomer } from "@/services/customers";
import {
  createCustomerInputSchema,
  type CreateCustomerInput,
} from "./customer.schemas";

export async function createCustomerSafe(input: CreateCustomerInput) {
  const parsed = createCustomerInputSchema.parse(input);
  return createCustomer(parsed);
}
