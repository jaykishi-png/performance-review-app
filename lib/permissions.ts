export type Role = 'admin' | 'dev_admin' | 'manager' | 'middle_manager' | 'employee' | 'pending'

export type Permission =
  | 'users.read.all'
  | 'users.invite'
  | 'users.create'
  | 'users.update.all'
  | 'users.update.non_sensitive'
  | 'users.deactivate'
  | 'users.reactivate'
  | 'users.delete.soft'
  | 'roles.assign.admin'
  | 'roles.assign.dev_admin'
  | 'roles.assign.manager'
  | 'roles.assign.employee'
  | 'org_chart.read.all'
  | 'org_chart.update.all'
  | 'reports_to.assign'
  | 'start_dates.assign'
  | 'departments.manage'
  | 'divisions.manage'
  | 'review_cycles.read.all'
  | 'review_cycles.create'
  | 'review_cycles.update'
  | 'review_cycles.publish'
  | 'review_cycles.close'
  | 'review_periods.schedule'
  | 'notifications.manage'
  | 'notifications.send.all'
  | 'notifications.send.system'
  | 'reminders.manage'
  | 'manager_reviews.read.all'
  | 'manager_reviews.create.all'
  | 'manager_reviews.update.all'
  | 'manager_reviews.submit.all'
  | 'manager_reviews.reopen.all'
  | 'manager_reviews.archive.all'
  | 'manager_reviews.read.metadata.all'
  | 'manager_reviews.read.content.none'
  | 'manager_reviews.update.none'
  | 'self_assessments.read.all'
  | 'self_assessments.create.all'
  | 'self_assessments.update.all'
  | 'self_assessments.submit.all'
  | 'self_assessments.reopen.all'
  | 'self_assessments.archive.all'
  | 'self_assessments.read.metadata.all'
  | 'self_assessments.read.content.none'
  | 'self_assessments.update.none'
  | 'docs.read.metadata.all'
  | 'docs.read.content.all'
  | 'docs.read.content.none'
  | 'docs.export.all'
  | 'docs.export.none'
  | 'drive.export.all'
  | 'drive.export.none'
  | 'drive.settings.update'
  | 'drive.settings.read'
  | 'drive.settings.update.technical_only'
  | 'templates.read'
  | 'templates.create'
  | 'templates.update'
  | 'templates.delete'
  | 'templates.read.metadata'
  | 'templates.read.content.none'
  | 'analytics.read.all'
  | 'analytics.read.operational'
  | 'analytics.read.team'
  | 'dashboard.read.admin'
  | 'dashboard.read.dev_admin'
  | 'dashboard.read.manager'
  | 'dashboard.read.employee'
  | 'audit_logs.read.hr'
  | 'audit_logs.read.technical'
  | 'audit_logs.export.technical'
  | 'compliance_reports.read'
  | 'app_settings.read'
  | 'app_settings.update'
  | 'auth_settings.read'
  | 'auth_settings.update'
  | 'integrations.read'
  | 'integrations.update'
  | 'api_keys.rotate'
  | 'environment_checks.read'
  | 'deployment_status.read'
  | 'feature_flags.read'
  | 'feature_flags.update'
  | 'notification_system.read'
  | 'notification_system.update'
  | 'notification_jobs.retry'
  | 'webhooks.read'
  | 'webhooks.retry'
  | 'error_logs.read'
  | 'system_logs.read'
  | 'impersonation.use.safe_mode'
  | 'debug_tools.use'
  | 'schema_migrations.read'
  | 'background_jobs.read'
  | 'background_jobs.retry'
  | 'profile.read.own'
  | 'profile.update.own'
  | 'direct_reports.read.team'
  | 'org_chart.read.team'
  | 'users.read.team.basic'
  | 'manager_reviews.create.team'
  | 'manager_reviews.read.team'
  | 'manager_reviews.update.team'
  | 'manager_reviews.submit.team'
  | 'manager_reviews.reopen.team.optional'
  | 'self_assessments.read.team'
  | 'review_cycles.read.team'
  | 'review_status.read.team'
  | 'notifications.read.team'
  | 'ai.use.team'
  | 'drive.export.team'
  | 'self_assessments.create.own'
  | 'self_assessments.read.own'
  | 'self_assessments.update.own'
  | 'self_assessments.submit.own'
  | 'self_assessments.withdraw.own.optional'
  | 'review_cycles.read.own'
  | 'review_status.read.own'
  | 'notifications.read.own'
  | 'ai.use.own'
  | 'drive.export.own.optional'
  | 'invites.manage'
  | 'settings.update'

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'profile.read.own',
  'profile.update.own',
  'self_assessments.create.own',
  'self_assessments.read.own',
  'self_assessments.update.own',
  'self_assessments.submit.own',
  'self_assessments.withdraw.own.optional',
  'review_cycles.read.own',
  'review_status.read.own',
  'notifications.read.own',
  'ai.use.own',
  'drive.export.own.optional',
  'dashboard.read.employee',
]

const MANAGER_PERMISSIONS: Permission[] = [
  'profile.read.own',
  'profile.update.own',
  'direct_reports.read.team',
  'org_chart.read.team',
  'users.read.team.basic',
  'manager_reviews.create.team',
  'manager_reviews.read.team',
  'manager_reviews.update.team',
  'manager_reviews.submit.team',
  'manager_reviews.reopen.team.optional',
  'self_assessments.read.team',
  'review_cycles.read.team',
  'review_status.read.team',
  'notifications.read.team',
  'ai.use.team',
  'drive.export.team',
  'dashboard.read.manager',
  'analytics.read.team',
]

const ADMIN_PERMISSIONS: Permission[] = [
  'users.read.all',
  'users.invite',
  'users.create',
  'users.update.all',
  'users.deactivate',
  'users.reactivate',
  'users.delete.soft',
  'roles.assign.admin',
  'roles.assign.dev_admin',
  'roles.assign.manager',
  'roles.assign.employee',
  'start_dates.assign',
  'org_chart.read.all',
  'org_chart.update.all',
  'reports_to.assign',
  'departments.manage',
  'divisions.manage',
  'review_cycles.read.all',
  'review_cycles.create',
  'review_cycles.update',
  'review_cycles.publish',
  'review_cycles.close',
  'review_periods.schedule',
  'notifications.manage',
  'notifications.send.all',
  'reminders.manage',
  'manager_reviews.read.all',
  'manager_reviews.create.all',
  'manager_reviews.update.all',
  'manager_reviews.submit.all',
  'manager_reviews.reopen.all',
  'manager_reviews.archive.all',
  'self_assessments.read.all',
  'self_assessments.create.all',
  'self_assessments.update.all',
  'self_assessments.submit.all',
  'self_assessments.reopen.all',
  'self_assessments.archive.all',
  'docs.read.metadata.all',
  'docs.read.content.all',
  'docs.export.all',
  'drive.export.all',
  'drive.settings.update',
  'templates.read',
  'templates.create',
  'templates.update',
  'templates.delete',
  'analytics.read.all',
  'dashboard.read.admin',
  'audit_logs.read.hr',
  'compliance_reports.read',
  'invites.manage',
  'settings.update',
  'profile.read.own',
  'profile.update.own',
  'self_assessments.read.own',
]

const DEV_ADMIN_PERMISSIONS: Permission[] = [
  'app_settings.read',
  'app_settings.update',
  'auth_settings.read',
  'auth_settings.update',
  'integrations.read',
  'integrations.update',
  'api_keys.rotate',
  'environment_checks.read',
  'deployment_status.read',
  'feature_flags.read',
  'feature_flags.update',
  'notification_system.read',
  'notification_system.update',
  'notification_jobs.retry',
  'webhooks.read',
  'webhooks.retry',
  'error_logs.read',
  'system_logs.read',
  'audit_logs.read.technical',
  'audit_logs.export.technical',
  'impersonation.use.safe_mode',
  'debug_tools.use',
  'schema_migrations.read',
  'background_jobs.read',
  'background_jobs.retry',
  'users.read.all',
  'users.invite',
  'users.update.non_sensitive',
  'users.deactivate',
  'users.reactivate',
  'start_dates.assign',
  'org_chart.read.all',
  'org_chart.update.all',
  'reports_to.assign',
  'roles.assign.manager',
  'roles.assign.employee',
  'review_cycles.read.all',
  'review_cycles.create',
  'review_cycles.update',
  'review_cycles.publish',
  'review_cycles.close',
  'review_periods.schedule',
  'notifications.manage',
  'notifications.send.system',
  'reminders.manage',
  'docs.read.metadata.all',
  'docs.read.content.none',
  'docs.export.none',
  'manager_reviews.read.metadata.all',
  'manager_reviews.read.content.none',
  'manager_reviews.update.none',
  'self_assessments.read.metadata.all',
  'self_assessments.read.content.none',
  'self_assessments.update.none',
  'templates.read.metadata',
  'templates.read.content.none',
  'drive.export.none',
  'drive.settings.read',
  'drive.settings.update.technical_only',
  'analytics.read.operational',
  'dashboard.read.dev_admin',
  'dashboard.read.admin',
  'profile.read.own',
  'profile.update.own',
]

const MIDDLE_MANAGER_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  'self_assessments.create.own',
  'self_assessments.read.own',
  'self_assessments.update.own',
  'self_assessments.submit.own',
  'self_assessments.withdraw.own.optional',
  'review_cycles.read.own',
  'review_status.read.own',
  'notifications.read.own',
  'drive.export.own.optional',
]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ADMIN_PERMISSIONS,
  dev_admin: DEV_ADMIN_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  middle_manager: MIDDLE_MANAGER_PERMISSIONS,
  employee: EMPLOYEE_PERMISSIONS,
  pending: [],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function canReadDocContent(role: Role): boolean {
  return hasPermission(role, 'docs.read.content.all')
}

export function getRoleHomeRoute(role: Role): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'dev_admin': return '/admin'
    case 'manager': return '/performance-review'
    case 'middle_manager': return '/performance-review'
    case 'employee': return '/employee'
    default: return '/pending'
  }
}
