export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "LISTER"
  | "RENTER"
  | "AGENT"
  | "EDITOR";

export type Permission =
  | "ACCESS_FULL_ANALYTICS"
  | "VIEW_OWN_PERFORMANCE"
  | "VIEW_ALL_MESSAGES"
  | "REPLY_MESSAGES"
  | "BULK_NOTIFICATIONS"
  | "MANAGE_BLOG_SETTINGS"
  | "BLOG_CRUD"
  | "MODERATE_COMMENTS"
  | "SEND_ANNOUNCEMENTS"
  | "CONFIGURE_PAYMENT_GATEWAYS"
  | "VIEW_TRANSACTIONS_ALL"
  | "MANUAL_REFUND"
  | "VIEW_OWN_INVOICES"
  | "MANAGE_PACKAGES"
  | "ASSIGN_PACKAGES"
  | "ENFORCE_QUOTAS"
  | "VIEW_QUOTA_DASHBOARDS"
  | "VIEW_OWN_QUOTA"
  | "APPROVE_LISTINGS"
  | "FEATURE_LISTINGS"
  | "REMOVE_FLAG_LISTINGS"
  | "CRUD_OWN_LISTINGS"
  | "PUBLISH_OWN_LISTINGS"
  | "MANAGE_LISTER_AGENT_ACCOUNTS"
  | "APPROVE_AGENT_PROFILES"
  | "MODERATE_RENTERS"
  | "MANAGE_SUPER_ADMIN_ACCOUNTS"
  | "CHANGE_PLATFORM_SETTINGS"
  | "EDIT_ROLE_DEFINITIONS"
  | "VIEW_SYSTEM_LOGS"
  | "MAINTENANCE_BACKUPS"
    "SEND_BROADCASTS";

export type RoleDefinition = {
  id: string;
  name: string;
  description?: string | null;
  permissions: Permission[];
  createdAt?: string;
  updatedAt?: string;
};

export type UserLite = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status?: "ACTIVE" | "INVITED" | "SUSPENDED";
  createdAt?: string;
};

export type UserRoleAttach = {
  userId: string;
  roles: string[];
  overrides?: {
    allow: Permission[];
    deny: Permission[];
  };
};

export type AuditEvent = {
  id: string;
  actorEmail: string;
  action: string;
  subject?: string;
  createdAt: string;
};
