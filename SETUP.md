# LearnLoop — Setup Guide

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (free tier is fine)
2. Click **New project**, name it `learnloop`, pick a region close to you
3. Wait ~2 minutes for provisioning

## 2. Run the database migration

1. In your Supabase project, go to **SQL Editor**
2. Paste the entire contents of `supabase/migrations/001_initial.sql`
3. Click **Run** — this creates all tables, RLS policies, indexes, and the skill seed data

## 3. Get your API keys

In Supabase, go to **Project Settings → API**. Copy:
- **Project URL** (looks like `https://xxxx.supabase.co`)
- **anon public** key

## 4. Set environment variables

Edit `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 5. Run the dev server

```bash
cd C:\Users\ashwi\Projects\learnloop
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## 6. Create accounts

- Sign up with your brother's email/name → he gets `role: student` automatically
- Sign up with your own email → you're also a student for now (admin role can be set manually in Supabase Table Editor: change the `role` column in the `users` table to `admin`)

## What's built (Phase 0 + Phase 1)

- **Auth**: email/password signup + login via Supabase Auth
- **Dashboard**: shows all 4 math skills with XP and streak in the header
- **Sessions**: 8-question sessions generated server-side; answer never sent to client
- **Engagement loop**:
  - Forward-only progress bar (wrong answers don't advance it)
  - Wrong answer → shows correct answer + explanation + re-queues the question
  - Must answer every question correctly to finish
  - Completion screen with XP earned and streak
- **Streaks**: daily streak with 2 freeze credits built in
- **XP**: +50 on session complete, +5 per first-attempt correct answer

## Math coverage

| Skill | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Multiplication | single × single | 2-digit × 1-digit | 2-digit × 2-digit |
| Division | basic facts | 2-digit ÷ 1-digit | with remainders |
| Fractions | compare same-denom | add same-denom | subtract same-denom |
| Decimals | place value | compare | add tenths |

All answers computed in code. Distractors generated from real error patterns (off-by-one, wrong operation, place-value slips).

## Deploy to Vercel

```bash
npx vercel
```

Set the same 3 env vars in the Vercel dashboard (Project Settings → Environment Variables).
Update `NEXT_PUBLIC_SITE_URL` to your Vercel URL.
