-- Bug fix: the /admin Students table always rendered "No students yet".
-- "users: read own" (001_initial.sql) only lets a caller see their own row,
-- so the admin's students query (.eq('role','student')) could only ever
-- see the admin's own row, which has role='admin' - zero rows, always.
-- Reuses public.is_admin() from 011_reading_comprehension.sql, same
-- security-definer pattern already used for passages/questions admin policies.

create policy "users: admin reads all" on public.users
  for select using (public.is_admin(auth.uid()));
