# 07. Data Model

The shared spine. Every feature reads and writes here. Supabase Postgres with row level security. This is a shape to start from, not a final migration.

## Tables

### users
The learner profile, extends Supabase auth.

| Column | Notes |
|--------|-------|
| id | Matches auth user id |
| display_name | Shown on the leaderboard |
| grade | Drives cohort and content difficulty |
| role | student or admin (admin is me, for the review view) |

### skills
The taxonomy of topics per subject.

| Column | Notes |
|--------|-------|
| id | |
| subject | math, english, tamil |
| name | Multiplication, Fractions, Grammar, etc |
| parent_id | For a skill tree, null at top level |
| difficulty_order | Sequencing within a subject |

### questions
The content pool. Filled offline, served when published.

| Column | Notes |
|--------|-------|
| id | |
| skill_id | |
| subject | |
| type | multiple_choice, text_input, matching, etc |
| prompt | Question text or reference to media |
| choices | JSON, for choice types |
| answer | Verified correct answer |
| explanation | Shown on wrong answers |
| status | draft, pending, published, rejected |
| source_ref | For grounded content, the passage or standard used |
| difficulty | Tier within the skill |

### passages
For reading comprehension. A question can reference a passage.

| Column | Notes |
|--------|-------|
| id | |
| text | The original generated passage |
| reading_level | Measured score |
| status | Same lifecycle as questions |

### sessions
One completed or in-progress run of the loop.

| Column | Notes |
|--------|-------|
| id | |
| user_id | |
| subject | |
| skill_id | |
| started_at | |
| completed_at | Null until finished |
| xp_earned | |

### session_answers
Per-question results inside a session. Feeds future adaptivity.

| Column | Notes |
|--------|-------|
| id | |
| session_id | |
| question_id | |
| was_correct | First-attempt correctness |
| attempts | How many tries |

### user_skill_progress
Adaptive engine, first slice (see 08). Current tier per student per skill, stepped +-1 after each primary-pass question based on first-attempt correctness. Seeded from grade on first use (lib/mastery.ts). Implemented in supabase/migrations/004_user_skill_progress.sql.

| Column | Notes |
|--------|-------|
| user_id | |
| skill_id | |
| tier | 1-3 |
| updated_at | |

### streaks
Daily streak state per user. Could also be derived from sessions, but a stored counter is simpler.

| Column | Notes |
|--------|-------|
| user_id | |
| current_streak | |
| longest_streak | |
| last_active_date | |
| freezes_available | |

### leaderboards
One board per cohort per week.

| Column | Notes |
|--------|-------|
| id | |
| week_id | The week this covers |
| grade | Cohort |

### leaderboard_entries
A member of a board, real or bot.

| Column | Notes |
|--------|-------|
| id | |
| leaderboard_id | |
| user_id | Set if real, null if bot |
| bot_id | Set if bot, null if real |
| xp_displayed | Current shown XP, updated on schedule for bots |

### bots
Bot identities and their pre-generated weekly plan.

| Column | Notes |
|--------|-------|
| id | |
| display_name | |
| personality | grinder, casual, etc |
| weekly_plan | JSON timeline of when it gains how much XP this week |

## Row level security

- A student can read only published questions and only their own sessions, answers, streaks
- A student can read leaderboard entries for their own cohort
- Only admin (me) can read pending and draft content and use the review view
- Never expose the answer field to the client before the question is answered. Grade server-side or withhold the answer until submission

## Notes

- Bot activity is advanced by a scheduled job (Supabase cron or a Vercel cron route) that reads weekly_plan and updates xp_displayed. See 06
- The content pool refill check also runs on a schedule. See 05
