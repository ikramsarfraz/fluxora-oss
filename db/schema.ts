import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  integer,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// -------------------- Enums --------------------

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "sales",
  "warehouse",
  "accounting",
]);

export const platformRoleEnum = pgEnum("platform_role", [
  "platform_admin",
  "support",
  "qa",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const tenantJoinRequestStatusEnum = pgEnum("tenant_join_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const tenantTypeEnum = pgEnum("tenant_type", ["solo", "business"]);

export const addressTypeEnum = pgEnum("address_type", [
  "billing",
  "shipping",
  "warehouse",
  "other",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "sales_order",
  "confirmed",
  "fulfilled",
  "cancelled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "void",
]);

export const creditTypeEnum = pgEnum("credit_type", ["fixed", "percentage"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "check",
  "ach",
  "zelle",
  "credit_card",
]);

export const expenseRecurrenceIntervalEnum = pgEnum("expense_recurrence_interval", [
  "none",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annually",
]);

export const lineUnitTypeEnum = pgEnum("line_unit_type", [
  "catch_weight",
  "fixed_case",
]);

export const pricingUnitTypeEnum = pgEnum("pricing_unit_type", [
  "per_lb",
  "per_case",
]);

export const inventoryItemStatusEnum = pgEnum("inventory_item_status", [
  "in_stock",
  "allocated",
  "picked",
  "packed",
  "shipped",
  "sold",
  "damaged",
  "expired",
]);

export const inventoryAdjustmentTypeEnum = pgEnum("inventory_adjustment_type", [
  "status_change",
  "correction",
  "bulk_lot_action",
]);

export const fileCategoryEnum = pgEnum("file_category", [
  "tenant_branding",
  "supplier_invoice_attachment",
  "support_ticket_attachment",
  "sales_invoice_pdf",
  "sales_invoice_attachment",
  "sales_order_attachment",
  "other",
]);

export const fileStatusEnum = pgEnum("file_status", [
  "uploading",
  "ready",
  "failed",
  "deleted",
]);

export const fileStorageProviderEnum = pgEnum("file_storage_provider", ["r2"]);

export const supplierInvoiceStatusEnum = pgEnum("supplier_invoice_status", [
  "draft",
  "posted",
  "receiving",
  "reconciled",
  "completed",
  "paid",
]);

export const bulkImportStatusEnum = pgEnum("bulk_import_status", [
  // Parsing finished cleanly — the user can pick this row from the bulk
  // landing screen and walk through review.
  "parsed",
  // Parsing finished but the user has already posted the bill from this
  // entry. We keep the row for audit + recovery (TTL is operator-controlled).
  "reviewed",
  // Legacy value, retained for enum-stability — never written by current
  // code. Superseded by `parse_error`. Safe to drop in a follow-up once we
  // confirm no rows in any environment carry this value.
  "errored",
  // Parsing failed — set when `PipelineResult.parseStatus === "parse_error"`.
  // The R2 object is still stored so a future re-parse handler can retry
  // without re-uploading; today's recovery is for the user to re-upload from
  // the bulk landing screen. `parse_error_codes` carries the coarse-grained
  // failure class (connection, timeout, refusal, …) for telemetry.
  "parse_error",
]);

export const plaidConnectionStatusEnum = pgEnum("plaid_connection_status", [
  "active",
  "requires_reauth",
  "disconnected",
]);

export const bankTransactionChannelEnum = pgEnum("bank_transaction_channel", [
  "ach",
  "wire",
  "check",
  "other",
]);

export const paymentMatchStatusEnum = pgEnum("payment_match_status", [
  "pending_review",
  "confirmed",
  "auto_applied",
  "rejected",
]);

export const billForwardDeliveryStatusEnum = pgEnum("bill_forward_delivery_status", [
  "sent",
  "bounced",
  "delivered",
]);

export const aliasSourceEnum = pgEnum("alias_source", [
  "manual",
  "ai_suggested",
  "confirmed",
  "parser",
]);

export const parserTypeEnum = pgEnum("parser_type", [
  "deterministic",
  "ai_fallback",
  "hybrid",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "insert",
  "update",
  "delete",
  "soft_delete",
  "restore",
  "login",
  "logout",
  "invite_sent",
  "invite_accepted",
  "file_uploaded",
  "file_deleted",
  "tenant_accessed",
]);

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "portal_user",
  "platform_user",
  "system",
]);

export const supportTicketIssueTypeEnum = pgEnum("support_ticket_issue_type", [
  "bug",
  "question",
  "feature_request",
  "workflow_issue",
]);

export const supportTicketPriorityEnum = pgEnum("support_ticket_priority", [
  "low",
  "medium",
  "high",
]);

export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open",
  "in_progress",
  "resolved",
]);

export const supportTicketUpdateAuthorTypeEnum = pgEnum(
  "support_ticket_update_author_type",
  ["platform_user", "portal_user"],
);

export const supportTicketUpdateVisibilityEnum = pgEnum(
  "support_ticket_update_visibility",
  ["internal", "tenant_visible"],
);

export const productUnitPurposeEnum = pgEnum("product_unit_purpose", [
  "stock",
  "purchase",
  "sales",
  "pricing",
  "display",
]);

// -------------------- Lot lifecycle --------------------

export const lotStateEnum = pgEnum("lot_state", [
  "active",
  "expiring",
  "marked_down",
  "reserved",
  "donated",
  "repurposed",
  "discarded",
]);

export const dispositionOptionEnum = pgEnum("disposition_option", [
  "markdown",
  "outreach",
  "donate",
  "repurpose",
  "discard",
]);

export const dispositionStatusEnum = pgEnum("disposition_status", [
  "draft",
  "scheduled",
  "applied",
  "completed",
  "cancelled",
]);

// -------------------- Tenant onboarding --------------------

export const businessCategoryEnum = pgEnum("business_category", [
  "meat_poultry",
  "seafood",
  "produce",
  "bakery_dry",
]);

/** Product / billing plan for a tenant (Stripe product mapping comes later). */
export const tenantSubscriptionPlanEnum = pgEnum("tenant_subscription_plan", [
  "free",
  "starter",
  "growth",
  "enterprise",
]);

/** Subscription lifecycle; `comped` = complimentary / internal, no payment. */
export const tenantSubscriptionStatusEnum = pgEnum("tenant_subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "comped",
]);

/** Dedup and lifecycle for verified Stripe webhook POSTs (`evt_…` id uniqueness). */
export const stripeWebhookProcessingStatusEnum = pgEnum(
  "stripe_webhook_processing_status",
  ["processing", "succeeded", "failed"],
);

// -------------------- Core multi-tenant/auth-adjacent --------------------

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    tenantType: tenantTypeEnum("tenant_type").notNull().default("business"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** When set, the first-run setup checklist card stays hidden for this tenant. */
    setupChecklistDismissedAt: timestamp("setup_checklist_dismissed_at", {
      withTimezone: true,
    }),
    /** Billing / Stripe subscription fields; enforced in app code later. */
    subscriptionPlan: tenantSubscriptionPlanEnum("subscription_plan")
      .notNull()
      .default("free"),
    subscriptionStatus: tenantSubscriptionStatusEnum("subscription_status")
      .notNull()
      .default("active"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    /** Primary business category set during onboarding (drives category-specific defaults). */
    businessCategory: businessCategoryEnum("business_category"),
    /** Running count of supplier invoices posted; drives first-bill-mode and data-readiness gates. */
    billCount: integer("bill_count").notNull().default(0),
    /**
     * Monotonically increasing counter used to mint per-tenant system
     * reference numbers (e.g. IB-000001) for supplier invoices. Atomically
     * incremented inside the create-invoice transaction.
     */
    supplierInvoiceCounter: integer("supplier_invoice_counter")
      .notNull()
      .default(0),
    /** Whether the onboarding welcome flow has been completed. */
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    /** Set when the user explicitly skips or finishes the welcome flow; stops the cold-start redirect. */
    welcomeSkippedAt: timestamp("welcome_skipped_at", { withTimezone: true }),
  },
  table => [
    uniqueIndex("tenants_slug_unique").on(table.slug),
    index("tenants_is_active_idx").on(table.isActive),
    index("tenants_subscription_status_idx").on(table.subscriptionStatus),
    index("tenants_subscription_plan_idx").on(table.subscriptionPlan),
  ],
);

export const tenantFeatures = pgTable(
  "tenant_features",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    feature: varchar("feature", { length: 128 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("tenant_features_tenant_feature_unique").on(
      table.tenantId,
      table.feature,
    ),
    index("tenant_features_tenant_idx").on(table.tenantId),
  ],
);

export const platformUsers = pgTable(
  "platform_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: platformRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("platform_users_auth_user_id_unique").on(table.authUserId),
    index("platform_users_role_idx").on(table.role),
    index("platform_users_is_active_idx").on(table.isActive),
  ],
);

export const portalUsers = pgTable(
  "portal_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("admin"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("portal_users_auth_user_id_tenant_id_unique").on(
      table.authUserId,
      table.tenantId,
    ),
    uniqueIndex("portal_users_tenant_email_unique").on(
      table.tenantId,
      table.email,
    ),
    index("portal_users_auth_user_id_idx").on(table.authUserId),
    index("portal_users_tenant_id_idx").on(table.tenantId),
    index("portal_users_email_idx").on(table.email),
    index("portal_users_is_active_idx").on(table.isActive),
    index("portal_users_role_idx").on(table.role),
  ],
);

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    token: text("token").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("user_invitations_tenant_id_idx").on(table.tenantId),
    index("user_invitations_email_idx").on(table.email),
    index("user_invitations_token_idx").on(table.token),
  ],
);

export const tenantJoinRequests = pgTable(
  "tenant_join_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    authUserId: text("auth_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    requestedRole: userRoleEnum("requested_role").notNull().default("sales"),
    status: tenantJoinRequestStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("tenant_join_requests_tenant_id_idx").on(table.tenantId),
    index("tenant_join_requests_status_idx").on(table.status),
    index("tenant_join_requests_requested_at_idx").on(table.requestedAt),
    index("tenant_join_requests_auth_user_id_idx").on(table.authUserId),
    index("tenant_join_requests_reviewed_by_user_id_idx").on(
      table.reviewedByUserId,
    ),
    index("tenant_join_requests_email_idx").on(table.email),
  ],
);

/** Cached Stripe Product objects for SaaS billing (not ERP catalogue products). */
export const stripeProducts = pgTable(
  "stripe_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeProductId: varchar("stripe_product_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 512 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    stripeCreatedAt: timestamp("stripe_created_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("stripe_products_stripe_product_id_unique").on(table.stripeProductId),
    index("stripe_products_active_idx").on(table.active),
  ],
);

/** Cached Stripe Price rows; `billing_plan_key` is derived from metadata `plan` when present. */
export const stripePrices = pgTable(
  "stripe_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripePriceId: varchar("stripe_price_id", { length: 255 }).notNull(),
    stripeProductId: varchar("stripe_product_id", { length: 255 })
      .notNull()
      .references(() => stripeProducts.stripeProductId, { onDelete: "cascade" }),
    lookupKey: varchar("lookup_key", { length: 255 }),
    billingPlanKey: varchar("billing_plan_key", { length: 32 }),
    currency: varchar("currency", { length: 16 }).notNull(),
    unitAmount: integer("unit_amount"),
    recurringInterval: varchar("recurring_interval", { length: 32 }),
    recurringIntervalCount: integer("recurring_interval_count"),
    active: boolean("active").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    stripeCreatedAt: timestamp("stripe_created_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("stripe_prices_stripe_price_id_unique").on(table.stripePriceId),
    index("stripe_prices_stripe_product_id_idx").on(table.stripeProductId),
    index("stripe_prices_billing_plan_key_active_idx").on(
      table.billingPlanKey,
      table.active,
    ),
  ],
);

/**
 * One row per Stripe `event.id`; ensures idempotent webhook processing.
 * Rows are inserted in `processing` before handler work completes; retries without duplicate side-effects.
 */
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    processingStatus: stripeWebhookProcessingStatusEnum("processing_status")
      .notNull()
      .default("processing"),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("stripe_webhook_events_stripe_event_id_unique").on(table.stripeEventId),
    index("stripe_webhook_events_processing_status_idx").on(table.processingStatus),
  ],
);

// -------------------- Reference/config --------------------

export const unitsOfMeasure = pgTable(
  "units_of_measure",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 128 }).notNull().unique(),
    abbreviation: varchar("abbreviation", { length: 16 }),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [index("units_of_measure_is_active_idx").on(table.isActive)],
);

export const tenantBranding = pgTable(
  "tenant_branding",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    companyLegalName: varchar("company_legal_name", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),
    primaryColor: varchar("primary_color", { length: 32 }),
    secondaryColor: varchar("secondary_color", { length: 32 }),
    accentColor: varchar("accent_color", { length: 32 }),
    invoiceFooterText: text("invoice_footer_text"),
    invoiceNotesDefault: text("invoice_notes_default"),
    logoFileId: uuid("logo_file_id"),
    faviconFileId: uuid("favicon_file_id"),
    createdByUserId: uuid("created_by_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [uniqueIndex("tenant_branding_tenant_id_unique").on(table.tenantId)],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    category: fileCategoryEnum("category").notNull(),
    storageProvider: fileStorageProviderEnum("storage_provider")
      .notNull()
      .default("r2"),
    status: fileStatusEnum("status").notNull().default("ready"),
    objectKey: varchar("object_key", { length: 1024 }).notNull(),
    bucket: varchar("bucket", { length: 255 }),
    originalFilename: varchar("original_filename", { length: 512 }),
    mimeType: varchar("mime_type", { length: 255 }),
    extension: varchar("extension", { length: 32 }),
    sizeBytes: integer("size_bytes"),
    checksumSha256: varchar("checksum_sha256", { length: 128 }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedByUserId: uuid("archived_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    metadataJson: text("metadata_json"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  table => [
    uniqueIndex("files_object_key_unique").on(table.objectKey),
    index("files_tenant_created_at_idx").on(table.tenantId, table.createdAt),
    index("files_tenant_category_created_at_idx").on(
      table.tenantId,
      table.category,
      table.createdAt,
    ),
    index("files_tenant_status_created_at_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    index("files_archived_at_idx").on(table.archivedAt),
  ],
);

// -------------------- Master data --------------------

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 64 }),
    fuelSurchargeAmount: numeric("fuel_surcharge_amount", {
      precision: 10,
      scale: 2,
    }),
    abbreviation: varchar("invoice_prefix", { length: 32 }),
    createdByUserId: uuid("created_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedByUserId: uuid("archived_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("customers_tenant_id_idx").on(table.tenantId),
    uniqueIndex("customers_tenant_name_unique").on(table.tenantId, table.name),
    index("customers_archived_at_idx").on(table.archivedAt),
  ],
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    addressType: addressTypeEnum("address_type").notNull().default("shipping"),
    street: varchar("street", { length: 255 }).notNull(),
    city: varchar("city", { length: 128 }),
    state: varchar("state", { length: 64 }),
    zip: varchar("zip", { length: 32 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [index("customer_addresses_customer_id_idx").on(table.customerId)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    /**
     * Payment terms in days (net N). `null` means no terms are configured;
     * AP aging falls back to Net-0 (invoice date) in that case.
     */
    netDays: integer("net_days"),
    /* Primary contact — who AP staff actually email/call. */
    primaryContactName: varchar("primary_contact_name", { length: 255 }),
    primaryContactEmail: varchar("primary_contact_email", { length: 320 }),
    primaryContactPhone: varchar("primary_contact_phone", { length: 32 }),
    /* US EIN, normalized to "##-#######" by the service. */
    taxId: varchar("tax_id", { length: 64 }),
    /** Buyer-side account number with this supplier (appears on their invoices). */
    accountNumber: varchar("account_number", { length: 64 }),
    /* Remit-to address — US only for v1; country column intentionally omitted. */
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    addressCity: varchar("address_city", { length: 128 }),
    addressRegion: varchar("address_region", { length: 128 }),
    addressPostalCode: varchar("address_postal_code", { length: 32 }),
    websiteUrl: varchar("website_url", { length: 512 }),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedByUserId: uuid("archived_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("suppliers_tenant_id_idx").on(table.tenantId),
    uniqueIndex("suppliers_tenant_name_unique").on(table.tenantId, table.name),
    index("suppliers_archived_at_idx").on(table.archivedAt),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdByUserId: uuid("created_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedByUserId: uuid("archived_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("categories_tenant_name_unique").on(table.tenantId, table.name),
    uniqueIndex("categories_tenant_slug_unique").on(table.tenantId, table.slug),
    index("categories_tenant_id_idx").on(table.tenantId),
    index("categories_is_active_idx").on(table.isActive),
    index("categories_archived_at_idx").on(table.archivedAt),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    defaultPricePerLb: numeric("default_price_per_lb", {
      precision: 10,
      scale: 4,
    }).notNull(),
    baseUnitId: uuid("base_unit_id").references(() => unitsOfMeasure.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedByUserId: uuid("archived_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("products_tenant_sku_unique").on(table.tenantId, table.sku),
    index("products_tenant_id_idx").on(table.tenantId),
    index("products_name_idx").on(table.name),
    index("products_base_unit_id_idx").on(table.baseUnitId),
    index("products_archived_at_idx").on(table.archivedAt),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    primaryKey({
      name: "product_categories_pkey",
      columns: [table.productId, table.categoryId],
    }),
    index("product_categories_product_id_idx").on(table.productId),
    index("product_categories_category_id_idx").on(table.categoryId),
  ],
);

export const productUnits = pgTable(
  "product_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),

    purpose: productUnitPurposeEnum("purpose").notNull(),

    isDefault: boolean("is_default").notNull().default(false),

    conversionToBase: numeric("conversion_to_base", {
      precision: 12,
      scale: 4,
    }).notNull(),

    allowsFractional: boolean("allows_fractional").notNull().default(true),

    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("product_units_product_id_idx").on(table.productId),
    index("product_units_unit_id_idx").on(table.unitId),
    index("product_units_product_purpose_idx").on(
      table.productId,
      table.purpose,
    ),
    uniqueIndex("product_units_product_unit_purpose_unique").on(
      table.productId,
      table.unitId,
      table.purpose,
    ),
  ],
);

export const customerProductPrices = pgTable(
  "customer_product_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /**
     * Optional supplier scope. When NULL the price is the customer's default
     * for the product (applies to any supplier). When set the price applies
     * only when the line's source supplier matches.
     *
     * Resolution at order time: (customer, product, supplier) → (customer, product, NULL) → product default.
     */
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "cascade",
    }),
    pricePerLb: numeric("price_per_lb", { precision: 10, scale: 4 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("uq_customer_product_supplier")
      .on(table.customerId, table.productId, table.supplierId),
  ],
);

export const productSupplierCosts = pgTable(
  "product_supplier_costs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    costPerLb: numeric("cost_per_lb", { precision: 10, scale: 4 }).notNull(),
    lastReceivedAt: timestamp("last_received_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("uq_product_supplier_cost").on(
      table.productId,
      table.supplierId,
    ),
  ],
);

// -------------------- Purchasing / inventory --------------------

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    /**
     * System-assigned, tenant-unique identifier (e.g. "IB-000001") minted on
     * insert from `tenants.supplier_invoice_counter`. This is the canonical
     * reference for searching and audit.
     */
    referenceNumber: varchar("reference_number", { length: 32 }).notNull(),
    /**
     * The supplier's printed invoice number, exactly as written on the bill.
     * Optional because some hand-written or scanned bills have no number.
     * Uniqueness is enforced per (tenant, supplier) when non-null so the
     * same bill can't be imported twice from the same supplier.
     *
     * Kept as `invoiceNumber` on the TS side to avoid a sweeping cross-module
     * rename; the DB column is `supplier_invoice_number` to make the intent
     * obvious in raw SQL / pgAdmin contexts.
     */
    invoiceNumber: varchar("supplier_invoice_number", { length: 64 }),
    invoiceDate: date("invoice_date").notNull(),
    receiveDate: date("receive_date").notNull(),
    status: supplierInvoiceStatusEnum("status").notNull().default("draft"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    paymentMethod: paymentMethodEnum("payment_method"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    completedByUserId: uuid("completed_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("supplier_invoices_tenant_id_idx").on(table.tenantId),
    index("supplier_invoices_supplier_id_idx").on(table.supplierId),
    uniqueIndex("supplier_invoices_tenant_reference_number_unique").on(
      table.tenantId,
      table.referenceNumber,
    ),
    uniqueIndex("supplier_invoices_tenant_supplier_inv_number_unique")
      .on(table.tenantId, table.supplierId, table.invoiceNumber)
      .where(sql`${table.invoiceNumber} IS NOT NULL`),
    index("supplier_invoices_tenant_invoice_date_idx").on(
      table.tenantId,
      table.invoiceDate,
    ),
    index("supplier_invoices_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const supplierInvoiceLines = pgTable(
  "supplier_invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantityCases: integer("quantity_cases").notNull().default(0),
    weightLbs: numeric("weight_lbs", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    unitType: lineUnitTypeEnum("unit_type").notNull().default("catch_weight"),
    caseWeightsLbs: text("case_weights_lbs"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("supplier_invoice_lines_supplier_invoice_id_idx").on(
      table.supplierInvoiceId,
    ),
    index("supplier_invoice_lines_product_id_idx").on(table.productId),
  ],
);

export const supplierInvoicePayments = pgTable(
  "supplier_invoice_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
    paymentDate: date("payment_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    /**
     * Check number — separate from reference_number so accounting exports
     * can distinguish physical-artifact identifiers from generic references.
     * Mirrors the AR `payments.check_number` column.
     */
    checkNumber: varchar("check_number", { length: 64 }),
    /** Bank reference / transaction ID. Mirrors AR `payments.reference_number`. */
    referenceNumber: varchar("reference_number", { length: 128 }),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("supplier_invoice_payments_tenant_id_idx").on(table.tenantId),
    index("supplier_invoice_payments_supplier_invoice_id_idx").on(
      table.supplierInvoiceId,
    ),
    index("supplier_invoice_payments_tenant_payment_date_idx").on(
      table.tenantId,
      table.paymentDate,
    ),
    check(
      "supplier_invoice_payments_amount_positive",
      sql`${table.amount} > 0`,
    ),
  ],
);

export const supplierInvoiceCharges = pgTable(
  "supplier_invoice_charges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 256 }).notNull(),
    chargeType: varchar("charge_type", { length: 32 }).notNull().default("other"),
    rate: numeric("rate", { precision: 8, scale: 4 }),
    includeInInventoryCost: boolean("include_in_inventory_cost").notNull().default(false),
    amount: numeric("amount", { precision: 12, scale: 4 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("supplier_invoice_charges_invoice_id_idx").on(table.supplierInvoiceId),
    check(
      "supplier_invoice_charges_charge_type_check",
      sql`${table.chargeType} IN ('freight','fuel','tax','discount','processing','inspection','cod','refrigeration','other')`,
    ),
  ],
);

export const lots = pgTable(
  "lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    lotNumber: varchar("lot_number", { length: 128 }).notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    receiveDate: date("receive_date").notNull(),
    expirationDate: date("expiration_date").notNull(),
    state: lotStateEnum("state").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("lots_tenant_lot_number_unique").on(
      table.tenantId,
      table.lotNumber,
    ),
    index("lots_tenant_id_idx").on(table.tenantId),
    index("ix_lots_expiration_date").on(table.expirationDate),
  ],
);

export const lotReceipts = pgTable(
  "lot_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    supplierInvoiceLineId: uuid("supplier_invoice_line_id")
      .notNull()
      .references(() => supplierInvoiceLines.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("lot_receipts_lot_invoice_line_unique").on(
      table.lotId,
      table.supplierInvoiceLineId,
    ),
  ],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "restrict" }),
    barcodeId: varchar("barcode_id", { length: 128 }).notNull().unique(),
    exactWeightLbs: numeric("exact_weight_lbs", {
      precision: 10,
      scale: 4,
    }).notNull(),
    cases: integer("cases").notNull().default(1),
    costPerUnitSnapshot: numeric("cost_per_unit_snapshot", {
      precision: 12,
      scale: 6,
    }).notNull(),
    costUnitTypeSnapshot: lineUnitTypeEnum("cost_unit_type_snapshot")
      .notNull()
      .default("catch_weight"),
    status: inventoryItemStatusEnum("status").notNull().default("in_stock"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("ix_inventory_items_lot_id").on(table.lotId),
    index("ix_inventory_items_status").on(table.status),
  ],
);

export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => lots.id, { onDelete: "set null" }),
    adjustmentType: inventoryAdjustmentTypeEnum("adjustment_type")
      .notNull()
      .default("status_change"),
    reason: varchar("reason", { length: 128 }).notNull(),
    notes: text("notes"),
    statusBefore: inventoryItemStatusEnum("status_before"),
    statusAfter: inventoryItemStatusEnum("status_after"),
    casesBefore: integer("cases_before"),
    casesAfter: integer("cases_after"),
    weightLbsBefore: numeric("weight_lbs_before", {
      precision: 10,
      scale: 4,
    }),
    weightLbsAfter: numeric("weight_lbs_after", {
      precision: 10,
      scale: 4,
    }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("inventory_adjustments_tenant_id_idx").on(table.tenantId),
    index("inventory_adjustments_inventory_item_id_idx").on(table.inventoryItemId),
    index("inventory_adjustments_lot_id_idx").on(table.lotId),
    index("inventory_adjustments_created_at_idx").on(table.createdAt),
  ],
);

// -------------------- Sales / finance --------------------

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    orderNumber: varchar("order_number", { length: 32 }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderDate: date("order_date").notNull(),
    dueDate: date("due_date"),
    status: orderStatusEnum("status").notNull().default("sales_order"),
    addFuelSurcharge: boolean("add_fuel_surcharge").notNull().default(true),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("sales_orders_tenant_id_idx").on(table.tenantId),
    index("sales_orders_customer_id_idx").on(table.customerId),
    uniqueIndex("sales_orders_tenant_order_number_unique").on(
      table.tenantId,
      table.orderNumber,
    ),
    index("sales_orders_tenant_order_date_idx").on(
      table.tenantId,
      table.orderDate,
    ),
  ],
);

export const salesOrderLines = pgTable(
  "sales_order_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    salesUnitId: uuid("sales_unit_id").references(() => unitsOfMeasure.id, {
      onDelete: "restrict",
    }),
    conversionToBaseSnapshot: numeric("conversion_to_base_snapshot", {
      precision: 12,
      scale: 4,
    }),
    baseUnitIdSnapshot: uuid("base_unit_id_snapshot").references(
      () => unitsOfMeasure.id,
      {
        onDelete: "restrict",
      },
    ),
    salesUnitNameSnapshot: varchar("sales_unit_name_snapshot", { length: 128 }),
    salesUnitAbbreviationSnapshot: varchar(
      "sales_unit_abbreviation_snapshot",
      { length: 16 },
    ),
    pricingUnitTypeSnapshot: pricingUnitTypeEnum("pricing_unit_type_snapshot"),
    pricePerUnitSnapshot: numeric("price_per_unit_snapshot", {
      precision: 12,
      scale: 4,
    }),
    pricingConversionSnapshot: numeric("pricing_conversion_snapshot", {
      precision: 12,
      scale: 4,
    }),
    expectedCases: integer("expected_cases").notNull(),
    fulfilledCases: integer("fulfilled_cases").notNull().default(0),
    unitType: lineUnitTypeEnum("unit_type").notNull().default("catch_weight"),
    totalBilledWeightLbs: numeric("total_billed_weight_lbs", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"),
    pricePerLbOverride: numeric("price_per_lb_override", {
      precision: 10,
      scale: 4,
    }),
    caseWeightsLbs: text("case_weights_lbs"),
    shortShippedAt: timestamp("short_shipped_at", { withTimezone: true }),
    shortShippedByUserId: uuid("short_shipped_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    shortShipNotes: text("short_ship_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("sales_order_lines_sales_order_id_idx").on(table.salesOrderId),
    index("sales_order_lines_product_id_idx").on(table.productId),
    index("sales_order_lines_sales_unit_id_idx").on(table.salesUnitId),
    index("sales_order_lines_base_unit_snapshot_id_idx").on(
      table.baseUnitIdSnapshot,
    ),
    index("sales_order_lines_short_shipped_at_idx").on(table.shortShippedAt),
    index("sales_order_lines_short_shipped_by_user_id_idx").on(
      table.shortShippedByUserId,
    ),
  ],
);

export const salesOrderLineAllocations = pgTable(
  "sales_order_line_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesOrderLineId: uuid("sales_order_line_id")
      .notNull()
      .references(() => salesOrderLines.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    allocatedWeightLbs: numeric("allocated_weight_lbs", {
      precision: 10,
      scale: 4,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex("uq_sales_line_inventory_item").on(
      table.salesOrderLineId,
      table.inventoryItemId,
    ),
  ],
);

export const salesOrderFulfillments = pgTable(
  "sales_order_fulfillments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    salesOrderLineId: uuid("sales_order_line_id")
      .notNull()
      .references(() => salesOrderLines.id, { onDelete: "cascade" }),
    quantityFulfilled: integer("quantity_fulfilled").notNull().default(1),
    weightLbs: numeric("weight_lbs", {
      precision: 12,
      scale: 4,
    }),
    fulfilledByUserId: uuid("fulfilled_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
    inventoryItemId: uuid("inventory_item_id").references(
      () => inventoryItems.id,
      {
        onDelete: "set null",
      },
    ),
    costPerUnitSnapshot: numeric("cost_per_unit_snapshot", {
      precision: 12,
      scale: 6,
    }),
    costUnitTypeSnapshot: lineUnitTypeEnum("cost_unit_type_snapshot"),
    costAmountSnapshot: numeric("cost_amount_snapshot", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"),
    lotId: uuid("lot_id").references(() => lots.id, {
      onDelete: "set null",
    }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedByUserId: uuid("reversed_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    reversalReason: text("reversal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("sales_order_fulfillments_sales_order_id_idx").on(table.salesOrderId),
    index("sales_order_fulfillments_sales_order_line_id_idx").on(
      table.salesOrderLineId,
    ),
    index("sales_order_fulfillments_fulfilled_at_idx").on(table.fulfilledAt),
    index("sales_order_fulfillments_inventory_item_id_idx").on(
      table.inventoryItemId,
    ),
    index("sales_order_fulfillments_lot_id_idx").on(table.lotId),
    index("sales_order_fulfillments_fulfilled_by_user_id_idx").on(
      table.fulfilledByUserId,
    ),
    index("sales_order_fulfillments_reversed_at_idx").on(table.reversedAt),
    index("sales_order_fulfillments_reversed_by_user_id_idx").on(
      table.reversedByUserId,
    ),
    check(
      "sales_order_fulfillments_quantity_positive",
      sql`${table.quantityFulfilled} > 0`,
    ),
    check(
      "sales_order_fulfillments_weight_nonnegative",
      sql`${table.weightLbs} is null or ${table.weightLbs} >= 0`,
    ),
  ],
);

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    invoiceDate: date("invoice_date").notNull(),
    dueDate: date("due_date"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    creditType: creditTypeEnum("credit_type"),
    creditAmount: numeric("credit_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    fuelSurchargeAmount: numeric("fuel_surcharge_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    balanceDue: numeric("balance_due", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdByUserId: uuid("created_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    updatedByUserId: uuid("updated_by_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("sales_invoices_tenant_id_idx").on(table.tenantId),
    index("sales_invoices_customer_id_idx").on(table.customerId),
    index("sales_invoices_sales_order_id_idx").on(table.salesOrderId),
    uniqueIndex("sales_invoices_tenant_invoice_number_unique").on(
      table.tenantId,
      table.invoiceNumber,
    ),
    index("sales_invoices_tenant_invoice_date_idx").on(
      table.tenantId,
      table.invoiceDate,
    ),
    index("sales_invoices_tenant_status_due_date_idx").on(
      table.tenantId,
      table.status,
      table.dueDate,
    ),
  ],
);

export const salesInvoiceLines = pgTable(
  "sales_invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantityCases: integer("quantity_cases").notNull().default(0),
    billedWeightLbs: numeric("billed_weight_lbs", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    cogsAmountSnapshot: numeric("cogs_amount_snapshot", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("sales_invoice_lines_sales_invoice_id_idx").on(table.salesInvoiceId),
    index("sales_invoice_lines_product_id_idx").on(table.productId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    paymentDate: date("payment_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    checkNumber: varchar("check_number", { length: 64 }),
    referenceNumber: varchar("reference_number", { length: 128 }),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("payments_tenant_id_idx").on(table.tenantId),
    index("payments_sales_invoice_id_idx").on(table.salesInvoiceId),
    index("payments_tenant_payment_date_idx").on(
      table.tenantId,
      table.paymentDate,
    ),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    expenseDate: date("expense_date").notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    paymentMethod: paymentMethodEnum("payment_method"),
    /**
     * Recurrence fields. A row with `recurrenceInterval != 'none'` is a
     * SCHEDULE — the cron job (`/api/cron/materialize-recurring-expenses`)
     * creates new expense rows whose `recurrenceParentId` points back to
     * the schedule. Materialized instances always carry `recurrenceInterval = 'none'`.
     */
    recurrenceInterval: expenseRecurrenceIntervalEnum("recurrence_interval")
      .notNull()
      .default("none"),
    recurrenceStartDate: date("recurrence_start_date"),
    recurrenceEndDate: date("recurrence_end_date"),
    recurrenceNextDueDate: date("recurrence_next_due_date"),
    recurrenceParentId: uuid("recurrence_parent_id"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("expenses_tenant_id_idx").on(table.tenantId),
    index("expenses_recurrence_next_due_idx").on(
      table.tenantId,
      table.recurrenceNextDueDate,
    ),
    index("expenses_recurrence_parent_idx").on(table.recurrenceParentId),
    check("expenses_amount_nonnegative", sql`${table.amount} >= 0`),
    check(
      "expenses_recurrence_end_after_start",
      sql`${table.recurrenceEndDate} IS NULL OR ${table.recurrenceStartDate} IS NULL OR ${table.recurrenceEndDate} >= ${table.recurrenceStartDate}`,
    ),
  ],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    portalUserId: uuid("portal_user_id").references(() => portalUsers.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    issueType: supportTicketIssueTypeEnum("issue_type").notNull(),
    priority: supportTicketPriorityEnum("priority").notNull().default("medium"),
    subject: varchar("subject", { length: 255 }).notNull(),
    message: text("message").notNull(),
    pageUrl: text("page_url"),
    status: supportTicketStatusEnum("status").notNull().default("open"),
    assignedPlatformUserId: uuid("assigned_platform_user_id").references(
      () => platformUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("support_tickets_tenant_id_idx").on(table.tenantId),
    index("support_tickets_portal_user_id_idx").on(table.portalUserId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_priority_idx").on(table.priority),
    index("support_tickets_issue_type_idx").on(table.issueType),
    index("support_tickets_assigned_platform_user_id_idx").on(
      table.assignedPlatformUserId,
    ),
    index("support_tickets_created_at_idx").on(table.createdAt),
  ],
);

export const supportTicketUpdates = pgTable(
  "support_ticket_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorType: supportTicketUpdateAuthorTypeEnum("author_type").notNull(),
    authorPlatformUserId: uuid("author_platform_user_id").references(
      () => platformUsers.id,
      { onDelete: "set null" },
    ),
    authorPortalUserId: uuid("author_portal_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),
    message: text("message").notNull(),
    visibility: supportTicketUpdateVisibilityEnum("visibility")
      .notNull()
      .default("internal"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("support_ticket_updates_ticket_id_idx").on(table.ticketId),
    index("support_ticket_updates_author_platform_user_id_idx").on(
      table.authorPlatformUserId,
    ),
    index("support_ticket_updates_author_portal_user_id_idx").on(
      table.authorPortalUserId,
    ),
    index("support_ticket_updates_visibility_idx").on(table.visibility),
    index("support_ticket_updates_created_at_idx").on(table.createdAt),
  ],
);

export const supportTicketAttachments = pgTable(
  "support_ticket_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    updateId: uuid("update_id").references(() => supportTicketUpdates.id, {
      onDelete: "cascade",
    }),
    uploadedByType: supportTicketUpdateAuthorTypeEnum("uploaded_by_type")
      .notNull(),
    uploadedById: uuid("uploaded_by_id").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("support_ticket_attachments_ticket_id_idx").on(table.ticketId),
    index("support_ticket_attachments_update_id_idx").on(table.updateId),
    index("support_ticket_attachments_file_id_idx").on(table.fileId),
    index("support_ticket_attachments_uploaded_by_idx").on(
      table.uploadedByType,
      table.uploadedById,
    ),
  ],
);

// -------------------- File link tables --------------------

export const supplierInvoiceAttachments = pgTable(
  "supplier_invoice_attachments",
  {
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    primaryKey({
      name: "supplier_invoice_attachments_pkey",
      columns: [table.supplierInvoiceId, table.fileId],
    }),
    index("supplier_invoice_attachments_file_id_idx").on(table.fileId),
  ],
);

// ---------------------------------------------------------------------------
// Bulk-import history. Each row records one PDF that a user uploaded through
// the bulk-import flow. The row pins:
//   - the parsed PipelineResult JSON (so the Review screen can prefill
//     without re-parsing),
//   - the original PDF's R2 object key (so we can serve it to the Review
//     screen on demand, and so audit / recovery has the source bytes),
//   - the lifecycle status (parsed → reviewed; errored on parse failure),
//   - soft-delete flag (Phase B) so users can dismiss rows without waiting
//     on a server round-trip; a future sweep can hard-delete.
//
// Replaces the prior 24h localStorage handoff with a durable, cross-device,
// audit-friendly history. PDFs live in R2; this table keeps the metadata.
// ---------------------------------------------------------------------------
export const bulkImportFiles = pgTable(
  "bulk_import_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),
    /**
     * Shared across every file submitted in a single bulk-import action call,
     * so the queue carousel + landing screen can group "imported together"
     * rows even though they are siblings rather than children of a parent
     * row.
     */
    batchId: uuid("batch_id").notNull(),
    /** Original filename as uploaded by the user (already path-safe). */
    filename: varchar("filename", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }),
    sizeBytes: integer("size_bytes"),
    /** R2 key the PDF was uploaded under. Object key is unique per row. */
    objectKey: varchar("object_key", { length: 1024 }).notNull(),
    /** Frozen `PipelineResult` JSON — used by the Review screen to prefill. */
    pipelineResult: jsonb("pipeline_result"),
    status: bulkImportStatusEnum("status").notNull().default("parsed"),
    /**
     * When `status === 'parse_error'`, the coarse-grained AI failure codes
     * surfaced by the pipeline (e.g. `["connection"]` for the bulk-import
     * multipage bug we just fixed). Null on successful parses. Persisted as
     * a string[] jsonb so future retry logic can filter (e.g. auto-retry on
     * "connection" / "timeout" but not on "refusal").
     */
    parseErrorCodes: jsonb("parse_error_codes").$type<string[]>(),
    /** Set when the user has posted a bill from this entry. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** The resulting supplier invoice id, set together with reviewedAt. */
    supplierInvoiceId: uuid("supplier_invoice_id").references(
      () => supplierInvoices.id,
      { onDelete: "set null" },
    ),
    /**
     * Phase B soft-delete flag. Reads filter on `deleted_at IS NULL`. The
     * underlying R2 object is intentionally retained — storage is cheap and
     * recovery is "set deleted_at = null".
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /**
     * Advisory claim — set when a reviewer opens this row in the queue, kept
     * fresh via a heartbeat, and cleared on unmount / submit. A second
     * reviewer who opens the same row while the claim is still fresh sees a
     * read-only banner instead of an editable form. Auto-expires when the
     * heartbeat lapses (closed tab, crashed browser) so the row never
     * permanently strands.
     */
    claimedByUserId: uuid("claimed_by_user_id").references(
      () => portalUsers.id,
      { onDelete: "set null" },
    ),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("bulk_import_files_object_key_unique").on(table.objectKey),
    // Drives the bulk-landing list query: pending rows for the current tenant
    // ordered by created_at desc.
    index("bulk_import_files_tenant_status_created_at_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    // Drives "all files in this batch" lookups for the queue carousel.
    index("bulk_import_files_batch_id_idx").on(table.batchId),
    // Drives the soft-delete filter — pending = (status=parsed AND deleted_at IS NULL).
    index("bulk_import_files_tenant_deleted_at_idx").on(
      table.tenantId,
      table.deletedAt,
    ),
  ],
);

export const salesOrderAttachments = pgTable(
  "sales_order_attachments",
  {
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    primaryKey({
      name: "sales_order_attachments_pkey",
      columns: [table.salesOrderId, table.fileId],
    }),
    index("sales_order_attachments_file_id_idx").on(table.fileId),
  ],
);

export const salesInvoiceFiles = pgTable(
  "sales_invoice_files",
  {
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    kind: fileCategoryEnum("kind").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    primaryKey({
      name: "sales_invoice_files_pkey",
      columns: [table.salesInvoiceId, table.fileId],
    }),
    index("sales_invoice_files_file_id_idx").on(table.fileId),
    index("sales_invoice_files_sales_invoice_id_kind_idx").on(
      table.salesInvoiceId,
      table.kind,
    ),
  ],
);

// -------------------- Audit --------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorPortalUserId: uuid("actor_portal_user_id").references(
      () => portalUsers.id,
      {
        onDelete: "set null",
      },
    ),
    actorPlatformUserId: uuid("actor_platform_user_id").references(
      () => platformUsers.id,
      {
        onDelete: "set null",
      },
    ),
    action: auditActionEnum("action").notNull(),
    entityTable: varchar("entity_table", { length: 128 }).notNull(),
    entityId: varchar("entity_id", { length: 128 }).notNull(),
    entityLabel: varchar("entity_label", { length: 255 }),
    changedFieldsJson: text("changed_fields_json"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    contextJson: text("context_json"),
    requestId: varchar("request_id", { length: 128 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("audit_logs_tenant_created_at_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    index("audit_logs_entity_idx").on(table.entityTable, table.entityId),
    index("audit_logs_actor_portal_user_idx").on(table.actorPortalUserId),
    index("audit_logs_actor_platform_user_idx").on(table.actorPlatformUserId),
    index("audit_logs_action_created_at_idx").on(table.action, table.createdAt),
  ],
);

// -------------------- Supplier import profiles + aliases --------------------

export const supplierImportProfiles = pgTable(
  "supplier_import_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    profileName: varchar("profile_name", { length: 128 }).notNull(),
    detectionKeywords: jsonb("detection_keywords").$type<string[]>().notNull().default([]),
    parserType: parserTypeEnum("parser_type").notNull().default("deterministic"),
    parsingRules: jsonb("parsing_rules")
      .$type<{
        headerFields?: Record<string, string>;
        lineParsing?: Record<string, unknown>;
        exclusions?: string[];
        feePatterns?: string[];
        totalsPattern?: string;
      }>()
      .notNull()
      .default({}),
    confidenceThreshold: numeric("confidence_threshold", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("60"),
    active: boolean("active").notNull().default(true),
    createdByUserId: uuid("created_by_user_id").references(() => portalUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("supplier_import_profiles_tenant_id_idx").on(table.tenantId),
    index("supplier_import_profiles_supplier_id_idx").on(table.supplierId),
    uniqueIndex("supplier_import_profiles_tenant_supplier_name_unique").on(
      table.tenantId,
      table.supplierId,
      table.profileName,
    ),
  ],
);

export const supplierProductAliases = pgTable(
  "supplier_product_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    vendorProductName: varchar("vendor_product_name", { length: 256 }).notNull(),
    normalizedVendorProductName: varchar("normalized_vendor_product_name", {
      length: 256,
    }).notNull(),
    internalProductId: uuid("internal_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull().default("100"),
    source: aliasSourceEnum("source").notNull().default("manual"),
    createdByUserId: uuid("created_by_user_id").references(() => portalUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("supplier_product_aliases_tenant_id_idx").on(table.tenantId),
    index("supplier_product_aliases_supplier_id_idx").on(table.supplierId),
    index("supplier_product_aliases_product_id_idx").on(table.internalProductId),
    uniqueIndex("supplier_product_aliases_tenant_supplier_name_unique").on(
      table.tenantId,
      table.supplierId,
      table.normalizedVendorProductName,
    ),
  ],
);

// -------------------- AI usage events --------------------
//
// One row per OpenAI call made during invoice parsing. Drives platform-admin
// cost transparency: which tenants are burning the most tokens, how often the
// gpt-4o escalation path fires, and per-month cost trajectory. Persistence
// lives at the row level (not aggregated) so we can drill into the failure
// pattern when a tenant hits a cost spike — e.g. "this one PDF triggered 4
// escalations in 30s because of a flaky OpenAI window."

export const aiUsageStageEnum = pgEnum("ai_usage_stage", [
  // Text-based invoice extraction (the primary AI call per upload).
  "invoice_extraction",
  // Vision-based extraction (fired when text-AI failed or returned a low-
  // quality result). More expensive than text per call.
  "vision_extraction",
  // Per-line product matching (smaller structured outputs; cheap on mini).
  "product_matching",
]);

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /**
     * The user that triggered the parse (nullable because automated /
     * system-driven parses may not have a portal-user context). Maps to
     * portalUsers via the same FK shape as bulk_import_files.
     */
    portalUserId: uuid("portal_user_id").references(() => portalUsers.id, {
      onDelete: "set null",
    }),
    stage: aiUsageStageEnum("stage").notNull(),
    /** Exact model id sent to OpenAI (e.g. "gpt-4o-mini", "gpt-4o"). */
    model: varchar("model", { length: 64 }).notNull(),
    /**
     * When set, this row is the escalation attempt that followed a transient
     * failure on `escalated_from_model`. Lets us cleanly compute "escalations
     * fired N times this month" and the marginal cost they added.
     */
    escalatedFromModel: varchar("escalated_from_model", { length: 64 }),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    /**
     * Total cost of THIS call in micro-USD (1 = $0.000001). Integer to avoid
     * float rounding across aggregates. The reader converts to display dollars
     * with `formatAiUsageCost`.
     */
    costMicros: integer("cost_micros").notNull().default(0),
    /** Whether the OpenAI call returned a usable result (status=success). */
    succeeded: boolean("succeeded").notNull(),
    /**
     * Coarse-grained AiExtractionErrorCode when the call failed; null on
     * success. Mirrors `bulk_import_files.parse_error_codes` so the admin
     * page can group failures by category.
     */
    errorCode: varchar("error_code", { length: 32 }),
    /**
     * Best-effort link back to the source bulk-import row, when the call was
     * made through that path. Set to null for direct parses (e.g. legacy
     * single-PDF upload). ON DELETE SET NULL so we keep the audit even when
     * the bulk-import row is soft-deleted + later hard-removed.
     */
    sourceBulkImportFileId: uuid("source_bulk_import_file_id").references(
      () => bulkImportFiles.id,
      { onDelete: "set null" },
    ),
    /** Original filename — kept denormalised for fast list rendering. */
    sourceFilename: varchar("source_filename", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    // Drives the admin per-tenant aggregate query.
    index("ai_usage_events_tenant_created_at_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    // Drives "escalations fired in the last 24h" admin filter.
    index("ai_usage_events_escalated_idx").on(table.escalatedFromModel),
    // Drives the per-source drilldown.
    index("ai_usage_events_source_bulk_import_file_idx").on(
      table.sourceBulkImportFileId,
    ),
  ],
);

// -------------------- AI extraction cache --------------------
//
// When a tenant re-uploads a PDF we've already AI-parsed (identical bytes →
// same SHA-256), look it up here and skip the OpenAI call entirely. The
// cached JSON is the RAW AiExtractionResult from the original parse — i.e.
// supplier name + line text + totals + token usage — NOT the post-matching
// PipelineResult. On cache hit the pipeline re-runs deterministic product
// matching against the current catalog, so renamed/deleted products don't
// produce stale alias references.
//
// Scope is per-tenant (uniqueness on tenant_id + hash) — never share cached
// extractions across tenants because the prompt includes that tenant's
// known suppliers + product candidates, which influences the AI's choice
// of supplierName and the unmatched-line composition.

export const aiExtractionCache = pgTable(
  "ai_extraction_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** SHA-256 hex of the PDF bytes (64 chars). */
    pdfContentHash: varchar("pdf_content_hash", { length: 64 }).notNull(),
    /**
     * Frozen AiExtractionResult from the original parse. Includes lines,
     * supplier name, totals, warnings, reasoning, and usage metadata. Read
     * back as `AiExtractionResult` (cast at the boundary) and fed back into
     * the pipeline as if the AI had just returned it.
     */
    aiExtractionJson: jsonb("ai_extraction_json").notNull(),
    /**
     * Stage the cached extraction came from. Lets us cache vision results
     * separately from text-AI results — useful when text-AI was bypassed
     * (e.g. scanned PDF) and only vision succeeded.
     */
    stage: aiUsageStageEnum("stage").notNull(),
    /** Model that produced the cached extraction. Useful for invalidating
     *  on model upgrades — a follow-up could nuke rows where model is below
     *  a threshold version. */
    model: varchar("model", { length: 64 }).notNull(),
    /** Original filename — kept for the admin drilldown / debugging. */
    sourceFilename: varchar("source_filename", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    // Primary lookup path. Unique to dedupe re-parses of the same PDF.
    uniqueIndex("ai_extraction_cache_tenant_hash_stage_unique").on(
      table.tenantId,
      table.pdfContentHash,
      table.stage,
    ),
    // Drives a future TTL/cleanup job ("delete entries older than 90 days").
    index("ai_extraction_cache_created_at_idx").on(table.createdAt),
  ],
);

// -------------------- Lot disposition decisions --------------------

export const dispositionDecisions = pgTable(
  "disposition_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "restrict" }),
    decidedByUserId: uuid("decided_by_user_id")
      .notNull()
      .references(() => portalUsers.id, { onDelete: "restrict" }),
    option: dispositionOptionEnum("option").notNull(),
    status: dispositionStatusEnum("status").notNull().default("draft"),
    expectedNet: numeric("expected_net", { precision: 12, scale: 2 }),
    actualNet: numeric("actual_net", { precision: 12, scale: 2 }),
    /** JSONB config blob — shape depends on option (MarkdownConfig | DonateConfig | etc.) */
    config: jsonb("config").notNull().default({}),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("disposition_decisions_tenant_id_idx").on(table.tenantId),
    index("disposition_decisions_lot_id_idx").on(table.lotId),
    index("disposition_decisions_status_idx").on(table.status),
    index("disposition_decisions_option_idx").on(table.option),
  ],
);

/**
 * Records the outcome of completed markdowns so the recommendation algorithm
 * can learn category-level sell-through rates over time.
 */
export const markdownHistories = pgTable(
  "markdown_histories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    lotId: uuid("lot_id").references(() => lots.id, { onDelete: "set null" }),
    dispositionDecisionId: uuid("disposition_decision_id").references(
      () => dispositionDecisions.id,
      { onDelete: "set null" },
    ),
    /** Category of the product (beef, chicken, etc.) drives the prior pool. */
    productCategory: varchar("product_category", { length: 128 }).notNull(),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull(),
    quantityOfferedLbs: numeric("quantity_offered_lbs", { precision: 12, scale: 4 }).notNull(),
    actualSellThroughPct: numeric("actual_sell_through_pct", { precision: 5, scale: 2 }),
    expectedNet: numeric("expected_net", { precision: 12, scale: 2 }),
    actualNet: numeric("actual_net", { precision: 12, scale: 2 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("markdown_histories_tenant_id_idx").on(table.tenantId),
    index("markdown_histories_product_category_idx").on(table.productCategory),
    index("markdown_histories_completed_at_idx").on(table.completedAt),
  ],
);

// -------------------- Plaid connections --------------------

export const plaidConnections = pgTable(
  "plaid_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    plaidItemId: varchar("plaid_item_id", { length: 256 }).notNull(),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    institutionId: varchar("institution_id", { length: 128 }),
    institutionName: varchar("institution_name", { length: 256 }),
    status: plaidConnectionStatusEnum("status").notNull().default("active"),
    transactionCursor: text("transaction_cursor"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("plaid_connections_tenant_id_idx").on(table.tenantId),
    uniqueIndex("plaid_connections_plaid_item_id_unique").on(table.plaidItemId),
  ],
);

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    plaidConnectionId: uuid("plaid_connection_id")
      .notNull()
      .references(() => plaidConnections.id, { onDelete: "cascade" }),
    plaidAccountId: varchar("plaid_account_id", { length: 256 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    officialName: varchar("official_name", { length: 256 }),
    mask: varchar("mask", { length: 8 }),
    type: varchar("type", { length: 64 }).notNull(),
    subtype: varchar("subtype", { length: 64 }),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
    isoCurrencyCode: varchar("iso_currency_code", { length: 8 }).default("USD"),
    balanceUpdatedAt: timestamp("balance_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("bank_accounts_tenant_id_idx").on(table.tenantId),
    index("bank_accounts_connection_id_idx").on(table.plaidConnectionId),
    uniqueIndex("bank_accounts_plaid_account_id_unique").on(table.plaidAccountId),
  ],
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    plaidTransactionId: varchar("plaid_transaction_id", { length: 256 }).notNull(),
    date: date("date").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    merchantName: varchar("merchant_name", { length: 256 }),
    rawDescription: text("raw_description").notNull(),
    paymentChannel: bankTransactionChannelEnum("payment_channel").default("other"),
    pending: boolean("pending").notNull().default(false),
    isoCurrencyCode: varchar("iso_currency_code", { length: 8 }).default("USD"),
    plaidCategory: jsonb("plaid_category").default([]),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("other"),
    checkNumber: integer("check_number"),
    isMysteryOutflow: boolean("is_mystery_outflow").notNull().default(false),
    mysteryDismissedAt: timestamp("mystery_dismissed_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("bank_transactions_tenant_id_idx").on(table.tenantId),
    index("bank_transactions_account_id_idx").on(table.bankAccountId),
    index("bank_transactions_date_idx").on(table.date),
    uniqueIndex("bank_transactions_plaid_txn_id_unique").on(table.plaidTransactionId),
    index("bank_transactions_mystery_idx").on(table.tenantId, table.isMysteryOutflow),
  ],
);

export const paymentMatches = pgTable(
  "payment_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    bankTransactionId: uuid("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id, { onDelete: "restrict" }),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "restrict" }),
    status: paymentMatchStatusEnum("status").notNull().default("pending_review"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    autoApplied: boolean("auto_applied").notNull().default(false),
    amountScore: numeric("amount_score", { precision: 5, scale: 4 }),
    payeeScore: numeric("payee_score", { precision: 5, scale: 4 }),
    timingScore: numeric("timing_score", { precision: 5, scale: 4 }),
    confirmedByUserId: uuid("confirmed_by_user_id").references(() => portalUsers.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("payment_matches_tenant_id_idx").on(table.tenantId),
    index("payment_matches_txn_id_idx").on(table.bankTransactionId),
    index("payment_matches_invoice_id_idx").on(table.supplierInvoiceId),
    index("payment_matches_status_idx").on(table.status),
  ],
);

// Payee aliases: bank raw description strings → supplier records
// Separate from supplier_product_aliases (which map vendor product names → internal products)
export const payeeAliases = pgTable(
  "payee_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    rawText: text("raw_text").notNull(),
    normalizedText: varchar("normalized_text", { length: 512 }).notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    source: aliasSourceEnum("source").notNull().default("confirmed"),
    channel: varchar("channel", { length: 20 }).notNull().default("ach"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    index("payee_aliases_tenant_id_idx").on(table.tenantId),
    index("payee_aliases_supplier_id_idx").on(table.supplierId),
    uniqueIndex("payee_aliases_tenant_channel_normalized_unique").on(
      table.tenantId,
      table.channel,
      table.normalizedText,
    ),
  ],
);

export const billForwards = pgTable(
  "bill_forwards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "restrict" }),
    sentByUserId: uuid("sent_by_user_id").references(() => portalUsers.id, {
      onDelete: "set null",
    }),
    recipients: jsonb("recipients").notNull().default([]),
    subject: text("subject").notNull(),
    messageBody: text("message_body").notNull(),
    attachedOriginal: boolean("attached_original").notNull().default(true),
    attachedSummary: boolean("attached_summary").notNull().default(false),
    deliveryStatus: billForwardDeliveryStatusEnum("delivery_status").notNull().default("sent"),
    deliveryEvents: jsonb("delivery_events").notNull().default([]),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("bill_forwards_tenant_id_idx").on(table.tenantId),
    index("bill_forwards_invoice_id_idx").on(table.supplierInvoiceId),
  ],
);

export const bankAccountBalanceSnapshots = pgTable(
  "bank_account_balance_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex("balance_snapshots_account_date_unique").on(table.bankAccountId, table.snapshotDate),
    index("balance_snapshots_tenant_date_idx").on(table.tenantId, table.snapshotDate),
  ],
);

// -------------------- Webhook idempotency --------------------

/**
 * Dedupe table for inbound Plaid webhooks. The primary key is the SHA-256
 * hex digest of the `Plaid-Verification` JWT — unique per delivery attempt
 * and produced only after signature verification succeeds, so attacker
 * spam can never bloat this table.
 */
export const plaidWebhookSeen = pgTable(
  "plaid_webhook_seen",
  {
    webhookId: varchar("webhook_id", { length: 64 }).primaryKey(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("plaid_webhook_seen_received_at_idx").on(table.receivedAt),
  ],
);

// -------------------- Audit log --------------------

/**
 * Append-only record of destructive / sensitive actions. The `actor_user_id`
 * intentionally has no foreign key — audit rows must survive user deletion,
 * and the `actor_email` is denormalized for the same reason.
 *
 * UPDATE / DELETE are revoked at the DB level by migration 0034.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").notNull(),
    actorEmail: text("actor_email"),
    action: varchar("action", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("audit_log_tenant_idx").on(table.tenantId, table.occurredAt),
    index("audit_log_actor_idx").on(table.actorUserId, table.occurredAt),
    index("audit_log_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_log_action_idx").on(
      table.tenantId,
      table.action,
      table.occurredAt,
    ),
  ],
);

export * from "./auth-schema";
