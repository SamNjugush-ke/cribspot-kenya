const EP = {
  me: process.env.NEXT_PUBLIC_EP_ME || "/api/auth/me",
  login: process.env.NEXT_PUBLIC_EP_LOGIN || "/api/auth/login",
  signup: process.env.NEXT_PUBLIC_EP_SIGNUP || "/api/auth/signup",
  logout: process.env.NEXT_PUBLIC_EP_LOGOUT || "/api/auth/logout",
  users: process.env.NEXT_PUBLIC_EP_USERS || "/api/users",
  invite: process.env.NEXT_PUBLIC_EP_INVITE || "/api/users/invite",
  roleDefs: process.env.NEXT_PUBLIC_EP_ROLE_DEFS || "/api/access/roles",
  roleDef: (idOrName: string) => (process.env.NEXT_PUBLIC_EP_ROLE_DEF_PREFIX || "/api/access/roles/") + idOrName,
  roleDefPerms: (idOrName: string) => (process.env.NEXT_PUBLIC_EP_ROLE_DEF_PERMS_PREFIX || "/api/access/roles/") + idOrName + (process.env.NEXT_PUBLIC_EP_ROLE_DEF_PERMS_SUFFIX || "/permissions"),
  userRoleDefs: (userId: string) => (process.env.NEXT_PUBLIC_EP_USER_ROLE_DEFS_PREFIX || "/api/access/users/") + userId + (process.env.NEXT_PUBLIC_EP_USER_ROLE_DEFS_SUFFIX || "/roles"),
  userOverrides: (userId: string) => (process.env.NEXT_PUBLIC_EP_USER_OVERRIDES_PREFIX || "/api/access/users/") + userId + (process.env.NEXT_PUBLIC_EP_USER_OVERRIDES_SUFFIX || "/overrides"),
  audit: process.env.NEXT_PUBLIC_EP_AUDIT || "/api/audit",
  plans: '/api/plans',
  subscriptionMe: '/api/subscriptions/me',
  checkout: '/api/payments/checkout',
};
export default EP;
