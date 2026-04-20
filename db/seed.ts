import { and, eq } from "drizzle-orm";
import { db } from "./index";

import {
  tenants,
  portalUsers,
  platformUsers,
  suppliers,
  customers,
  customerAddresses,
  categories,
  products,
  productCategories,
  productSupplierCosts,
  customerProductPrices,
  lots,
  inventoryItems,
  supplierInvoices,
  supplierInvoiceLines,
  salesOrders,
  salesOrderLines,
  salesInvoices,
  payments,
  expenses,
} from "./schema";

import { user } from "./auth-schema";

type InsertedLot = {
  id: number;
  supplierId: number;
  lotNumber: string;
};

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

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickManyUnique<T>(items: T[], count: number): T[] {
  const copy = [...items];
  const picked: T[] = [];
  const target = Math.min(count, copy.length);

  while (picked.length < target) {
    const idx = Math.floor(Math.random() * copy.length);
    const [item] = copy.splice(idx, 1);
    picked.push(item);
  }

  return picked;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  console.log("Seeding...");

  const baseEmail = "admin@example.com";
  const tenantMembershipEmail = "admin+tenant1@example.com";
  const tenantName = "Acme Distribution";
  const tenantSlug = slugify(tenantName);

  await db
    .insert(user)
    .values({
      id: "seed-user",
      name: "Demo Owner",
      email: baseEmail,
      emailVerified: true,
    })
    .onConflictDoNothing();

  const authUser = await db.query.user.findFirst({
    where: eq(user.email, baseEmail),
  });

  if (!authUser) {
    throw new Error("Failed to create/find auth user");
  }

  await db
    .insert(platformUsers)
    .values({
      authUserId: authUser.id,
      role: "platform_admin",
    })
    .onConflictDoNothing();

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

  if (!tenant) {
    throw new Error("Failed to create/find tenant");
  }

  await db
    .insert(portalUsers)
    .values({
      authUserId: authUser.id,
      tenantId: tenant.id,
      fullName: "Demo Owner",
      email: tenantMembershipEmail,
      role: "owner",
    })
    .onConflictDoNothing();

  const portalUser = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.authUserId, authUser.id),
      eq(portalUsers.tenantId, tenant.id),
    ),
  });

  if (!portalUser) {
    throw new Error("Failed to create/find portal membership");
  }

  const supplierNames = [
    "Fatimah",
    "Madinah Traders",
    "Summit Traders",
    "Brewer Livestock",
  ];

  for (const name of supplierNames) {
    await db
      .insert(suppliers)
      .values({
        tenantId: tenant.id,
        name,
      })
      .onConflictDoNothing();
  }

  const allSuppliers = await db.query.suppliers.findMany({
    where: eq(suppliers.tenantId, tenant.id),
  });

  const customerData = [
    {
      name: "NYC Shadeland",
      phoneNumber: "9012070629",
      street: "7407 Shadeland Ave",
      city: "Indianapolis",
      state: "IN",
      zip: "46250",
      fuelSurchargeAmount: "5.00",
      invoicePrefix: "NYC",
    },
    {
      name: "NYC (FOOD HUB)",
      phoneNumber: "9012070629",
      street: "E County Line Rd",
      city: "Indianapolis",
      state: "IN",
      zip: "46227",
      fuelSurchargeAmount: "5.00",
      invoicePrefix: null,
    },
    {
      name: "Mumbai Grill",
      phoneNumber: "3173191421",
      street: "E Main St",
      city: "Greenwood",
      state: "IN",
      zip: "46143",
      fuelSurchargeAmount: null,
      invoicePrefix: null,
    },
    {
      name: "Magoo's California Pizza",
      phoneNumber: "3146657049",
      street: "10584 E US Hwy 36",
      city: "Indianapolis",
      state: "IN",
      zip: "46234",
      fuelSurchargeAmount: "5.00",
      invoicePrefix: "MP",
    },
    {
      name: "Anab's Kitchen",
      phoneNumber: "3179376285",
      street: "4873 W 38th St ste c",
      city: "Indianapolis",
      state: "IN",
      zip: "46254",
      fuelSurchargeAmount: null,
      invoicePrefix: null,
    },
    {
      name: "Kanoon Smoked Meat & Steakhouse",
      phoneNumber: "4632504999",
      street: "8594 E 116th St # 30",
      city: "Fishers",
      state: "IN",
      zip: "46038",
      fuelSurchargeAmount: null,
      invoicePrefix: null,
    },
    {
      name: "AlHussnain",
      phoneNumber: "3173345003",
      street: "6620 Network Way",
      city: "Indianapolis",
      state: "IN",
      zip: "46278",
      fuelSurchargeAmount: null,
      invoicePrefix: null,
    },
    {
      name: "Shams Halal Market",
      phoneNumber: "6144487199",
      street: "5510 Lafayette Rd Suite 100",
      city: "Indianapolis",
      state: "IN",
      zip: "46254",
      fuelSurchargeAmount: null,
      invoicePrefix: null,
    },
    {
      name: "Halal Burgers",
      phoneNumber: null,
      street: null,
      city: null,
      state: null,
      zip: null,
      fuelSurchargeAmount: null,
      invoicePrefix: null,
    },
  ];

  for (const customer of customerData) {
    await db
      .insert(customers)
      .values({
        tenantId: tenant.id,
        name: customer.name,
        phoneNumber: customer.phoneNumber,
        fuelSurchargeAmount: customer.fuelSurchargeAmount,
        invoicePrefix: customer.invoicePrefix,
      })
      .onConflictDoNothing();
  }

  const allCustomers = await db.query.customers.findMany({
    where: eq(customers.tenantId, tenant.id),
  });

  for (const customer of customerData) {
    const dbCustomer = allCustomers.find(item => item.name === customer.name);
    if (!dbCustomer || !customer.street) continue;

    const existingAddress = await db.query.customerAddresses.findFirst({
      where: and(
        eq(customerAddresses.customerId, dbCustomer.id),
        eq(customerAddresses.addressType, "shipping"),
        eq(customerAddresses.isDefault, true),
      ),
    });

    if (!existingAddress) {
      await db.insert(customerAddresses).values({
        customerId: dbCustomer.id,
        addressType: "shipping",
        street: customer.street,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        isDefault: true,
      });
    }
  }

  const categoryNames = [
    "Beef",
    "Chicken",
    "Lamb",
    "Processed Foods",
    "Beverages",
  ];

  for (const name of categoryNames) {
    await db
      .insert(categories)
      .values({
        tenantId: tenant.id,
        name,
        slug: slugify(name),
        isActive: true,
      })
      .onConflictDoNothing();
  }

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.tenantId, tenant.id),
  });

  const productData = [
    {
      sku: "CHK-LEG-01",
      name: "Leg Quarter",
      price: "0.9500",
      category: "Chicken",
    },
    {
      sku: "CHK-BONE-01",
      name: "Boneless Thighs",
      price: "2.6000",
      category: "Chicken",
    },
    {
      sku: "CHK-BONE-02",
      name: "Boneless Breast",
      price: "3.1000",
      category: "Chicken",
    },
    {
      sku: "CHK-SPLI-01",
      name: "Split Wings",
      price: "2.1000",
      category: "Chicken",
    },
    {
      sku: "BEF-TR-01",
      name: "TR Ground Beef",
      price: "4.8900",
      category: "Beef",
    },
    {
      sku: "OTH-2X20-01",
      name: "2x20 Gyros Cones",
      price: "133.0000",
      category: "Processed Foods",
    },
    {
      sku: "CHK-CHIC-01",
      name: "Tenders",
      price: "2.9500",
      category: "Chicken",
    },
    {
      sku: "BEF-BRIS-02",
      name: "Brisket Short Rib",
      price: "6.5500",
      category: "Beef",
    },
    {
      sku: "BEF-BRIS-01",
      name: "Brisket Point Prime",
      price: "5.3000",
      category: "Beef",
    },
    {
      sku: "OTH-CHIC-01",
      name: "Chicken Franks (Packet)",
      price: "8.0000",
      category: "Processed Foods",
    },
    {
      sku: "LAM-LAMB-01",
      name: "Lamb Racks",
      price: "0.0000",
      category: "Lamb",
    },
    {
      sku: "OTH-CHIC-02",
      name: "Chicken Hot Links (CASE)",
      price: "53.0000",
      category: "Processed Foods",
    },
    {
      sku: "CHK-WHOL-01",
      name: "Whole Chicken",
      price: "1.8000",
      category: "Chicken",
    },
    {
      sku: "CHK-WHOL-02",
      name: "Whole Wings",
      price: "2.0000",
      category: "Chicken",
    },
    {
      sku: "CHK-DRUM-01",
      name: "Drumsticks",
      price: "1.4000",
      category: "Chicken",
    },
    {
      sku: "BEF-CHUC-01",
      name: "Chuck Tender",
      price: "5.1500",
      category: "Beef",
    },
    {
      sku: "BEF-BEEF-01",
      name: "Beef Clod",
      price: "5.0000",
      category: "Beef",
    },
    {
      sku: "LAM-BONE-01",
      name: "Boneless Lamb Leg",
      price: "0.0000",
      category: "Lamb",
    },
    {
      sku: "LAM-LAMB-02",
      name: "Lamb Necks",
      price: "0.0000",
      category: "Lamb",
    },
    {
      sku: "LAM-SQUA-01",
      name: "Square-Cut Shoulder",
      price: "0.0000",
      category: "Lamb",
    },
    {
      sku: "OTH-SALA-01",
      name: "Salaam Cola Red",
      price: "14.7500",
      category: "Beverages",
    },
    {
      sku: "OTH-SALA-02",
      name: "Salaam Cola Yemenade",
      price: "14.7500",
      category: "Beverages",
    },
    {
      sku: "OTH-SALA-03",
      name: "Salaam Cola Orange",
      price: "14.7500",
      category: "Beverages",
    },
    {
      sku: "CHK-JUMB-01",
      name: "Jumbo Breast",
      price: "3.1000",
      category: "Chicken",
    },
    {
      sku: "BEF-BEEF-02",
      name: "Beef Knuckle",
      price: "0.0000",
      category: "Beef",
    },
    {
      sku: "BEF-INSI-01",
      name: "Inside Round",
      price: "0.0000",
      category: "Beef",
    },
  ];

  for (const product of productData) {
    await db
      .insert(products)
      .values({
        tenantId: tenant.id,
        sku: product.sku,
        name: product.name,
        defaultPricePerLb: product.price,
      })
      .onConflictDoNothing();

    const dbProduct = await db.query.products.findFirst({
      where: and(
        eq(products.tenantId, tenant.id),
        eq(products.sku, product.sku),
      ),
    });

    const category = allCategories.find(
      item => item.slug === slugify(product.category),
    );

    if (dbProduct && category) {
      await db
        .insert(productCategories)
        .values({
          productId: dbProduct.id,
          categoryId: category.id,
        })
        .onConflictDoNothing();
    }
  }

  const allProducts = await db.query.products.findMany({
    where: eq(products.tenantId, tenant.id),
  });

  const supplierCostMap: Record<string, string> = {
    "BEF-BRIS-02": "6.5500",
    "BEF-TR-01": "4.8900",
    "CHK-CHIC-01": "2.9500",
    "BEF-BRIS-01": "5.3000",
    "CHK-BONE-01": "2.6000",
    "CHK-LEG-01": "0.9500",
    "CHK-BONE-02": "3.1000",
    "CHK-SPLI-01": "2.1000",
    "BEF-BEEF-01": "5.0000",
    "BEF-CHUC-01": "5.1500",
    "CHK-DRUM-01": "1.4000",
    "CHK-WHOL-01": "1.8000",
    "CHK-WHOL-02": "2.0000",
    "OTH-CHIC-02": "53.0000",
    "OTH-SALA-01": "14.7500",
    "OTH-SALA-02": "14.7500",
    "OTH-SALA-03": "14.7500",
    "CHK-JUMB-01": "3.1000",
    "BEF-BEEF-02": "5.5700",
    "LAM-LAMB-02": "4.2400",
    "LAM-BONE-01": "6.7800",
    "LAM-SQUA-01": "4.6000",
  };

  for (const product of allProducts) {
    const preferredSupplier = product.sku.startsWith("CHK-")
      ? allSuppliers.find(s => s.name === "Madinah Traders")
      : product.sku.startsWith("LAM-")
        ? allSuppliers.find(s => s.name === "Brewer Livestock")
        : product.sku.startsWith("OTH-")
          ? allSuppliers.find(s => s.name === "Fatimah")
          : allSuppliers.find(s => s.name === "Fatimah");

    const supplier = preferredSupplier ?? allSuppliers[0];
    const costPerLb =
      supplierCostMap[product.sku] ??
      (Number(product.defaultPricePerLb) > 0
        ? (Number(product.defaultPricePerLb) * 0.9).toFixed(4)
        : "5.0000");

    await db
      .insert(productSupplierCosts)
      .values({
        productId: product.id,
        supplierId: supplier.id,
        costPerLb,
      })
      .onConflictDoNothing();
  }

  for (const customer of allCustomers) {
    for (const product of allProducts) {
      if (Math.random() >= 0.7) continue;

      const base = Number(product.defaultPricePerLb ?? "0");
      const pricePerLb = base > 0 ? (base * 1.08).toFixed(4) : "0.0000";

      await db
        .insert(customerProductPrices)
        .values({
          customerId: customer.id,
          productId: product.id,
          pricePerLb,
        })
        .onConflictDoNothing();
    }
  }

  const seededLots: InsertedLot[] = [];
  let lotCounter = 1;

  for (const supplier of allSuppliers) {
    const lotsForSupplier = randomBetween(4, 8);

    for (let i = 0; i < lotsForSupplier; i++) {
      const lotNumber = `LOT-${String(lotCounter).padStart(4, "0")}`;
      const receiveDate = addDays("2025-01-01", lotCounter * 3);
      const expirationDate = addDays(receiveDate, 180);

      await db
        .insert(lots)
        .values({
          tenantId: tenant.id,
          lotNumber,
          supplierId: supplier.id,
          receiveDate,
          expirationDate,
        })
        .onConflictDoNothing();

      const lot = await db.query.lots.findFirst({
        where: and(eq(lots.tenantId, tenant.id), eq(lots.lotNumber, lotNumber)),
      });

      if (!lot) {
        throw new Error(`Failed to create/find lot ${lotNumber}`);
      }

      seededLots.push({
        id: lot.id,
        supplierId: supplier.id,
        lotNumber,
      });

      lotCounter++;
    }
  }

  let supplierInvoiceCounter = 1;

  for (const supplier of allSuppliers) {
    const invoiceCount = randomBetween(2, 4);

    for (let i = 0; i < invoiceCount; i++) {
      const invoiceNumber = `SUP-${String(supplierInvoiceCounter).padStart(4, "0")}`;
      const invoiceDate = addDays("2025-01-05", supplierInvoiceCounter * 5);

      await db
        .insert(supplierInvoices)
        .values({
          tenantId: tenant.id,
          supplierId: supplier.id,
          invoiceNumber,
          invoiceDate,
          totalAmount: "0.0000",
          amountPaid: "0.00",
          paymentMethod: null,
          notes: null,
          createdByUserId: portalUser.id,
        })
        .onConflictDoNothing();

      const supplierInvoice = await db.query.supplierInvoices.findFirst({
        where: and(
          eq(supplierInvoices.tenantId, tenant.id),
          eq(supplierInvoices.invoiceNumber, invoiceNumber),
        ),
      });

      if (!supplierInvoice) {
        throw new Error(
          `Failed to create/find supplier invoice ${invoiceNumber}`,
        );
      }

      const existingLines = await db.query.supplierInvoiceLines.findMany({
        where: eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoice.id),
      });

      if (existingLines.length === 0) {
        const lineProducts = pickManyUnique(allProducts, randomBetween(3, 6));
        let invoiceTotal = 0;

        for (const product of lineProducts) {
          const quantityCases = randomBetween(1, 5);
          const weightLbs = randomDecimal(40, 200, 4);
          const unitPrice =
            Number(product.defaultPricePerLb) > 0
              ? Number(product.defaultPricePerLb).toFixed(4)
              : "5.0000";
          const lineTotal = (Number(weightLbs) * Number(unitPrice)).toFixed(4);
          invoiceTotal += Number(lineTotal);

          await db.insert(supplierInvoiceLines).values({
            supplierInvoiceId: supplierInvoice.id,
            productId: product.id,
            quantityCases,
            weightLbs,
            unitPrice,
            lineTotal,
            unitType: "catch_weight",
            caseWeightsLbs: `${randomDecimal(8, 20, 2)},${randomDecimal(8, 20, 2)}`,
          });
        }

        await db
          .update(supplierInvoices)
          .set({ totalAmount: invoiceTotal.toFixed(4) })
          .where(eq(supplierInvoices.id, supplierInvoice.id));
      }

      supplierInvoiceCounter++;
    }
  }

  let inventoryCounter = 1;
  const targetInventoryItems = 1200;

  for (let i = 0; i < targetInventoryItems; i++) {
    const product = pickOne(allProducts);
    const lot = pickOne(seededLots);
    const barcodeId = `BC-${String(inventoryCounter).padStart(6, "0")}`;

    const weight = product.sku.startsWith("CHK-")
      ? randomDecimal(35, 80, 4)
      : product.sku.startsWith("BEF-")
        ? randomDecimal(45, 110, 4)
        : product.sku.startsWith("LAM-")
          ? randomDecimal(30, 70, 4)
          : randomDecimal(8, 25, 4);

    const cases = product.sku.startsWith("OTH-") ? randomBetween(1, 4) : 1;

    await db
      .insert(inventoryItems)
      .values({
        productId: product.id,
        lotId: lot.id,
        barcodeId,
        exactWeightLbs: weight,
        cases,
        status: "in_stock",
      })
      .onConflictDoNothing();

    inventoryCounter++;
  }

  let orderCounter = 1001;
  let invoiceCounter = 1001;

  for (let i = 0; i < 20; i++) {
    const customer = pickOne(allCustomers);
    const orderNumber = `SO-${orderCounter}`;
    const invoiceNumber = `INV-${invoiceCounter}`;
    const orderDate = addDays("2025-02-01", i * 2);

    await db
      .insert(salesOrders)
      .values({
        tenantId: tenant.id,
        orderNumber,
        customerId: customer.id,
        orderDate,
        dueDate: addDays(orderDate, 7),
        status: "sales_order",
        addFuelSurcharge: true,
        createdByUserId: portalUser.id,
      })
      .onConflictDoNothing();

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.tenantId, tenant.id),
        eq(salesOrders.orderNumber, orderNumber),
      ),
    });

    if (!order) {
      throw new Error(`Failed to create/find order ${orderNumber}`);
    }

    const existingOrderLines = await db.query.salesOrderLines.findMany({
      where: eq(salesOrderLines.salesOrderId, order.id),
    });

    if (existingOrderLines.length === 0) {
      const orderProducts = pickManyUnique(allProducts, randomBetween(2, 5));

      for (const product of orderProducts) {
        await db.insert(salesOrderLines).values({
          salesOrderId: order.id,
          productId: product.id,
          expectedCases: randomBetween(1, 10),
          fulfilledCases: 0,
          totalBilledWeightLbs: randomDecimal(20, 120, 4),
          unitType: "catch_weight",
          pricePerLbOverride:
            Number(product.defaultPricePerLb) > 0
              ? (Number(product.defaultPricePerLb) * 1.1).toFixed(4)
              : "0.0000",
          caseWeightsLbs: "10,10,10,10,10",
        });
      }
    }

    await db
      .insert(salesInvoices)
      .values({
        tenantId: tenant.id,
        invoiceNumber,
        salesOrderId: order.id,
        customerId: customer.id,
        invoiceDate: addDays(orderDate, 1),
        dueDate: addDays(orderDate, 8),
        status: "draft",
        subtotal: "250.00",
        discountAmount: "0.00",
        creditAmount: "0.00",
        fuelSurchargeAmount: "25.00",
        totalAmount: "275.00",
        amountPaid: "0.00",
        balanceDue: "275.00",
        createdByUserId: portalUser.id,
      })
      .onConflictDoNothing();

    const invoice = await db.query.salesInvoices.findFirst({
      where: and(
        eq(salesInvoices.tenantId, tenant.id),
        eq(salesInvoices.invoiceNumber, invoiceNumber),
      ),
    });

    if (!invoice) {
      throw new Error(`Failed to create/find invoice ${invoiceNumber}`);
    }

    const existingPayment = await db.query.payments.findFirst({
      where: eq(payments.salesInvoiceId, invoice.id),
    });

    if (!existingPayment) {
      await db.insert(payments).values({
        tenantId: tenant.id,
        salesInvoiceId: invoice.id,
        paymentDate: addDays(orderDate, 3),
        amount: i % 3 === 0 ? "275.00" : "125.00",
        paymentMethod: i % 2 === 0 ? "cash" : "check",
        checkNumber: i % 2 === 0 ? null : `CHK-${invoiceCounter}`,
        referenceNumber: `PMT-${invoiceCounter}`,
        notes: null,
        createdByUserId: portalUser.id,
      });
    }

    orderCounter++;
    invoiceCounter++;
  }

  const expenseRows = [
    {
      expenseDate: "2025-01-01",
      category: "rent",
      amount: "13000.00",
      note: null,
      paymentMethod: "check" as const,
    },
    {
      expenseDate: "2025-01-15",
      category: "fuel",
      amount: "850.00",
      note: "Delivery fuel",
      paymentMethod: "credit_card" as const,
    },
    {
      expenseDate: "2025-01-20",
      category: "utilities",
      amount: "640.00",
      note: "Cold storage electric",
      paymentMethod: "ach" as const,
    },
    {
      expenseDate: "2025-02-01",
      category: "maintenance",
      amount: "425.00",
      note: "Freezer service",
      paymentMethod: "cash" as const,
    },
    {
      expenseDate: "2025-02-10",
      category: "packaging",
      amount: "290.00",
      note: "Boxes and labels",
      paymentMethod: "credit_card" as const,
    },
  ];

  for (const expense of expenseRows) {
    const existingExpense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.tenantId, tenant.id),
        eq(expenses.expenseDate, expense.expenseDate),
        eq(expenses.category, expense.category),
      ),
    });

    if (!existingExpense) {
      await db.insert(expenses).values({
        tenantId: tenant.id,
        expenseDate: expense.expenseDate,
        category: expense.category,
        amount: expense.amount,
        note: expense.note,
        paymentMethod: expense.paymentMethod,
        createdByUserId: portalUser.id,
      });
    }
  }

  console.log("Seed complete ✅");
  console.log({
    authUserId: authUser.id,
    tenantId: tenant.id,
    portalUserId: portalUser.id,
    supplierCount: allSuppliers.length,
    customerCount: allCustomers.length,
    productCount: allProducts.length,
    lotCount: seededLots.length,
    inventoryTarget: targetInventoryItems,
  });
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
