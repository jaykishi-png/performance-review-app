# Spec — Meeting scheduling for performance reviews

**Status:** implemented 2026-09-11 — **blocked until the migration below is run by hand**
**Date:** 2026-09-10
**Depends on:** `046c3da` (meeting → signing sequence made explicit)

> One deviation from this spec, found during implementation: the employee surface could not
> read the scheduled time from `/api/reviews`, because that endpoint deliberately withholds an
> employee's review until `meeting_confirmed_at` is set — by the time it returns anything, the
> meeting has already happened. Rather than widen that gated payload, scheduling metadata is
> served by a dedicated `GET /api/reviews/upcoming-meeting`, which returns when and where and
> never review content. The pre-meeting gate is unchanged.

## Why

The app has no representation of a *scheduled* review meeting. `reviews.meeting_confirmed_at`
records only that a meeting **happened**, so the manager's three mental states —
not scheduled → scheduled → held — collapse into two.

Two visible consequences today:

1. The `MeetingSteps` strip added in `046c3da` cannot know whether step 1 ("Schedule the
   meeting") is done, so it stays *current* until the manager confirms the meeting took
   place — wrong for anyone who already scheduled it.
2. The dashboard jumps straight from "Ready for 1:1 Meeting" to signature collection. There
   is no truthful middle stage, and nothing in the product ever tells the employee when the
   meeting is.

`employee_review_cycles` already has `meeting_open_at` / `meeting_close_at`, but those define
the *window* for the meeting phase, not an appointment inside it. This spec adds the appointment.

## Scope

In: storing a scheduled date/time, setting and changing it from the manager's meeting page,
surfacing it to the manager, the employee, and admin, and emailing the employee when it is set.

Out (see Follow-ups): ICS attachments, real calendar integration, automatic reminders keyed to
the new time, and any change to who may sign.

## Data model

New migration, `supabase/add-meeting-scheduled.sql`, following the shape of
`add-meeting-confirmed.sql`:

```sql
alter table reviews
  add column if not exists meeting_scheduled_at timestamptz,
  add column if not exists meeting_location text;
```

- `meeting_scheduled_at` — the appointment, stored UTC. Nullable: not every review is scheduled
  in-app, and that must stay legal (see Ordering rules).
- `meeting_location` — free text, so it covers "Zoom", a pasted meeting URL, or "Conf room B".
  Not a URL column; do not render it as a link without validating the scheme.

**This DDL must be run by hand in the Supabase SQL editor.** Per the handoff, the agent cannot
apply DDL to this project.

No new table. A review has at most one meeting, and reschedules overwrite rather than append —
if an audit trail of reschedules is ever wanted, that is a separate `meeting_schedule_history`
table, not a change to this column.

## API

### New: `POST /api/reviews/schedule-meeting`

Model it directly on `app/api/reviews/confirm-meeting/route.ts`, which already has the right
authorization shape:

- Reject unauthenticated (401).
- Role must be `manager`, `middle_manager`, or `admin` (403).
- Fetch the review with `.eq('id', reviewId).eq('user_id', user.id)` so a manager can only
  schedule their own review (403 otherwise). This is the check that made the goal-import bug
  in `4912965` impossible server-side; keep it.

Body: `{ reviewId: string, scheduledAt: string /* ISO */, location?: string, notify?: boolean }`

Behaviour:

1. Validate `scheduledAt` parses to a real date. Reject a value more than ~2 years from now as
   a typo (a mistyped year is the likely failure, and a wrong year silently breaks every
   downstream display).
2. Write `meeting_scheduled_at` and `meeting_location`.
3. If `notify !== false`, email the employee (below). Wrap in try/catch — scheduling must
   succeed even when SMTP fails, exactly as confirm-meeting treats email as non-critical.
4. Keep the 8-second `Promise.race` timeout around email sends; Vercel's limit is 10s.
5. Return `{ ok: true, scheduledAt, location }`.

Rescheduling reuses this endpoint. Refuse it once `meeting_confirmed_at` is set (400,
"This meeting is already confirmed") — rescheduling a meeting that has already happened is
always a mistake.

### Reads

`meeting_scheduled_at` and `meeting_location` must be added to every `select` that already
lists `meeting_confirmed_at`, or the field will be silently absent in some views:

- `app/api/reviews/route.ts` — five select lists (the other `meeting_confirmed_at` hits there are casts and filters).
- `app/admin/page.tsx` — the review list select.

Then the client types: `SavedReview` in `PerformanceReviewForm.tsx` gains
`meetingScheduledAt?: string` / `meetingLocation?: string`, mapped in `dbRowToSave`
(alongside `meetingConfirmedAt`) and in the raw-row branch that feeds `myReviews`, plus
`ReviewRow` in `AdminDashboard.tsx`.

## UI

### Manager — meeting detail page

A new card **above** the existing "Confirm Meeting & Signatures" card, so the page reads in the
same order as the step strip.

Unscheduled state:

- `datetime-local` input, defaulting to the next weekday at 10:00 local.
- Optional location/link text input.
- Primary button "Schedule Meeting & Notify {employee}", with the consequence stated before the
  click, matching the attestation pattern from `046c3da`: "This emails {employee} the date,
  time and location."

Scheduled state:

- "Scheduled for Tuesday, September 15 at 2:00 PM" plus location if set.
- Secondary "Reschedule" (re-opens the inputs) and "Resend details".
- Hide both once `meeting_confirmed_at` is set.

Render times with `toLocaleString` in the viewer's zone. Do not print a bare time with no zone
context anywhere both parties can see it.

### Manager — step strip

`MeetingSteps` gains a `scheduledAt` prop:

- Step 1 `done` when `scheduledAt` is set, and its label becomes "Scheduled for Sep 15".
- Step 2 stays `current` while scheduled but unconfirmed — this is the state the strip cannot
  currently express, and it is the whole point of the change.
- Step 2 `done` only on `confirmed`. A past-dated schedule must not imply the meeting happened;
  only the manager's attestation does.

### Manager — dashboard

Insert one stage between "Ready for 1:1 Meeting" and "Awaiting Employee Signature" in the
stage ladder in `PerformanceReviewForm.tsx`:

| condition | stage | action |
| --- | --- | --- |
| `pct === 100`, not scheduled | Ready for 1:1 Meeting | **Schedule Meeting →** |
| scheduled, not confirmed | Meeting Scheduled — Sep 15 | Open Meeting |
| confirmed, not both signed | Awaiting Signatures | Open Meeting |

Note the first row's action label changes from "Conduct Meeting →" to "Schedule Meeting →":
with a scheduling step in the product, "conduct" is no longer the next action.

Also show the date on the meeting list rows, next to the existing confirmed/awaiting status.

### Employee portal

The employee currently has no way to learn when their review meeting is. In
`EmployeePortal.tsx` the cycle timeline already renders a "1-on-1 Meeting" row from
`meeting_open_at` / `meeting_close_at` — show the specific time there when set, and surface it
as a banner while the phase is active. This is the half of the feature the employee actually
feels; do not ship only the manager side.

Fed by `GET /api/reviews/upcoming-meeting` (see the deviation note at the top), fetched once on
mount so the banner appears on every page rather than only on Reviews.

### Admin

Display only. Add the date to the review detail drawer and, optionally, a "Meeting scheduled"
stage to `stageOf()` in `AdminDashboard.tsx`. **Do not** add it to the progress weights in
`reviewPct()` — every existing review would shift percentage, making historical completion
numbers incomparable for no gain.

## Ordering rules

- Scheduling is **not** a hard precondition for confirming. A manager who met without scheduling
  in-app must still be able to attest and move on. Show an inline note in that case
  ("No meeting was scheduled in Calibr — confirm only if the meeting took place") rather than
  blocking; a hard block here would strand real reviews.
- Signing remains gated on `meeting_confirmed_at` alone. This spec adds no new signing gate.
- Past-dated scheduling is allowed and useful (recording an already-booked meeting).
- A scheduled time in the past with no confirmation is the state worth nudging: the dashboard
  should read "Meeting was Sep 15 — confirm it took place".

## Email

Reuse the structure of `buildSigningEmail` in the confirm-meeting route, with a Google Calendar
"Add to calendar" link built from the scheduled time — no ICS attachment, because `lib/email.ts`
`sendEmail()` exposes only `{to, subject, html}` and adding attachment support is a larger change
than this feature needs.

Two things to fix while writing it: that template's palette is hardcoded pre-rebrand indigo
(`#4f46e5` → `#7c3aed`) and should be Calibr brand hex, and email HTML cannot resolve `var()`,
so the values must be literal.

## Follow-ups (explicitly not in this spec)

1. **Reminders.** `employee_review_cycles` already has `notif_meeting_3day_sent_at` /
   `notif_meeting_1day_sent_at`, fired from `app/api/cron/anniversary-check/route.ts` off the
   *cycle window*. Once a real appointment exists, those should key off `meeting_scheduled_at`
   instead — more useful, and a self-contained change.
2. ICS attachment / calendar integration (needs `sendEmail` to accept attachments).
3. Reschedule notification to the employee when a confirmed date moves.
4. Validating `meeting_scheduled_at` falls inside the cycle's meeting window.

## Verification

The manager portal is behind SSO, so the agent cannot render it. Build plus static analysis is
the ceiling; these need a human click-through:

1. Schedule → the strip's step 1 turns green with the date; the employee gets the email.
2. Reschedule → date updates everywhere, including the dashboard row.
3. Confirm → scheduling controls disappear, signing unlocks, step 2 turns green.
4. Confirm *without* scheduling → still possible, with the inline note.
5. Both themes: the new card and the "Meeting Scheduled" stage colours.
6. Light mode especially — per the handoff, a runtime contrast audit found five failures that
   reasoning alone had missed.

## Effort

Migration and API ~1h. Manager UI ~2h. Employee and admin surfaces ~1h. The DDL is yours to run
before any of it works.
