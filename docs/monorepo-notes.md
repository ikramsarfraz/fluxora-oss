# Workspace notes

The Fluxora application codebase (this repository) is structured as an application codebase, not as a Yarn/pnpm workspaces monorepo. This file exists so older links pointing here remain meaningful.

### Tenants

- Solo and business accounts both use the **`tenants`** table (`tenantType=solo` vs `tenantType=business`).
- Reserved slugs such as `admin`, `www`, and `localhost` cannot be claimed as tenant identifiers.

### Where to read more

- [Documentation index](./README.md) — all topical guides  
- [`docs/rules/`](./rules/README.md) — business rules (permissions and workflows)  
- Root [README](../README.md) — orientation, tech stack, and high-level routing  
