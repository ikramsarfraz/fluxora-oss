import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  categories,
  customerAddresses,
  customerProductPrices,
  customers,
  expenses,
  inventoryItems,
  lots,
  payments,
  platformUsers,
  portalUsers,
  productCategories,
  products,
  productSupplierCosts,
  productUnits,
  salesInvoiceLines,
  salesInvoices,
  salesOrderFulfillments,
  salesOrderLineAllocations,
  salesOrderLines,
  salesOrders,
  supplierInvoiceLines,
  supplierInvoices,
  suppliers,
  tenantBranding,
  tenants,
  unitsOfMeasure,
} from "./schema";
import { user } from "./auth-schema";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min: number, max: number, decimals = 4) {
  const num = Math.random() * (max - min) + min;
  return num.toFixed(decimals);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type UomSeed = {
  name: string;
  abbreviation: string | null;
  notes: string | null;
  sortOrder: number;
};

const UOM_DATA: UomSeed[] = [
  { name: "Pound", abbreviation: "lb", notes: null, sortOrder: 10 },
  {
    name: "Kilogram",
    abbreviation: "kg",
    notes: "1 kg = 2.2046 lb",
    sortOrder: 11,
  },
  { name: "Ounce", abbreviation: "oz", notes: "16 oz = 1 lb", sortOrder: 12 },
  { name: "Gram", abbreviation: "g", notes: "1000 g = 1 kg", sortOrder: 13 },
  {
    name: "Each",
    abbreviation: "ea",
    notes: "Single unit / piece",
    sortOrder: 20,
  },
  { name: "Case", abbreviation: "cs", notes: null, sortOrder: 21 },
  { name: "Half Case", abbreviation: "hcs", notes: null, sortOrder: 22 },
  { name: "Box", abbreviation: "bx", notes: null, sortOrder: 23 },
  { name: "Bag", abbreviation: "bag", notes: null, sortOrder: 24 },
  { name: "Pallet", abbreviation: "plt", notes: null, sortOrder: 25 },
  { name: "Tray", abbreviation: "tr", notes: null, sortOrder: 26 },
  { name: "Packet", abbreviation: "pkt", notes: null, sortOrder: 27 },
  { name: "Gallon", abbreviation: "gal", notes: null, sortOrder: 30 },
  { name: "Liter", abbreviation: "L", notes: null, sortOrder: 31 },
  {
    name: "Fluid Ounce",
    abbreviation: "fl oz",
    notes: "128 fl oz = 1 gal",
    sortOrder: 32,
  },
];

type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  defaultPricePerLb: string;
  baseUnit: string;
  uoms: Array<{
    unit: string;
    purpose: "stock" | "purchase" | "sales" | "pricing" | "display";
    isDefault?: boolean;
    conversionToBase: string;
    allowsFractional?: boolean;
    sortOrder?: number;
  }>;
};

const PRODUCT_DATA: ProductSeed[] = [
  {
    sku: "CHK-LEG-01",
    name: "Leg Quarter",
    category: "Chicken",
    defaultPricePerLb: "0.9500",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
        sortOrder: 1,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
        sortOrder: 1,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
        sortOrder: 1,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: true,
        sortOrder: 2,
      },
    ],
  },
  {
    sku: "CHK-BONE-01",
    name: "Boneless Thighs",
    category: "Chicken",
    defaultPricePerLb: "2.6000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "CHK-BONE-02",
    name: "Boneless Breast",
    category: "Chicken",
    defaultPricePerLb: "3.1000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "CHK-SPLI-01",
    name: "Split Wings",
    category: "Chicken",
    defaultPricePerLb: "2.1000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "BEF-TR-01",
    name: "TR Ground Beef",
    category: "Beef",
    defaultPricePerLb: "4.8900",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "OTH-2X20-01",
    name: "2x20 Gyros Cones",
    category: "Processed Foods",
    defaultPricePerLb: "133.0000",
    baseUnit: "Case",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
    ],
  },
  {
    sku: "CHK-CHIC-01",
    name: "Tenders",
    category: "Chicken",
    defaultPricePerLb: "2.9500",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "BEF-BRIS-02",
    name: "Brisket Short Rib",
    category: "Beef",
    defaultPricePerLb: "6.5500",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "65.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "65.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "65.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "BEF-BRIS-01",
    name: "Brisket Point Prime",
    category: "Beef",
    defaultPricePerLb: "5.3000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "65.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "65.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "65.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "OTH-CHIC-01",
    name: "Chicken Franks (Packet)",
    category: "Processed Foods",
    defaultPricePerLb: "8.0000",
    baseUnit: "Packet",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "24.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "24.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: false,
        conversionToBase: "24.0000",
        allowsFractional: false,
        sortOrder: 2,
      },
      {
        unit: "Packet",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
        sortOrder: 1,
      },
      {
        unit: "Packet",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
    ],
  },
  {
    sku: "LAM-LAMB-01",
    name: "Lamb Racks",
    category: "Lamb",
    defaultPricePerLb: "0.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "OTH-CHIC-02",
    name: "Chicken Hot Links (CASE)",
    category: "Processed Foods",
    defaultPricePerLb: "53.0000",
    baseUnit: "Case",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
    ],
  },
  {
    sku: "CHK-WHOL-01",
    name: "Whole Chicken",
    category: "Chicken",
    defaultPricePerLb: "1.8000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "CHK-WHOL-02",
    name: "Whole Wings",
    category: "Chicken",
    defaultPricePerLb: "2.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "CHK-DRUM-01",
    name: "Drumsticks",
    category: "Chicken",
    defaultPricePerLb: "1.4000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "BEF-CHUC-01",
    name: "Chuck Tender",
    category: "Beef",
    defaultPricePerLb: "5.1500",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "BEF-BEEF-01",
    name: "Beef Clod",
    category: "Beef",
    defaultPricePerLb: "5.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "LAM-BONE-01",
    name: "Boneless Lamb Leg",
    category: "Lamb",
    defaultPricePerLb: "0.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "LAM-LAMB-02",
    name: "Lamb Necks",
    category: "Lamb",
    defaultPricePerLb: "0.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "LAM-SQUA-01",
    name: "Square-Cut Shoulder",
    category: "Lamb",
    defaultPricePerLb: "0.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "45.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "OTH-SALA-01",
    name: "Salaam Cola Red",
    category: "Beverages",
    defaultPricePerLb: "14.7500",
    baseUnit: "Case",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
    ],
  },
  {
    sku: "OTH-SALA-02",
    name: "Salaam Cola Yemenade",
    category: "Beverages",
    defaultPricePerLb: "14.7500",
    baseUnit: "Case",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
    ],
  },
  {
    sku: "OTH-SALA-03",
    name: "Salaam Cola Orange",
    category: "Beverages",
    defaultPricePerLb: "14.7500",
    baseUnit: "Case",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
        allowsFractional: false,
      },
    ],
  },
  {
    sku: "CHK-JUMB-01",
    name: "Jumbo Breast",
    category: "Chicken",
    defaultPricePerLb: "3.1000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "40.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "BEF-BEEF-02",
    name: "Beef Knuckle",
    category: "Beef",
    defaultPricePerLb: "0.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
  {
    sku: "BEF-INSI-01",
    name: "Inside Round",
    category: "Beef",
    defaultPricePerLb: "0.0000",
    baseUnit: "Pound",
    uoms: [
      {
        unit: "Case",
        purpose: "stock",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "purchase",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Case",
        purpose: "sales",
        isDefault: true,
        conversionToBase: "60.0000",
        allowsFractional: false,
      },
      {
        unit: "Pound",
        purpose: "pricing",
        isDefault: true,
        conversionToBase: "1.0000",
      },
    ],
  },
];

const CUSTOMER_DATA = [
  {
    name: "NYC Shadeland",
    phone: "9012070629",
    prefix: "NYC",
    fuelSurchargeAmount: "5.00",
    street: "7407 Shadeland Ave",
    city: "Indianapolis",
    state: "IN",
    zip: "46250",
  },
  {
    name: "NYC (FOOD HUB)",
    phone: "9012070629",
    prefix: null,
    fuelSurchargeAmount: "5.00",
    street: "E County Line Rd",
    city: "Indianapolis",
    state: "IN",
    zip: "46227",
  },
  {
    name: "Mumbai Grill",
    phone: "3173191421",
    prefix: null,
    fuelSurchargeAmount: null,
    street: "E Main St",
    city: "Greenwood",
    state: "IN",
    zip: "46143",
  },
  {
    name: "Magoo's California Pizza",
    phone: "3146657049",
    prefix: "MP",
    fuelSurchargeAmount: "5.00",
    street: "10584 E US Hwy 36",
    city: "Indianapolis",
    state: "IN",
    zip: "46234",
  },
  {
    name: "Anab's Kitchen",
    phone: "3179376285",
    prefix: null,
    fuelSurchargeAmount: null,
    street: "4873 W 38th St Ste C",
    city: "Indianapolis",
    state: "IN",
    zip: "46254",
  },
  {
    name: "Kanoon Smoked Meat & Steakhouse",
    phone: "4632504999",
    prefix: null,
    fuelSurchargeAmount: null,
    street: "8594 E 116th St #30",
    city: "Fishers",
    state: "IN",
    zip: "46038",
  },
  {
    name: "AlHussnain",
    phone: "3173345003",
    prefix: null,
    fuelSurchargeAmount: null,
    street: "6620 Network Way",
    city: "Indianapolis",
    state: "IN",
    zip: "46278",
  },
  {
    name: "Shams Halal Market",
    phone: "6144487199",
    prefix: null,
    fuelSurchargeAmount: null,
    street: "5510 Lafayette Rd Suite 100",
    city: "Indianapolis",
    state: "IN",
    zip: "46254",
  },
  {
    name: "Halal Burgers",
    phone: null,
    prefix: null,
    fuelSurchargeAmount: null,
    street: null,
    city: null,
    state: null,
    zip: null,
  },
] as const;

const SUPPLIER_NAMES = [
  "Fatimah",
  "Madinah Traders",
  "Summit Traders",
  "Brewer Livestock",
] as const;

const CATEGORY_NAMES = [
  "Beef",
  "Chicken",
  "Lamb",
  "Processed Foods",
  "Beverages",
] as const;

async function findUomByName(name: string) {
  const row = await db.query.unitsOfMeasure.findFirst({
    where: eq(unitsOfMeasure.name, name),
  });
  if (!row) throw new Error(`Missing UOM: ${name}`);
  return row;
}

async function seedUoms() {
  for (const row of UOM_DATA) {
    await db
      .insert(unitsOfMeasure)
      .values({
        name: row.name,
        abbreviation: row.abbreviation,
        notes: row.notes,
        sortOrder: row.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing();
  }
}

async function seedAuthAndTenant() {
  const baseEmail = process.env.SEED_ADMIN_EMAIL?.trim() || "admin@example.com";

  await db
    .insert(user)
    .values({
      id: "seed-user",
      name: "Demo Owner",
      fullName: "Demo Owner",
      firstName: "Demo",
      lastName: "Owner",
      email: baseEmail,
      emailVerified: true,
    })
    .onConflictDoNothing();

  const authUser = await db.query.user.findFirst({
    where: eq(user.email, baseEmail),
  });
  if (!authUser) throw new Error("Failed to create/find auth user");

  await db
    .insert(platformUsers)
    .values({
      authUserId: authUser.id,
      role: "platform_admin",
    })
    .onConflictDoNothing();

  const tenantName = "Acme Distribution";
  const tenantSlug = slugify(tenantName);
  await db
    .insert(tenants)
    .values({
      name: tenantName,
      slug: tenantSlug,
      isActive: true,
    })
    .onConflictDoNothing();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, tenantSlug),
  });
  if (!tenant) throw new Error("Failed to create/find tenant");

  await db
    .insert(portalUsers)
    .values({
      authUserId: authUser.id,
      tenantId: tenant.id,
      fullName: "Demo Owner",
      email: baseEmail.replace("@", "+tenant1@"),
      role: "owner",
      isActive: true,
    })
    .onConflictDoNothing();

  const portalUser = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.authUserId, authUser.id),
      eq(portalUsers.tenantId, tenant.id),
    ),
  });
  if (!portalUser) throw new Error("Failed to create/find portal user");

  await db
    .insert(tenantBranding)
    .values({
      tenantId: tenant.id,
      companyLegalName: "Acme Distribution LLC",
      displayName: "Acme Distribution",
      primaryColor: "#0f172a",
      secondaryColor: "#334155",
      accentColor: "#16a34a",
      invoiceFooterText: "Thank you for your business.",
      invoiceNotesDefault: "Please remit payment by the due date.",
      createdByUserId: portalUser.id,
      updatedByUserId: portalUser.id,
    })
    .onConflictDoNothing();

  return { authUser, tenant, portalUser };
}

async function seedCustomers(tenantId: string, portalUserId: string) {
  for (const c of CUSTOMER_DATA) {
    await db
      .insert(customers)
      .values({
        tenantId,
        name: c.name,
        phoneNumber: c.phone,
        abbreviation: c.prefix,
        fuelSurchargeAmount: c.fuelSurchargeAmount,
        createdByUserId: portalUserId,
        updatedByUserId: portalUserId,
      })
      .onConflictDoNothing();
  }

  const rows = await db.query.customers.findMany({
    where: eq(customers.tenantId, tenantId),
  });
  for (const c of CUSTOMER_DATA) {
    const customer = rows.find(row => row.name === c.name);
    if (!customer || !c.street) continue;
    await db
      .insert(customerAddresses)
      .values({
        customerId: customer.id,
        addressType: "shipping",
        street: c.street,
        city: c.city,
        state: c.state,
        zip: c.zip,
        isDefault: true,
      })
      .onConflictDoNothing();
  }

  return await db.query.customers.findMany({
    where: eq(customers.tenantId, tenantId),
  });
}

async function seedSuppliers(tenantId: string, portalUserId: string) {
  for (const name of SUPPLIER_NAMES) {
    await db
      .insert(suppliers)
      .values({
        tenantId,
        name,
        createdByUserId: portalUserId,
        updatedByUserId: portalUserId,
      })
      .onConflictDoNothing();
  }
  return await db.query.suppliers.findMany({
    where: eq(suppliers.tenantId, tenantId),
  });
}

async function seedCategories(tenantId: string, portalUserId: string) {
  for (const name of CATEGORY_NAMES) {
    await db
      .insert(categories)
      .values({
        tenantId,
        name,
        slug: slugify(name),
        isActive: true,
        createdByUserId: portalUserId,
        updatedByUserId: portalUserId,
      })
      .onConflictDoNothing();
  }
  return await db.query.categories.findMany({
    where: eq(categories.tenantId, tenantId),
  });
}

async function seedProducts(
  tenantId: string,
  portalUserId: string,
  categoriesBySlug: Map<string, { id: string }>,
) {
  const uomCache = new Map<string, Awaited<ReturnType<typeof findUomByName>>>();
  async function getUom(name: string) {
    if (!uomCache.has(name)) uomCache.set(name, await findUomByName(name));
    return uomCache.get(name)!;
  }

  for (const p of PRODUCT_DATA) {
    const baseUnit = await getUom(p.baseUnit);

    await db
      .insert(products)
      .values({
        tenantId,
        sku: p.sku,
        name: p.name,
        defaultPricePerLb: p.defaultPricePerLb,
        baseUnitId: baseUnit.id,
        createdByUserId: portalUserId,
        updatedByUserId: portalUserId,
      })
      .onConflictDoNothing();

    const product = await db.query.products.findFirst({
      where: and(eq(products.tenantId, tenantId), eq(products.sku, p.sku)),
    });
    if (!product) throw new Error(`Failed to find product ${p.sku}`);

    const category = categoriesBySlug.get(slugify(p.category));
    if (category) {
      await db
        .insert(productCategories)
        .values({
          productId: product.id,
          categoryId: category.id,
        })
        .onConflictDoNothing();
    }

    for (const [idx, unitCfg] of p.uoms.entries()) {
      const unit = await getUom(unitCfg.unit);
      await db
        .insert(productUnits)
        .values({
          productId: product.id,
          unitId: unit.id,
          purpose: unitCfg.purpose,
          isDefault: unitCfg.isDefault ?? false,
          conversionToBase: unitCfg.conversionToBase,
          allowsFractional: unitCfg.allowsFractional ?? true,
          sortOrder: unitCfg.sortOrder ?? idx + 1,
        })
        .onConflictDoNothing();
    }
  }

  return await db.query.products.findMany({
    where: eq(products.tenantId, tenantId),
  });
}

async function seedProductPricing(
  productsRows: Awaited<ReturnType<typeof db.query.products.findMany>>,
  suppliersRows: Awaited<ReturnType<typeof db.query.suppliers.findMany>>,
  customersRows: Awaited<ReturnType<typeof db.query.customers.findMany>>,
) {
  for (const product of productsRows) {
    const supplier = suppliersRows[randomBetween(0, suppliersRows.length - 1)];
    const baseCost = Number(product.defaultPricePerLb || "0");
    await db
      .insert(productSupplierCosts)
      .values({
        productId: product.id,
        supplierId: supplier.id,
        costPerLb: (baseCost > 0 ? baseCost * 0.88 : 5).toFixed(4),
      })
      .onConflictDoNothing();

    for (const customer of customersRows) {
      await db
        .insert(customerProductPrices)
        .values({
          customerId: customer.id,
          productId: product.id,
          pricePerLb: (baseCost > 0 ? baseCost * 1.08 : 7).toFixed(4),
        })
        .onConflictDoNothing();
    }
  }
}

async function seedLotsAndInventory(
  tenantId: string,
  suppliersRows: Awaited<ReturnType<typeof db.query.suppliers.findMany>>,
  productsRows: Awaited<ReturnType<typeof db.query.products.findMany>>,
) {
  const seededLots: Array<{
    id: string;
    supplierId: string;
    lotNumber: string;
  }> = [];
  let lotCounter = 1;

  for (const supplier of suppliersRows) {
    const lotCount = randomBetween(3, 6);
    for (let i = 0; i < lotCount; i++) {
      const lotNumber = `LOT-${String(lotCounter).padStart(4, "0")}`;
      const receiveDate = addDays("2025-01-01", lotCounter * 3);
      const expirationDate = addDays(receiveDate, 180);
      await db
        .insert(lots)
        .values({
          tenantId,
          supplierId: supplier.id,
          lotNumber,
          receiveDate,
          expirationDate,
        })
        .onConflictDoNothing();

      const lot = await db.query.lots.findFirst({
        where: and(eq(lots.tenantId, tenantId), eq(lots.lotNumber, lotNumber)),
      });
      if (!lot) throw new Error(`Failed to create/find lot ${lotNumber}`);
      seededLots.push({ id: lot.id, supplierId: supplier.id, lotNumber });
      lotCounter += 1;
    }
  }

  let inventoryCounter = 1;
  const targetInventoryItems = 900;
  for (let i = 0; i < targetInventoryItems; i++) {
    const product = productsRows[randomBetween(0, productsRows.length - 1)];
    const lot = seededLots[randomBetween(0, seededLots.length - 1)];
    const barcodeId = `BC-${String(inventoryCounter).padStart(6, "0")}`;
    const weight = product.sku.startsWith("CHK-")
      ? randomDecimal(35, 80, 4)
      : product.sku.startsWith("BEF-")
        ? randomDecimal(45, 110, 4)
        : product.sku.startsWith("LAM-")
          ? randomDecimal(30, 70, 4)
          : randomDecimal(8, 25, 4);
    const cases = product.sku.startsWith("OTH-") ? randomBetween(1, 4) : 1;
    const costUnitTypeSnapshot = product.sku.startsWith("OTH-")
      ? "fixed_case"
      : "catch_weight";
    const costPerUnitSnapshot =
      costUnitTypeSnapshot === "fixed_case"
        ? randomDecimal(18, 42, 6)
        : randomDecimal(2, 8, 6);

    await db
      .insert(inventoryItems)
      .values({
        productId: product.id,
        lotId: lot.id,
        barcodeId,
        exactWeightLbs: weight,
        cases,
        costPerUnitSnapshot,
        costUnitTypeSnapshot,
        status: "in_stock",
      })
      .onConflictDoNothing();

    inventoryCounter += 1;
  }

  return {
    lots: await db.query.lots.findMany({ where: eq(lots.tenantId, tenantId) }),
    inventory: await db.query.inventoryItems.findMany(),
  };
}

async function getDefaultProductUnit(
  productId: string,
  purpose: "sales" | "pricing" | "stock" | "purchase",
) {
  const preferred = await db.query.productUnits.findFirst({
    where: and(
      eq(productUnits.productId, productId),
      eq(productUnits.purpose, purpose),
      eq(productUnits.isDefault, true),
    ),
  });
  if (preferred) return preferred;
  return db.query.productUnits.findFirst({
    where: and(
      eq(productUnits.productId, productId),
      eq(productUnits.purpose, purpose),
    ),
  });
}

async function seedSupplierInvoices(
  tenantId: string,
  portalUserId: string,
  suppliersRows: Awaited<ReturnType<typeof db.query.suppliers.findMany>>,
  productsRows: Awaited<ReturnType<typeof db.query.products.findMany>>,
) {
  let invoiceCounter = 1001;
  for (const supplier of suppliersRows) {
    const invoiceCount = 2;
    for (let i = 0; i < invoiceCount; i++) {
      const invoiceNumber = `SUP-${invoiceCounter}`;
      const referenceNumber = `IB-${String(invoiceCounter).padStart(6, "0")}`;
      const invoiceDate = addDays("2025-01-05", invoiceCounter - 1000);

      await db
        .insert(supplierInvoices)
        .values({
          tenantId,
          supplierId: supplier.id,
          referenceNumber,
          invoiceNumber,
          invoiceDate,
          receiveDate: invoiceDate,
          status: "completed",
          totalAmount: "0.0000",
          amountPaid: i === 0 ? "0.00" : "250.00",
          paymentMethod: i === 0 ? null : "check",
          notes: "Seeded supplier invoice",
          createdByUserId: portalUserId,
          updatedByUserId: portalUserId,
        })
        .onConflictDoNothing();

      const invoice = await db.query.supplierInvoices.findFirst({
        where: and(
          eq(supplierInvoices.tenantId, tenantId),
          eq(supplierInvoices.invoiceNumber, invoiceNumber),
        ),
      });
      if (!invoice)
        throw new Error(
          `Failed to create/find supplier invoice ${invoiceNumber}`,
        );

      const shuffled = [...productsRows]
        .sort(() => Math.random() - 0.5)
        .slice(0, randomBetween(3, 5));
      let invoiceTotal = 0;
      for (const product of shuffled) {
        const lineType = product.sku.startsWith("OTH-")
          ? "fixed_case"
          : "catch_weight";
        const quantityCases = randomBetween(1, 5);
        const weightLbs =
          lineType === "catch_weight" ? randomDecimal(40, 200, 4) : "0.0000";
        const unitPrice =
          lineType === "catch_weight"
            ? (Number(product.defaultPricePerLb || "0") || 5).toFixed(4)
            : (Number(product.defaultPricePerLb || "0") || 25).toFixed(4);
        const lineTotal =
          lineType === "catch_weight"
            ? (Number(weightLbs) * Number(unitPrice)).toFixed(4)
            : (quantityCases * Number(unitPrice)).toFixed(4);
        invoiceTotal += Number(lineTotal);

        await db.insert(supplierInvoiceLines).values({
          supplierInvoiceId: invoice.id,
          productId: product.id,
          quantityCases,
          weightLbs,
          unitPrice,
          lineTotal,
          unitType: lineType,
          caseWeightsLbs: lineType === "catch_weight" ? "10,10,10,10" : null,
        });
      }

      await db
        .update(supplierInvoices)
        .set({
          totalAmount: invoiceTotal.toFixed(4),
          updatedByUserId: portalUserId,
        })
        .where(eq(supplierInvoices.id, invoice.id));

      invoiceCounter += 1;
    }
  }
}

async function seedSalesOrders(
  tenantId: string,
  portalUserId: string,
  customersRows: Awaited<ReturnType<typeof db.query.customers.findMany>>,
  productsRows: Awaited<ReturnType<typeof db.query.products.findMany>>,
  inventoryRows: Awaited<ReturnType<typeof db.query.inventoryItems.findMany>>,
  lotsRows: Awaited<ReturnType<typeof db.query.lots.findMany>>,
) {
  const ordersToCreate = [
    {
      orderNumber: "SO-1001",
      status: "sales_order" as const,
      invoice: false,
      payment: false,
      fulfillmentMode: "none" as const,
    },
    {
      orderNumber: "SO-1002",
      status: "confirmed" as const,
      invoice: false,
      payment: false,
      fulfillmentMode: "allocations" as const,
    },
    {
      orderNumber: "SO-1003",
      status: "confirmed" as const,
      invoice: false,
      payment: false,
      fulfillmentMode: "partial" as const,
    },
    {
      orderNumber: "SO-1004",
      status: "fulfilled" as const,
      invoice: true,
      payment: true,
      fulfillmentMode: "closed" as const,
    },
  ];

  let invoiceCounter = 1001;

  for (let idx = 0; idx < ordersToCreate.length; idx++) {
    const orderSeed = ordersToCreate[idx];
    const customer = customersRows[idx % customersRows.length];
    const orderDate = addDays("2025-02-01", idx * 3);
    const dueDate = addDays(orderDate, 7);

    await db
      .insert(salesOrders)
      .values({
        tenantId,
        orderNumber: orderSeed.orderNumber,
        customerId: customer.id,
        orderDate,
        dueDate,
        status: orderSeed.status,
        addFuelSurcharge: Boolean(customer.fuelSurchargeAmount),
        customerNotes: idx === 0 ? "Call before delivery" : null,
        internalNotes: idx === 1 ? "Seeded allocation-heavy order" : null,
        createdByUserId: portalUserId,
        updatedByUserId: portalUserId,
      })
      .onConflictDoNothing();

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.tenantId, tenantId),
        eq(salesOrders.orderNumber, orderSeed.orderNumber),
      ),
    });
    if (!order)
      throw new Error(
        `Failed to create/find sales order ${orderSeed.orderNumber}`,
      );

    const selectedProducts = [...productsRows]
      .sort(() => Math.random() - 0.5)
      .slice(0, randomBetween(3, 5));
    const createdLines: Array<{
      id: string;
      productId: string;
      expectedCases: number;
      lineType: "catch_weight" | "fixed_case";
    }> = [];

    for (const product of selectedProducts) {
      const salesUnit = await getDefaultProductUnit(product.id, "sales");
      const pricingUnit = await getDefaultProductUnit(product.id, "pricing");
      const baseUnit = product.baseUnitId
        ? await db.query.unitsOfMeasure.findFirst({
            where: eq(unitsOfMeasure.id, product.baseUnitId),
          })
        : null;

      const lineType = product.sku.startsWith("OTH-")
        ? "fixed_case"
        : "catch_weight";
      const expectedCases = randomBetween(2, 8);

      const inserted = await db
        .insert(salesOrderLines)
        .values({
          salesOrderId: order.id,
          productId: product.id,
          salesUnitId: salesUnit?.unitId ?? null,
          conversionToBaseSnapshot: salesUnit?.conversionToBase ?? null,
          baseUnitIdSnapshot: product.baseUnitId ?? null,
          salesUnitNameSnapshot: salesUnit
            ? ((
                await db.query.unitsOfMeasure.findFirst({
                  where: eq(unitsOfMeasure.id, salesUnit.unitId),
                })
              )?.name ?? null)
            : null,
          salesUnitAbbreviationSnapshot: salesUnit
            ? ((
                await db.query.unitsOfMeasure.findFirst({
                  where: eq(unitsOfMeasure.id, salesUnit.unitId),
                })
              )?.abbreviation ?? null)
            : null,
          expectedCases,
          fulfilledCases: 0,
          unitType: lineType,
          totalBilledWeightLbs: "0.0000",
          pricePerLbOverride: pricingUnit
            ? product.defaultPricePerLb
            : product.defaultPricePerLb,
          caseWeightsLbs: null,
        })
        .returning({ id: salesOrderLines.id });

      createdLines.push({
        id: inserted[0].id,
        productId: product.id,
        expectedCases,
        lineType,
      });
    }

    for (const line of createdLines) {
      const candidates = inventoryRows
        .filter(
          inv => inv.productId === line.productId && inv.status === "in_stock",
        )
        .slice(0, line.expectedCases);
      const allocationsToCreate =
        orderSeed.fulfillmentMode === "none"
          ? []
          : candidates.slice(
              0,
              Math.min(candidates.length, line.expectedCases),
            );

      for (const inv of allocationsToCreate) {
        await db
          .insert(salesOrderLineAllocations)
          .values({
            salesOrderLineId: line.id,
            inventoryItemId: inv.id,
            allocatedWeightLbs: inv.exactWeightLbs,
          })
          .onConflictDoNothing();
      }

      if (orderSeed.fulfillmentMode === "allocations") {
        // leave as allocations only
        continue;
      }

      if (orderSeed.fulfillmentMode === "partial") {
        const fulfillCount = Math.min(
          allocationsToCreate.length,
          Math.max(1, Math.floor(line.expectedCases / 2)),
        );
        const fulfillInv = allocationsToCreate.slice(0, fulfillCount);
        let totalWeight = 0;
        for (const inv of fulfillInv) {
          totalWeight += Number(inv.exactWeightLbs);
          const lot = lotsRows.find(l => l.id === inv.lotId) ?? null;
          await db.insert(salesOrderFulfillments).values({
            salesOrderId: order.id,
            salesOrderLineId: line.id,
            quantityFulfilled: 1,
            weightLbs:
              line.lineType === "catch_weight" ? inv.exactWeightLbs : null,
            fulfilledByUserId: portalUserId,
            fulfilledAt: new Date(),
            notes: "Seeded partial fulfillment",
            inventoryItemId: inv.id,
            lotId: lot?.id ?? null,
          });
          await db
            .update(inventoryItems)
            .set({ status: "shipped" })
            .where(eq(inventoryItems.id, inv.id));
        }
        await db
          .update(salesOrderLines)
          .set({
            fulfilledCases: fulfillCount,
            totalBilledWeightLbs: totalWeight.toFixed(4),
          })
          .where(eq(salesOrderLines.id, line.id));
        continue;
      }

      if (orderSeed.fulfillmentMode === "closed") {
        const fulfillInv = allocationsToCreate.slice(
          0,
          Math.min(allocationsToCreate.length, line.expectedCases),
        );
        let totalWeight = 0;
        for (const inv of fulfillInv) {
          totalWeight += Number(inv.exactWeightLbs);
          const lot = lotsRows.find(l => l.id === inv.lotId) ?? null;
          await db.insert(salesOrderFulfillments).values({
            salesOrderId: order.id,
            salesOrderLineId: line.id,
            quantityFulfilled: 1,
            weightLbs:
              line.lineType === "catch_weight" ? inv.exactWeightLbs : null,
            fulfilledByUserId: portalUserId,
            fulfilledAt: new Date(),
            notes: "Seeded fulfilled order",
            inventoryItemId: inv.id,
            lotId: lot?.id ?? null,
          });
          await db
            .update(inventoryItems)
            .set({ status: orderSeed.invoice ? "sold" : "shipped" })
            .where(eq(inventoryItems.id, inv.id));
        }

        const shortShip = line.expectedCases > fulfillInv.length;
        await db
          .update(salesOrderLines)
          .set({
            fulfilledCases: fulfillInv.length,
            totalBilledWeightLbs: totalWeight.toFixed(4),
            shortShippedAt: shortShip ? new Date() : null,
            shortShippedByUserId: shortShip ? portalUserId : null,
            shortShipNotes: shortShip ? "Seeded short shipment" : null,
          })
          .where(eq(salesOrderLines.id, line.id));
      }
    }

    if (orderSeed.invoice) {
      const seededLines = await db.query.salesOrderLines.findMany({
        where: eq(salesOrderLines.salesOrderId, order.id),
      });
      const subtotal = seededLines.reduce((sum, line) => {
        const price = Number(line.pricePerLbOverride ?? 0);
        const billed = Number(line.totalBilledWeightLbs ?? 0);
        return sum + billed * price;
      }, 0);
      const fuelSurcharge = Number(customer.fuelSurchargeAmount ?? 0);
      const totalAmount = subtotal + fuelSurcharge;
      const invoiceNumber = `INV-${invoiceCounter}`;

      await db
        .insert(salesInvoices)
        .values({
          tenantId,
          invoiceNumber,
          salesOrderId: order.id,
          customerId: customer.id,
          invoiceDate: addDays(orderDate, 1),
          dueDate: addDays(orderDate, 8),
          status: orderSeed.payment ? "partially_paid" : "sent",
          subtotal: subtotal.toFixed(2),
          discountAmount: "0.00",
          creditAmount: "0.00",
          fuelSurchargeAmount: fuelSurcharge.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          amountPaid: orderSeed.payment
            ? (totalAmount * 0.5).toFixed(2)
            : "0.00",
          balanceDue: orderSeed.payment
            ? (totalAmount * 0.5).toFixed(2)
            : totalAmount.toFixed(2),
          createdByUserId: portalUserId,
          updatedByUserId: portalUserId,
        })
        .onConflictDoNothing();

      const invoice = await db.query.salesInvoices.findFirst({
        where: and(
          eq(salesInvoices.tenantId, tenantId),
          eq(salesInvoices.invoiceNumber, invoiceNumber),
        ),
      });
      if (!invoice)
        throw new Error(`Failed to create/find sales invoice ${invoiceNumber}`);

      for (const line of seededLines) {
        const product = productsRows.find(p => p.id === line.productId)!;
        const lineTotal = (
          Number(line.totalBilledWeightLbs) *
          Number(line.pricePerLbOverride ?? product.defaultPricePerLb)
        ).toFixed(2);
        await db.insert(salesInvoiceLines).values({
          salesInvoiceId: invoice.id,
          productId: product.id,
          quantityCases: line.fulfilledCases,
          billedWeightLbs: line.totalBilledWeightLbs,
          unitPrice: line.pricePerLbOverride ?? product.defaultPricePerLb,
          lineTotal,
        });
      }

      if (orderSeed.payment) {
        await db.insert(payments).values({
          tenantId,
          salesInvoiceId: invoice.id,
          paymentDate: addDays(orderDate, 2),
          amount: (totalAmount * 0.5).toFixed(2),
          paymentMethod: "ach",
          referenceNumber: `ACH-${invoiceCounter}`,
          notes: "Seeded partial payment",
          createdByUserId: portalUserId,
        });
      }

      invoiceCounter += 1;
    }
  }
}

async function seedExpenses(tenantId: string, portalUserId: string) {
  const expenseRows = [
    {
      expenseDate: "2025-02-11",
      category: "rent",
      amount: "13000.00",
      paymentMethod: "check" as const,
      note: null,
    },
    {
      expenseDate: "2025-02-15",
      category: "fuel",
      amount: "520.35",
      paymentMethod: "credit_card" as const,
      note: "Delivery fuel",
    },
    {
      expenseDate: "2025-02-18",
      category: "packaging",
      amount: "214.90",
      paymentMethod: "cash" as const,
      note: "Boxes and labels",
    },
  ];

  for (const row of expenseRows) {
    await db
      .insert(expenses)
      .values({
        tenantId,
        expenseDate: row.expenseDate,
        category: row.category,
        amount: row.amount,
        paymentMethod: row.paymentMethod,
        note: row.note,
        createdByUserId: portalUserId,
      })
      .onConflictDoNothing();
  }
}

async function main() {
  console.log("Seeding updated UUID/UOM schema...");

  await seedUoms();
  const { tenant, portalUser } = await seedAuthAndTenant();
  const customersRows = await seedCustomers(tenant.id, portalUser.id);
  const suppliersRows = await seedSuppliers(tenant.id, portalUser.id);
  const categoriesRows = await seedCategories(tenant.id, portalUser.id);
  const categoriesBySlug = new Map(
    categoriesRows.map(c => [c.slug, { id: c.id }]),
  );
  const productsRows = await seedProducts(
    tenant.id,
    portalUser.id,
    categoriesBySlug,
  );

  await seedProductPricing(productsRows, suppliersRows, customersRows);
  const { lots: lotsRows, inventory: inventoryRows } =
    await seedLotsAndInventory(tenant.id, suppliersRows, productsRows);
  await seedSupplierInvoices(
    tenant.id,
    portalUser.id,
    suppliersRows,
    productsRows,
  );
  await seedSalesOrders(
    tenant.id,
    portalUser.id,
    customersRows,
    productsRows,
    inventoryRows,
    lotsRows,
  );
  await seedExpenses(tenant.id, portalUser.id);

  console.log("Seed complete ✅");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
