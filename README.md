# Manager Performance Review Tool

An AI-assisted annual performance review wizard for managers. Fill in a guided step-by-step form and get polished, copy-paste-ready text for each section of your company's review template.

---

## What it does

- **9-step wizard** — Employee info → 5 competency evaluations → Goals & score → Next year's goals → Full output
- **39 competency library** — dropdown with definitions for every evaluation dimension
- **Star rating matrix** — 1–5 scale with behavioral anchors (Unsatisfactory → Outstanding)
- **AI Draft** — describe what happened in plain words; Claude/Gemini writes the behavioral example
- **One-click copy** — copy individual sections or the entire review at once

---

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env.local
# Edit .env.local and add at least one key (see below)

# 3. Run
npm run dev
# → Open http://localhost:3000
```

---

## AI API keys

The app tries providers in this order: **Gemini → Anthropic → OpenAI**. You only need one.

| Provider | Model used | Where to get a key |
|---|---|---|
| **Google Gemini** *(recommended)* | gemini-2.0-flash | [aistudio.google.com](https://aistudio.google.com/app/apikey) — free tier available |
| Anthropic Claude | claude-3-5-haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| OpenAI | gpt-4o-mini | [platform.openai.com](https://platform.openai.com/api-keys) |

Copy `.env.example` → `.env.local` and paste your key(s).

---

## Deploy to Vercel (recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add your API key in the Vercel dashboard:
# Project → Settings → Environment Variables → add GEMINI_API_KEY (or ANTHROPIC/OPENAI)
```

Or connect the repo in [vercel.com/new](https://vercel.com/new) and set the env var there.

---

## Customising the competency list

Open `components/performance-review/PerformanceReviewForm.tsx` and edit the `COMPETENCIES` array near the top. Each entry is:

```typescript
{ name: 'Competency Name', definition: 'One-sentence definition shown to the manager.' }
```

## Customising the star rating labels

Edit `SCORE_LABELS` in the same file:

```typescript
const SCORE_LABELS: Record<number, { label: string; description: string; color: string }> = {
  1: { label: 'Unsatisfactory', description: '...', color: 'text-red-400' },
  // ...
}
```

---

## Tech stack

- **Next.js 15** (App Router)
- **React 19**
- **Tailwind CSS 4**
- **TypeScript**
- **lucide-react** icons
- AI via `@anthropic-ai/sdk` + `openai` (OpenAI-compatible for Gemini)

---

## File structure

```
app/
  layout.tsx                         — root layout
  page.tsx                           — redirects → /performance-review
  performance-review/page.tsx        — wizard page
  api/performance-review/
    draft-example/route.ts           — AI draft endpoint
components/
  performance-review/
    PerformanceReviewForm.tsx        — entire wizard (single file)
```

Everything lives in two files: the React form component and the API route. Easy to read, easy to modify.
