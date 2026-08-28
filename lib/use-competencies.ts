'use client'

import { useEffect, useState } from 'react'
import { FALLBACK_COMPETENCIES, type Competency } from './competencies'

/**
 * Shared client-side competency list.
 *
 * The list is admin-managed in the database, but it is read from several
 * components that don't share a parent, so it is cached at module scope and
 * fetched once per page load rather than threaded through props.
 *
 * Callers always get a usable list: the built-in fallback renders immediately
 * and is replaced when the request resolves, so a dropdown is never empty —
 * including before the migration has been run.
 */

let cache: Competency[] | null = null
let inflight: Promise<Competency[]> | null = null
const subscribers = new Set<(list: Competency[]) => void>()

function load(): Promise<Competency[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/competencies')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { competencies?: Competency[] } | null) => {
        const list = Array.isArray(d?.competencies) ? d!.competencies! : []
        cache = list.length > 0 ? list : FALLBACK_COMPETENCIES
        return cache
      })
      .catch(() => {
        cache = FALLBACK_COMPETENCIES
        return cache
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

export function useCompetencies(): Competency[] {
  const [list, setList] = useState<Competency[]>(cache ?? FALLBACK_COMPETENCIES)

  useEffect(() => {
    let alive = true
    load().then(l => { if (alive) setList(l) })
    subscribers.add(setList)
    return () => { alive = false; subscribers.delete(setList) }
  }, [])

  return list
}

/** Re-fetch after an admin edit, so open views pick up the change. */
export function refreshCompetencies(): Promise<void> {
  cache = null
  return load().then(l => { subscribers.forEach(fn => fn(l)) })
}
