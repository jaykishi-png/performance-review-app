import { createServiceClient } from '@/lib/supabase/server'
import { hasPermission, canReadDocContent, type Role, type Permission } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError('Missing permission: ' + permission)
  }
}

export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function assertTeamRelationship(managerId: string, employeeId: string): Promise<void> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('profiles')
    .select('manager_id')
    .eq('id', employeeId)
    .single()
  if ((data as { manager_id: string } | null)?.manager_id !== managerId) {
    throw new ForbiddenError('Employee is not your direct report')
  }
}

export async function canAccessEmployee(
  userId: string,
  role: Role,
  employeeId: string
): Promise<boolean> {
  if (role === 'admin' || role === 'dev_admin') return true
  if (role === 'manager') {
    const serviceClient = createServiceClient()
    const { data } = await serviceClient
      .from('profiles')
      .select('manager_id')
      .eq('id', employeeId)
      .single()
    return (data as { manager_id: string } | null)?.manager_id === userId
  }
  if (role === 'employee') return userId === employeeId
  return false
}

export type FullReviewDocDTO = {
  id: string
  type: 'manager_review' | 'self_assessment'
  employeeId: string
  employeeName: string
  managerId: string | null
  managerName: string | null
  status: string
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  driveDocId: string | null
  driveUrl: string | null
  content: Record<string, unknown>
  contentRedacted: false
}

export type RedactedReviewDocDTO = {
  id: string
  type: 'manager_review' | 'self_assessment'
  employeeId: string
  employeeName: string
  managerId: string | null
  managerName: string | null
  status: string
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  driveDocId: string | null
  hasDriveUrl: boolean
  syncStatus: 'idle' | 'success' | 'error'
  lastSyncAt: string | null
  errorState: string | null
  contentRedacted: true
}

export function shapeReviewDoc(
  role: Role,
  raw: Record<string, unknown>,
  type: 'manager_review' | 'self_assessment'
): FullReviewDocDTO | RedactedReviewDocDTO {
  const base = {
    id: raw.id as string,
    type,
    employeeId: (raw.employee_id ?? raw.user_id ?? '') as string,
    employeeName: (raw.employee_name ?? '') as string,
    managerId: (raw.manager_id ?? null) as string | null,
    managerName: (raw.manager_name ?? null) as string | null,
    status: (raw.status ?? 'draft') as string,
    createdAt: (raw.created_at ?? raw.saved_at ?? '') as string,
    updatedAt: (raw.updated_at ?? '') as string,
    submittedAt: (raw.submitted_at ?? null) as string | null,
    driveDocId: (raw.drive_doc_id ?? null) as string | null,
  }

  if (!canReadDocContent(role)) {
    return {
      ...base,
      hasDriveUrl: !!raw.drive_url,
      syncStatus: raw.sync_error ? 'error' : raw.drive_doc_id ? 'success' : 'idle',
      lastSyncAt: (raw.updated_at ?? null) as string | null,
      errorState: (raw.sync_error ?? null) as string | null,
      contentRedacted: true,
    }
  }

  return {
    ...base,
    driveUrl: (raw.drive_url ?? null) as string | null,
    content: {
      formData: raw.form_data,
      comparisonReport: raw.comparison_report,
      strengths: raw.strengths,
      growthAreas: raw.growth_areas,
      goalReflections: raw.goal_reflections,
      overallRating: raw.overall_rating,
      overallComments: raw.overall_comments,
    },
    contentRedacted: false,
  }
}
