# Application rules

This folder documents the business logic, workflow rules, and access-control
policies that govern the ERP. Keep these documents in sync with the code they
describe — they are the source of truth teammates should reach for before
reading the implementation.

## Index

- [`permissions.md`](./permissions.md) — role-based permission matrix for the
  sales order flow (roles, permissions, who can do what, and where the checks
  live).

## Conventions

- Documents here describe **what the rules are** and **why**. Implementation
  details that change often belong in code comments, not here.
- When a rule changes in code (`lib/auth/permissions.ts`, service-layer guards,
  workflow reasons in `order-action-rules.ts`, etc.), update the matching
  document in the same change.
- Prefer tables for matrices (roles × permissions, states × transitions) so
  diffs are easy to read in review.
