-- user-content-moderation: статьи (articles) в статус-модель модерации (как services/events).
-- Прогнать в Supabase → SQL Editor. Идемпотентно. Требует функцию public.is_admin() (создана в moderation-migration).

-- 1) status → единый enum ('pending_moderation','approved','rejected'), старый 'pending' → 'pending_moderation'
alter table public.articles add column if not exists status text;
update public.articles set status = 'approved' where status is null;              -- на всякий случай
update public.articles set status = 'pending_moderation' where status = 'pending'; -- старый статус → новый
alter table public.articles alter column status set default 'pending_moderation';
alter table public.articles alter column status set not null;
alter table public.articles drop constraint if exists articles_status_chk;
alter table public.articles add constraint articles_status_chk
  check (status in ('pending_moderation','approved','rejected'));

-- 2) Сбросить ВСЕ существующие RLS-политики articles (имена не важны) и создать новые под статус-модель
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename='articles' and schemaname='public' loop
    execute format('drop policy if exists %I on public.articles', pol.policyname);
  end loop;
end $$;

create policy "Public read approved articles" on public.articles
  for select to public using (status = 'approved');
create policy "Auth read own articles" on public.articles
  for select to authenticated using (auth.uid() = author_id);
create policy "Auth insert pending article" on public.articles
  for insert to authenticated with check (auth.uid() = author_id and status = 'pending_moderation');
create policy "Admin read all articles" on public.articles
  for select to authenticated using (public.is_admin());
create policy "Admin update articles" on public.articles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Проверка:
--   select status, count(*) from public.articles group by status;
