# Contract: user-content-moderation (статьи/новости)

**Спринт:** `user-content-moderation`
**Дата:** 2026-07-01
**Статус:** `draft` — ждёт схему `articles` (запросы ниже) для миграции.

> Подключить **статьи** (`articles`) к той же статус-модели, что каталог/события: submit →
> `pending_moderation` → панель модерации (approve/reject/снять/вернуть) → публикация одобренных.
> Заодно закрывает коммент Ksenia №4 (модерация новостей: **полный текст** + **автор** для связи).

## Не входит
- Продажа гайдов / платные статьи, баллы за вклад — отдельно.
- Rich-text редактор, изображения в статьях (media-uploads).

## Зависимости
- **Зависит от:** `moderation` (панель + RLS `is_admin()`), `catalog-display` (паттерн публичного показа).
- Переиспользует: `moderateRow`, `_modRowHtml`/`_modSection`, статус-модель, `_updateModBadge`.

## Реальные поля (из кода)
Форма `showArticleForm` → `submitArticle` → `articles`:
`title` (Заголовок*), `topic` (Тема), `content` (Текст*), `author_id`, `author_name`, `status`.
⚠ Сейчас `submitArticle` ставит `status:'pending'` — **выровнять на `pending_moderation`**.

## Схема БД (нужны ответы — как для services/events)
```sql
select column_name,data_type,is_nullable,column_default from information_schema.columns where table_name='articles' order by ordinal_position;
select tablename,policyname,cmd,roles,qual,with_check from pg_policies where tablename='articles';
```
Миграция (по образцу `moderation-migration.sql`): `status` + CHECK('pending_moderation','approved','rejected'),
default pending; существующие 'pending'→'pending_moderation', прочие→'approved'; RLS:
public read approved · auth insert pending (author_id=auth.uid()) · auth read own · admin read all + update.

## Пункты (тест = пункт)
- [ ] Миграция `articles`: status-модель + RLS (как services/events).
- [ ] `submitArticle` переписан под статус-модель: pending_moderation по умолчанию, loading, защита от
      двойного клика, инлайн-ошибка (не `alert`), success только после ответа БД (не ложный).
- [ ] Панель модерации показывает **статьи** (📰) наравне с каталогом/событиями (в 3 секциях).
- [ ] Модерация статьи: в строке виден **автор** (`author_name`) и **полный текст** (раскрыть) — коммент №4.
- [ ] approve → статья видна на публичной странице «Статьи» (`page-articles`); reject/снять → скрыта.
- [ ] Автор видит статус своих статей в профиле (расширить «Мои заявки» → добавить статьи).
- [ ] RLS: аноним/не-админ не может сменить статус статьи.

## Тесты — `tests/15-articles-moderation.spec.js`
- сид approved/pending/rejected article (service_role) → панель модерации: pending видна, approve→approved;
- approved article → видна на странице «Статьи», pending — нет;
- аноним PATCH статуса статьи → RLS блок;
- (author) свои статьи со статусом в профиле.

## DoD
1. Пункты выше [x]. 2. E2E зелёные. 3. Миграция применена. 4. BACKLOG/STATE обновлены.
5. Закрывает `user-content-moderation` (BACKLOG #14) и часть коммента №4 (полный текст + автор).

## История
- **2026-07-01** — черновик. Ждёт схему `articles`.
