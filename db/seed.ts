import { db } from "./index";
import {
  customerAddresses,
  customers,
  productSupplierCosts,
  products,
  suppliers,
  unitsOfMeasure,
  portalUsers,
} from "./schema";

async function seed() {
  console.log("Seeding database...");

  const [adminUser] = await db
    .insert(portalUsers)
    .values({
      authUserId: "seed-admin-user",
      fullName: "Admin User",
      email: "admin@example.com",
      role: "admin",
    })
    .onConflictDoNothing()
    .returning();

  const [lbUnit] = await db
    .insert(unitsOfMeasure)
    .values({
      name: "Pound",
      abbreviation: "lb",
      sortOrder: 1,
    })
    .onConflictDoNothing()
    .returning();

  const [caseUnit] = await db
    .insert(unitsOfMeasure)
    .values({
      name: "Case",
      abbreviation: "cs",
      sortOrder: 2,
    })
    .onConflictDoNothing()
    .returning();

  const [supplier] = await db
    .insert(suppliers)
    .values({
      name: "Prime Beef Supplier",
    })
    .returning();

  const [customer] = await db
    .insert(customers)
    .values({
      name: "Downtown Halal Market",
      phoneNumber: "555-111-2222",
      fuelSurchargeAmount: "25.00",
      invoicePrefix: "DHM",
    })
    .returning();

  await db.insert(customerAddresses).values({
    customerId: customer.id,
    addressType: "shipping",
    street: "123 Market St",
    city: "Indianapolis",
    state: "IN",
    zip: "46204",
    isDefault: true,
  });

  const [product] = await db
    .insert(products)
    .values({
      sku: "BEEF-RIBEYE-001",
      name: "Ribeye Box",
      defaultPricePerLb: "8.7500",
      species: "beef",
      stockUnitId: caseUnit?.id,
      purchaseUnitId: caseUnit?.id,
      salesUnitId: lbUnit?.id,
    })
    .returning();

  await db.insert(productSupplierCosts).values({
    productId: product.id,
    supplierId: supplier.id,
    costPerLb: "6.2500",
  });

  console.log("Seed complete");
  console.log({
    adminUserId: adminUser?.id,
    customerId: customer.id,
    supplierId: supplier.id,
    productId: product.id,
  });
}

seed()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
