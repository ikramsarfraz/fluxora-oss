// Roles that may access workspace user management.
export const WORKSPACE_USERS_ROLES = ["admin", "owner"] as const;
export type WorkspaceUsersRole = (typeof WORKSPACE_USERS_ROLES)[number];
