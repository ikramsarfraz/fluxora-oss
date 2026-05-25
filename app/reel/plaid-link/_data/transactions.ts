export type BankTxn = {
  id: string;
  date: string;
  description: string;
  amount: number; // positive = deposit, negative = withdrawal
  /** Auto-match details when we apply it to invoices/bills. */
  match: {
    kind: "invoice" | "bill" | "expense" | "unmatched";
    label?: string;
    target?: string;
    confidence?: number; // 0..1
  };
};

export const TRANSACTIONS: BankTxn[] = [
  {
    id: "tx-1",
    date: "May 19",
    description: "ACH · LIGHTHOUSE CAFE",
    amount: 4880,
    match: {
      kind: "invoice",
      label: "Invoice payment",
      target: "INV-2701 + 2 more",
      confidence: 0.97,
    },
  },
  {
    id: "tx-2",
    date: "May 19",
    description: "WIRE · ANCHOR TAVERN",
    amount: 1840,
    match: {
      kind: "invoice",
      label: "Invoice payment",
      target: "INV-2756",
      confidence: 0.98,
    },
  },
  {
    id: "tx-3",
    date: "May 18",
    description: "BAY AREA SEAFOOD CO · ACH",
    amount: -2240,
    match: {
      kind: "bill",
      label: "Supplier bill",
      target: "BILL-1108",
      confidence: 0.93,
    },
  },
  {
    id: "tx-4",
    date: "May 18",
    description: "POS · COSTCO BUSINESS",
    amount: -184.32,
    match: {
      kind: "expense",
      label: "Supplies",
      target: "Operations",
      confidence: 0.81,
    },
  },
  {
    id: "tx-5",
    date: "May 17",
    description: "TRANSFER · FERRY PLAZA",
    amount: 3640,
    match: {
      kind: "invoice",
      label: "Invoice payment",
      target: "INV-2718",
      confidence: 0.95,
    },
  },
  {
    id: "tx-6",
    date: "May 17",
    description: "PG&E · AUTOPAY",
    amount: -612,
    match: {
      kind: "expense",
      label: "Utilities",
      target: "Operations",
      confidence: 0.99,
    },
  },
  {
    id: "tx-7",
    date: "May 16",
    description: "ACH · UNKNOWN MERCHANT",
    amount: -340,
    match: { kind: "unmatched" },
  },
  {
    id: "tx-8",
    date: "May 16",
    description: "PAYROLL · GUSTO",
    amount: -8420,
    match: {
      kind: "expense",
      label: "Payroll",
      target: "Operations",
      confidence: 0.99,
    },
  },
];

export const BANK = {
  name: "Chase Business",
  accountType: "Checking",
  accountMask: "•••• 4421",
  balance: 64218.42,
};
