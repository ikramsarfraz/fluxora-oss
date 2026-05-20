export const TENANT = {
  name: "Pacific Wharf Provisions",
  tagline: "Fresh seafood & specialty foods",
  address1: "312 Tiburon Blvd",
  address2: "Tiburon, CA 94920",
  email: "billing@pacificwharf.com",
  phone: "(415) 555-0142",
  primaryHex: "#1F3A2E",
};

export const CUSTOMER = {
  name: "Anchor Tavern",
  attn: "Mateo Rivera",
  city: "Tiburon",
  state: "CA",
  zip: "94920",
  terms: "Net 7",
};

export const INVOICE = {
  number: "INV-2847",
  poNumber: "PO-AT-0518",
  issueDate: "May 19, 2026",
  dueDate: "May 26, 2026",
};

export const LINES = [
  {
    description: "Atlantic salmon — 4 lb fillets",
    qty: 32,
    unit: "lb",
    price: 11.5,
  },
  {
    description: "Wagyu ribeye — 8 oz portion",
    qty: 14,
    unit: "ea",
    price: 32.0,
  },
  {
    description: "Heirloom tomatoes — case",
    qty: 8,
    unit: "case",
    price: 38.0,
  },
];

export const SUBTOTAL = LINES.reduce((s, l) => s + l.qty * l.price, 0);
export const TAX = SUBTOTAL * 0.0875;
export const TOTAL = SUBTOTAL + TAX;
