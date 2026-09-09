'use client'
import { useState } from 'react'
import { SignaturePad, SignatureDisplay, encodeSignature, type SignatureResult } from '@/components/SignaturePad'

interface ReviewData {
  id: string
  user_id: string
  employee_id: string | null
  employee_name: string | null
  employee_position: string | null
  form_data: Record<string, unknown> | null
  comparison_report: string | null
  manager_signed_at: string | null
  manager_signature: string | null
  employee_signed_at: string | null
  employee_signature: string | null
  drive_url: string | null
}

interface SAData {
  competencies?: { type: string; term: string; examples: string[]; reflection?: string }[]
  goals_objectives?: { description: string; outcome: string; reasoning: string }[]
  next_year_goals?: { goal: string; objective: string }[]
  overall_rating?: number | null
  submitted_at?: string | null
  strengths?: string
  growth_areas?: string
}

interface Props {
  review: ReviewData
  saData: Record<string, unknown> | null
  currentUserId: string
  currentUserRole: string
  currentUserName: string
  isManager: boolean
  isEmployee: boolean
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Developing',
  3: 'Meeting Expectations',
  4: 'Exceeding Expectations',
  5: 'Outstanding',
}

function ComparisonReportBlock({ report, renderComparisonReport }: { report: string; renderComparisonReport: (t: string) => React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(88,28,235,0.06)', padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            📄 Comparison Report
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            AI-generated report comparing the self-assessment and performance review — alignment areas, divergence, talking points, and action plan.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-text)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Comparison Report</span>
        <button
          onClick={() => { navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-inset)', color: copied ? 'var(--success)' : 'var(--text-secondary)', cursor: 'pointer' }}
        >
          {copied ? '✓ Copied!' : '⎘ Copy'}
        </button>
      </div>
      <div style={{ background: 'var(--page)', border: '1px solid var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
        {renderComparisonReport(report)}
      </div>
    </div>
  )
}

export default function ReviewSignPage({ review, saData, currentUserRole, currentUserName, isManager, isEmployee }: Props) {
  const [mgrSigLoading, setMgrSigLoading] = useState(false)
  const [mgrSigError, setMgrSigError] = useState('')
  const [empSigLoading, setEmpSigLoading] = useState(false)
  const [empSigError, setEmpSigError] = useState('')
  const [managerSignedAt, setManagerSignedAt] = useState(review.manager_signed_at)
  const [managerSignature, setManagerSignature] = useState(review.manager_signature)

  function renderComparisonReport(text: string) {
    const renderInline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, pi) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={pi} style={{ color: 'var(--text)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
        : <span key={pi}>{part}</span>
    )
    const sections = text.split(/\n(?=## )/)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sections.map((section, idx) => {
          const lines = section.trim().split('\n')
          const rawHeading = lines[0]
          const isHeading = rawHeading.startsWith('## ')
          const heading = isHeading ? rawHeading.replace(/^##\s*/, '') : ''
          const bodyLines = isHeading ? lines.slice(1) : lines
          const hc =
            heading.includes('AGREE') || heading.includes('ALIGN') ? 'var(--success)' :
            heading.includes('DIFFER')                              ? 'var(--warning)' :
            heading.includes('TALKING')                             ? 'var(--info)' :
            heading.includes('ACTION') || heading.includes('PLAN')  ? 'var(--brand-soft)' :
            heading.includes('GOAL')                                ? 'var(--brand)' : 'var(--text)'
          const bc =
            heading.includes('AGREE') || heading.includes('ALIGN') ? 'rgba(52,211,153,0.15)' :
            heading.includes('DIFFER')                              ? 'rgba(251,191,36,0.15)' :
            heading.includes('TALKING')                             ? 'rgba(96,165,250,0.15)'  :
            heading.includes('ACTION') || heading.includes('PLAN')  ? 'rgba(167,139,250,0.15)' :
            heading.includes('GOAL')                                ? 'rgba(34,211,238,0.15)'  : 'rgba(30,32,48,0.5)'
          const total = sections.length
          return (
            <div key={idx} style={{ padding: '16px 20px', borderTop: idx === 0 ? 'none' : '1px solid var(--surface-hover)', background: idx % 2 === 0 ? 'var(--surface-inset)' : 'var(--page)', borderRadius: idx === 0 ? '10px 10px 0 0' : idx === total - 1 ? '0 0 10px 10px' : '0' }}>
              {heading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 16, borderRadius: 'var(--radius-sm)', background: hc, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: hc, textTransform: 'uppercase' as const, letterSpacing: '0.12em' }}>{heading}</span>
                  <div style={{ flex: 1, height: 1, background: bc }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {bodyLines.map((line, li) => {
                  const trimmed = line.trim()
                  if (!trimmed) return <div key={li} style={{ height: 4 }} />
                  if (/^[-*]\s/.test(trimmed)) return (
                    <div key={li} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--brand-text)', flexShrink: 0, marginTop: 1 }}>•</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{renderInline(trimmed.replace(/^[-*]\s+/, ''))}</span>
                    </div>
                  )
                  if (/^\d+\.\s/.test(trimmed)) {
                    const num = trimmed.match(/^(\d+)\./)?.[1] ?? ''
                    const rest = trimmed.replace(/^\d+\.\s+/, '')
                    return (
                      <div key={li} style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--brand-text)', flexShrink: 0, minWidth: 16, textAlign: 'right' as const, fontSize: 13 }}>{num}.</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{renderInline(rest)}</span>
                      </div>
                    )
                  }
                  return <p key={li} style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{renderInline(trimmed)}</p>
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  const [employeeSignedAt, setEmployeeSignedAt] = useState(review.employee_signed_at)
  const [employeeSignature, setEmployeeSignature] = useState(review.employee_signature)
  const [signingAs, setSigningAs] = useState<'manager' | 'employee' | null>(null)

  const form = review.form_data as Record<string, unknown> | null
  const sa = saData as SAData | null
  const bothSigned = !!(managerSignedAt && employeeSignedAt)

  async function handleManagerSign(result: SignatureResult) {
    setMgrSigLoading(true)
    setMgrSigError('')
    try {
      const res = await fetch('/api/reviews/manager-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, managerSignature: encodeSignature(result) }),
      })
      const data = await res.json() as { ok?: boolean; signedAt?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to sign')
      setManagerSignedAt(data.signedAt ?? new Date().toISOString())
      setManagerSignature(encodeSignature(result))
      setSigningAs(null)
    } catch (e) {
      setMgrSigError(String(e))
    } finally {
      setMgrSigLoading(false)
    }
  }

  async function handleEmployeeSign(result: SignatureResult) {
    setEmpSigLoading(true)
    setEmpSigError('')
    try {
      const res = await fetch('/api/reviews/employee-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, employeeSignature: encodeSignature(result) }),
      })
      const data = await res.json() as { ok?: boolean; signedAt?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to sign')
      setEmployeeSignedAt(data.signedAt ?? new Date().toISOString())
      setEmployeeSignature(encodeSignature(result))
      setSigningAs(null)
    } catch (e) {
      setEmpSigError(String(e))
    } finally {
      setEmpSigLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page)', color: 'var(--text-strong)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-inset)' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Performance Review</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>{review.employee_name}</div>
          {review.employee_position && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{review.employee_position}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {bothSigned ? (
            <div style={{ padding: '6px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>✓ Fully Signed</div>
          ) : (
            <div style={{ padding: '6px 14px', background: 'var(--warning-bg)', border: '1px solid var(--warning-text)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, color: 'var(--warning)' }}>Awaiting Signatures</div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Side-by-side */}
        {form && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Left: Self-Assessment */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', background: 'var(--brand-tint)', border: '1px solid var(--brand-tint)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self-Assessment</div>
                {sa?.submitted_at && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Submitted {new Date(sa.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
              </div>
              <div style={{ padding: 16, background: 'var(--surface-inset)', border: '1px solid var(--brand-tint)', borderRadius: '0 0 10px 10px' }}>
                {!sa ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>No self-assessment on file.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {sa.competencies && sa.competencies.filter(c => c.term).length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Competencies</div>
                        {sa.competencies.filter(c => c.term).map((c, i) => {
                          const col = c.type === 'positive' ? 'var(--success)' : c.type === 'constructive' ? 'var(--warning)' : 'var(--brand)'
                          return (
                            <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${col}30`, borderLeft: `3px solid ${col}`, borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{c.term}</div>
                              {c.examples.filter(e => e.trim()).map((ex, ei) => (
                                <div key={ei} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 2 }}>{ex}</div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {sa.goals_objectives && sa.goals_objectives.filter(g => g.description?.trim()).length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Goals &amp; Objectives</div>
                        {sa.goals_objectives.filter(g => g.description?.trim()).map((g, i) => (
                          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>{g.description}</div>
                            {g.outcome && <span style={{ fontSize: 11, fontWeight: 600, color: g.outcome === 'successful' ? 'var(--success)' : g.outcome === 'ongoing' ? 'var(--warning)' : 'var(--danger)' }}>{g.outcome}</span>}
                            {g.reasoning && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{g.reasoning}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {sa.overall_rating != null && (
                      <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Self Rating</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-text)' }}>{'★'.repeat(sa.overall_rating || 0)}{'☆'.repeat(5 - (sa.overall_rating || 0))}</span>
                      </div>
                    )}
                    {sa.next_year_goals && sa.next_year_goals.filter(g => g.goal?.trim()).length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Next Year&apos;s Goals</div>
                        {sa.next_year_goals.filter(g => g.goal?.trim()).map((g, i) => (
                          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{g.goal}</div>
                            {g.objective && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.objective}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {sa.strengths && (
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Strengths</div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{sa.strengths}</div>
                      </div>
                    )}
                    {sa.growth_areas && (
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Growth Areas</div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{sa.growth_areas}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Manager Review */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', background: 'var(--surface-inset)', border: '1px solid var(--info-border)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance Review</div>
                {form.reviewDate ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Review Date: {String(form.reviewDate)}</div> : null}
              </div>
              <div style={{ padding: 16, background: 'var(--surface-inset)', border: '1px solid var(--info-border)', borderRadius: '0 0 10px 10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{review.employee_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{review.employee_position}{form.appraisalPeriod ? ` · ${String(form.appraisalPeriod)}` : ''}</div>
                    {form.supervisorName ? <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Supervisor: {String(form.supervisorName)}</div> : null}
                  </div>
                  {/* Competencies */}
                  {(
                    [
                      { entry: form.competencyOne as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                      { entry: form.competencyTwo as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                      { entry: form.competencyThree as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                      { entry: form.competencyFour as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                      { entry: form.competencyFive as { competency?: string; examples?: string[] } | undefined, type: form.competencyFiveType as string || 'positive' },
                    ].filter(c => c.entry?.competency).length > 0
                  ) && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Competencies</div>
                      {[
                        { entry: form.competencyOne as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                        { entry: form.competencyTwo as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                        { entry: form.competencyThree as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                        { entry: form.competencyFour as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                        { entry: form.competencyFive as { competency?: string; examples?: string[] } | undefined, type: form.competencyFiveType as string || 'positive' },
                      ].filter(c => c.entry?.competency).map((c, i) => {
                        const col = c.type === 'positive' ? 'var(--success)' : 'var(--warning)'
                        return (
                          <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${col}30`, borderLeft: `3px solid ${col}`, borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{c.entry!.competency}</div>
                            {(c.entry!.examples ?? []).filter(e => e.trim()).map((ex, ei) => (
                              <div key={ei} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 2 }}>{ei + 1}. {ex}</div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* Goals */}
                  {(form.goals as Array<{ text: string; status?: string }> | undefined)?.filter(g => g.text.trim()).length ? (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Goals &amp; Objectives</div>
                      {(form.goals as Array<{ text: string; status?: string }>).filter(g => g.text.trim()).map((g, i) => (
                        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{g.text}</div>
                          {g.status && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-lg)', background: g.status === 'successful' ? 'var(--success-bg)' : g.status === 'unsuccessful' ? 'var(--danger-bg)' : 'var(--warning-bg)', color: g.status === 'successful' ? 'var(--success)' : g.status === 'unsuccessful' ? 'var(--danger)' : 'var(--warning)' }}>{g.status}</span>}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {/* Overall Score */}
                  {(form.overallScore as number | undefined) ? (
                    <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Overall Score</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--info)' }}>{'★'.repeat(form.overallScore as number)}{'☆'.repeat(5 - (form.overallScore as number))}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{SCORE_LABELS[form.overallScore as number]}</span>
                    </div>
                  ) : null}
                  {/* Next Goals */}
                  {(form.nextGoals as Array<{ text: string; targetDate?: string }> | undefined)?.filter(g => g.text.trim()).length ? (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Next Year&apos;s Goals</div>
                      {(form.nextGoals as Array<{ text: string; targetDate?: string }>).filter(g => g.text.trim()).map((g, i) => (
                        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{g.text}</div>
                          {g.targetDate && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: {g.targetDate}</div>}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Report */}
        {review.comparison_report && (
          <ComparisonReportBlock report={review.comparison_report} renderComparisonReport={renderComparisonReport} />
        )}

        {/* Signatures */}
        <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 20 }}>Signatures</div>

          {bothSigned ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Manager</div>
                <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                  <SignatureDisplay stored={managerSignature} date={managerSignedAt ?? ''} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Employee</div>
                <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                  <SignatureDisplay stored={employeeSignature} date={employeeSignedAt ?? ''} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Manager signature section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Manager</div>
                  {managerSignedAt ? (
                    <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                      <SignatureDisplay stored={managerSignature} date={managerSignedAt} />
                    </div>
                  ) : isManager && signingAs !== 'employee' ? (
                    signingAs === 'manager' ? (
                      <SignaturePad
                        onSign={handleManagerSign}
                        loading={mgrSigLoading}
                        error={mgrSigError}
                        buttonLabel="✍️ Sign as Manager"
                        onCancel={() => { setSigningAs(null); setMgrSigError('') }}
                      />
                    ) : (
                      <button
                        onClick={() => setSigningAs('manager')}
                        style={{ padding: '10px 20px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✍️ Sign as Manager
                      </button>
                    )
                  ) : (
                    <div style={{ padding: '14px', background: 'var(--warning-bg)', border: '1px solid var(--warning-text)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>Awaiting Manager Signature</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>The manager will sign this review from this link.</div>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Employee</div>
                  {employeeSignedAt ? (
                    <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                      <SignatureDisplay stored={employeeSignature} date={employeeSignedAt} />
                    </div>
                  ) : isEmployee && signingAs !== 'manager' ? (
                    signingAs === 'employee' ? (
                      <div>
                        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>By signing, you acknowledge that you have reviewed this performance evaluation and discussed it with your manager.</p>
                        <SignaturePad
                          onSign={handleEmployeeSign}
                          loading={empSigLoading}
                          error={empSigError}
                          buttonLabel="✍️ Sign &amp; Acknowledge"
                          onCancel={() => { setSigningAs(null); setEmpSigError('') }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setSigningAs('employee')}
                        style={{ padding: '10px 20px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✍️ Sign &amp; Acknowledge
                      </button>
                    )
                  ) : (
                    <div style={{ padding: '14px', background: 'var(--warning-bg)', border: '1px solid var(--warning-text)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>Awaiting Employee Signature</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>The employee will sign this review from this link.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Role indicator */}
              <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                Signed in as <strong style={{ color: 'var(--text-secondary)' }}>{currentUserName}</strong>
                {' '}({currentUserRole === 'manager' || currentUserRole === 'middle_manager' ? 'Manager' : currentUserRole === 'admin' ? 'Admin' : 'Employee'})
                {' '}· Both parties must sign to complete the review.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
