-- moderation: флаг администратора + RLS, разрешающий админу видеть pending и менять статус.
-- Прогнать в Supabase → SQL Editor. Идемпотентно.
-- Модель: profiles.is_admin. Менять status (approve/reject) может только админ — на уровне БД.

-- 1) Флаг администратора на профиле
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2) Хелпер: текущий юзер — админ? SECURITY DEFINER, чтобы читать profiles в обход RLS
--    (иначе политики на services/events рекурсивно упирались бы в RLS profiles).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- 3) RLS: админ видит ВСЕ заявки (в т.ч. pending) и может менять статус
drop policy if exists "Admin read all services"  on public.services;
drop policy if exists "Admin update services"     on public.services;
create policy "Admin read all services" on public.services
  for select to authenticated using (public.is_admin());
create policy "Admin update services" on public.services
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin read all events"  on public.events;
drop policy if exists "Admin update events"    on public.events;
create policy "Admin read all events" on public.events
  for select to authenticated using (public.is_admin());
create policy "Admin update events" on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4) Назначить администраторов. ПОДСТАВЬ реальные email:
--    - аккаунт Ksenia (прод-модератор)
--    - TEST_USER_EMAIL (нужно для прохождения E2E tests/09-moderation)
update public.profiles set is_admin = true
where id in (
  select id from auth.users
  where email in ('ZAMENI_KSENIA@email', 'ZAMENI_TEST_USER@email')
);

-- Проверка:
--   select email, is_admin from public.profiles p join auth.users u on u.id=p.id where is_admin;
