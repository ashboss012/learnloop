-- Phase 2 completion: reading comprehension content pool + review pipeline.
-- First content in the app that isn't procedurally generated at request
-- time - an LLM-written passage has to be human-reviewed before a kid ever
-- sees it (docs/05), so this introduces the app's first real content pool
-- (passages/questions) and its admin-only lifecycle.

-- Reusable admin check, security definer so it can read public.users
-- regardless of the caller's own RLS visibility.
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.users where id = uid and role = 'admin');
$$;

-- ─── passages ────────────────────────────────────────────────────────────
create table public.passages (
  id                uuid primary key default uuid_generate_v4(),
  skill_id          uuid not null references public.skills(id),
  topic             text,
  text              text not null,
  target_grade      int not null default 4,
  reading_level     numeric not null,
  status            text not null default 'pending' check (status in ('draft','pending','published','rejected')),
  rejection_reason  text,
  generated_by      text not null default 'gemini',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.passages enable row level security;

-- No student select policy at all, intentional. The play-path reads
-- published content only through the security definer RPCs below, which
-- bypass RLS internally - same principle as never sending `answer` to the
-- client in session_questions.
create policy "passages: admin all" on public.passages
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ─── questions (content pool, distinct from session_questions) ──────────
create table public.questions (
  id                uuid primary key default uuid_generate_v4(),
  skill_id          uuid not null references public.skills(id),
  subject           text not null,
  passage_id        uuid references public.passages(id) on delete cascade,
  question_kind     text check (question_kind in ('main_idea','detail','vocabulary','inference')),
  type              text not null default 'multiple_choice',
  prompt            text not null,
  choices           jsonb,
  answer            text not null,
  explanation       text not null,
  status            text not null default 'pending' check (status in ('draft','pending','published','rejected')),
  rejection_reason  text,
  difficulty        int,
  generated_by      text not null default 'gemini',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.questions enable row level security;

create policy "questions: admin all" on public.questions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ─── session_questions: link back to source passage ─────────────────────
alter table public.session_questions
  add column passage_id   uuid references public.passages(id),
  add column passage_text text;

-- ─── play-path read RPCs, the only way a student's session ever reads
-- passages/questions ──────────────────────────────────────────────────
create or replace function public.claim_reading_passage(p_user_id uuid, p_skill_id uuid)
returns table(passage_id uuid, passage_text text)
language sql security definer as $$
  with seen as (
    select sq.passage_id, max(s.started_at) as last_served
    from public.session_questions sq
    join public.sessions s on s.id = sq.session_id
    where s.user_id = p_user_id and sq.passage_id is not null
    group by sq.passage_id
  )
  select p.id, p.text
  from public.passages p
  left join seen on seen.passage_id = p.id
  where p.status = 'published' and p.skill_id = p_skill_id
  order by (seen.passage_id is null) desc, seen.last_served asc nulls first, p.created_at asc
  limit 1;
$$;

create or replace function public.get_reading_questions(p_passage_id uuid)
returns table(id uuid, prompt text, choices jsonb, answer text, explanation text, question_kind text)
language sql security definer as $$
  select q.id, q.prompt, q.choices, q.answer, q.explanation, q.question_kind
  from public.questions q
  join public.passages p on p.id = q.passage_id
  where q.passage_id = p_passage_id and q.status = 'published' and p.status = 'published'
  order by q.created_at;
$$;

-- ─── new skill ────────────────────────────────────────────────────────
insert into public.skills (subject, name, slug, difficulty_order) values
  ('english', 'Reading Comprehension', 'english-reading-comprehension', 19);
