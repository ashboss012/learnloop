# 09. Tech Stack and Architecture

Reuse the stack you already know. Nothing here needs anything new.

## Stack

- Next.js with the App Router, TypeScript
- Supabase for Postgres, Auth, and row level security
- Vercel for hosting and cron routes
- An LLM only for offline content generation, not at serve time

Same shape as Parcela, so no new patterns to learn on the infrastructure side.

## Data flow

Two paths, kept separate on purpose.

Content path, offline and ahead of time:

1. A generation job produces questions and passages (see 02, 03, 04)
2. They land as draft, then pending
3. I review and publish (see 05)
4. Published content sits in the pool ready to serve

Play path, live and cheap:

1. He starts a session, the app pulls published questions for a skill from Postgres
2. The loop runs entirely on stored content, no LLM call (see 01)
3. Results write back to sessions and session_answers
4. XP and streak update, leaderboard reflects it on its schedule (see 06)

The key property. Serving a session costs nothing beyond a database read. All LLM cost is pushed into the offline content path where it is batched and bounded.

## LLM choice

Use a cheap, fast model for generation since it runs offline and quality is backstopped by your review. A low-cost tier from any major provider works. Math needs little or no LLM at all. English and Tamil use it for phrasing and exercise variation. Pick on price and Tamil quality, and test Tamil output specifically before committing, since that is the weak spot.

## Cost reality

At one user this is effectively free.

- Supabase free tier, plenty for one user and a small content pool
- Vercel free or hobby tier
- LLM cost is a handful of small batch jobs, cents, not dollars, because generation is infrequent and offline
- Audio for Tamil is the only real variable. Self-recording the core set is free. A TTS service adds a small one-time cost for the seed vocabulary

If it grows to a cohort, the same architecture holds. More content and more users, but serving stays a database read and generation stays batched.

## Security notes that matter

- Never send the answer field to the client before submission. Grade server-side or withhold the answer. Kids will open dev tools
- Gate the review view and all draft or pending content behind the admin role
- Standard Supabase row level security so a student can only ever see their own data and their own cohort
