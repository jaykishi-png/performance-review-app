export type Role = 'admin' | 'manager' | 'employee' | 'pending'

export type Permission =
  | 'users.read.all'
  | 'users.create'
  | 'users.update.all'
  | 'users.deactivate'
  | 'roles.assign'
  | 'reports_to.assign'
  | 'reviews.read.all'
  | 'reviews.create.all'
  | 'reviews.update.all'
  | 'reviews.submit.all'
  | 'reviews.reopen.all'
  | 'reviews.archive.all'
  | 'self_reviews.read.all'
  | 'self_reviews.compare.all'
  | 'review_cycles.manage'
  | 'templates.manage'
  | 'ai.use.all'
  | 'drive.export.all'
  | 'drive.settings.update'
  | 'analytics.read.all'
  | 'audit_logs.read'
  | 'settings.update'
  | 'invites.manage'
  // Manager
  | 'users.read.team'
  | 'reviews.read.own'
  | 'reviews.read.team'
  | 'reviews.create.team'
  | 'reviews.update.team'
  | 'reviews.submit.team'
  | 'self_reviews.read.own'
  | 'self_reviews.read.team'
  | 'self_reviews.compare.team'
  | 'ai.use.team'
  | 'drive.export.team'
  | 'analytics.read.team'
  // Employee
  | 'profile.read.own'
  | 'profile.update.own'
  | 'reviews.read.own'
  | 'self_reviews.create.own'
  | 'self_reviews.update.own'
  | 'self_reviews.submit.own'
  | 'ai.use.own'
  | 'drive.export.own'

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'profile.read.own',
  'profile.update.own',
  'reviews.read.own',
  'self_reviews.create.own',
  'self_reviews.read.own',
  'self_reviews.update.own',
  'self_reviews.submit.own',
  'ai.use.own',
  'drive.export.own',
]

const MANAGER_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  'users.read.team',
  'reviews.read.team',
  'reviews.create.team',
  'reviews.update.team',
  'reviews.submit.team',
  'self_reviews.read.team',
  'self_reviews.compare.team',
  'ai.use.team',
  'drive.export.team',
  'analytics.read.team',
]

const ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  'users.read.all',
  'users.create',
  'users.update.all',
  'users.deactivate',
  'roles.assign',
  'reports_to.assign',
  'reviews.read.all',
  'reviews.create.all',
  'reviews.update.all',
  'reviews.submit.all',
  'reviews.reopen.all',
  'reviews.archive.all',
  'self_reviews.read.all',
  'self_reviews.compare.all',
  'review_cycles.manage',
  'templates.manage',
  'ai.use.all',
  'drive.export.all',
  'drive.settings.update',
  'analytics.read.all',
  'audit_logs.read',
  'settings.update',
  'invites.manage',
]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ADMIN_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  employee: EMPLOYEE_PERMISSIONS,
  pending: [],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function getRoleHomeRoute(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'manager':
      return '/performance-review'
    case 'employee':
      return '/employee'
    default:
      return '/pending'
  }
}
