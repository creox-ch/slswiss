-- forms-mvp-backend: статус-модель модерации для services (каталог) и events
-- Прогнать один раз в Supabase → SQL Editor. Идемпотентно (IF EXISTS / IF NOT EXISTS).
-- Модель: заявки и живой контент в одной таблице, различаются полем status.
--   status: 'pending_moderation' (по умолчанию) -> 'approved' | 'rejected' (модератор).
-- Существующие строки помечаем 'approved', чтобы не пропали из публичного каталога.

-- ========================= EVENTS =========================
alter table public.events add column if not exists status text;
update public.events set status = 'approved' where status is null;          -- существующие → видимы
alter table public.events alter column status set default 'pending_moderation';
alter table public.events alter column status set not null;
alter table public.events drop constraint if exists events_status_chk;
alter table public.events add constraint events_status_chk
  check (status in ('pending_moderation','approved','rejected'));

-- RLS: публично видно только approved; автор видит свои любые; вставка — только pending от автора
drop policy if exists "Public events"        on public.events;
drop policy if exists "Auth create event"    on public.events;
drop policy if exists "Public read approved events" on public.events;
drop policy if exists "Auth read own events"  on public.events;
drop policy if exists "Auth insert pending event" on public.events;

create policy "Public read approved events" on public.events
  for select to public using (status = 'approved');
create policy "Auth read own events" on public.events
  for select to authenticated using (auth.uid() = created_by);
create policy "Auth insert pending event" on public.events
  for insert to authenticated with check (auth.uid() = created_by and status = 'pending_moderation');

-- ========================= SERVICES (каталог) =========================
alter table public.services add column if not exists status text;
update public.services set status = 'approved' where status is null;        -- существующие → видимы
alter table public.services alter column status set default 'pending_moderation';
alter table public.services alter column status set not null;
alter table public.services drop constraint if exists services_status_chk;
alter table public.services add constraint services_status_chk
  check (status in ('pending_moderation','approved','rejected'));

-- Чистим дубли старых политик + ставим новые под статус-модель
drop policy if exists "Public services"      on public.services;
drop policy if exists "Public read services" on public.services;
drop policy if exists "Auth create service"  on public.services;
drop policy if exists "Auth insert service"  on public.services;
drop policy if exists "Public read approved services" on public.services;
drop policy if exists "Auth read own services" on public.services;
drop policy if exists "Auth insert pending service" on public.services;

create policy "Public read approved services" on public.services
  for select to public using (status = 'approved');
create policy "Auth read own services" on public.services
  for select to authenticated using (auth.uid() = owner_id);
create policy "Auth insert pending service" on public.services
  for insert to authenticated with check (auth.uid() = owner_id and status = 'pending_moderation');

-- Проверка после прогона:
--   select status, count(*) from public.services group by status;
--   select status, count(*) from public.events   group by status;
