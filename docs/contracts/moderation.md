# Contract: Moderation (catalog + events)

**Спринт:** `moderation` (объединяет `catalog-moderation` + `events-moderation` — одна статус-модель)
**Дата:** 2026-06-29
**Статус:** ✅ **CLOSED 2026-06-29** — модель `profiles.is_admin` подтверждена, реализовано, E2E зелёные (БЛОК 12–14).

---

## Цель

Дать модератору одобрять/отклонять заявки из `services` (каталог) и `events`. Заявки уже лежат
со `status='pending_moderation'` (спринт forms-mvp-backend). Модерация = смена статуса:
`pending_moderation → approved | rejected`. `approved` автоматически становится виден публично (RLS).

## Не входит в спринт

- Сложные роли/иерархия модераторов, SLA, аудит-лог — позже (только базовый admin-флаг)
- Модерация Биржи (`tasks`), статей (`articles`) — отдельно
- Уведомления автору о решении (email) — отдельно
- Редактирование заявки модератором — только approve/reject статуса
- Публичная выдача approved в каталог/афишу, если её ещё нет — отдельная задача (но RLS уже это позволяет)

---

## Продуктовое решение (нужно подтвердить)

- ❓ **Модель админа:** флаг `profiles.is_admin boolean default false`. Аккаунты-модераторы помечаются
  `is_admin=true` вручную (SQL). RLS проверяет этот флаг — менять статус могут только админы.
  - Альтернативы (если не подходит): отдельная таблица `admins`, или Postgres-роль. По умолчанию — флаг.
- ❓ **Кто первый модератор:** аккаунт Ksenia (её email) → `is_admin=true`. Для E2E — пометить
  тестового юзера `TEST_USER_EMAIL` админом (он подтверждён, есть в CI).

---

## Схема БД (миграция)

- [ ] `profiles.is_admin boolean not null default false`
- [ ] RLS `services`/`events` — добавить:
  - admin видит ВСЕ строки (`select ... using (is_admin(auth.uid()))`)
  - admin может `update` статус (`update ... using (is_admin) with check (is_admin)`)
  - не-админ: без изменений (видит approved + свои; insert только pending; update запрещён)
- [ ] Хелпер `is_admin(uid)` (SQL function, security definer) или inline `exists(select 1 from profiles ...)`

## UI модерации

- [ ] Пункт/экран «Модерация» виден только при `_profile.is_admin` (UX-гейт; безопасность — на RLS)
- [ ] Список заявок `status='pending_moderation'` для services и events (вкладки/секции)
- [ ] По каждой: ключевые поля + кнопки **Одобрить** / **Отклонить**
- [ ] Клик → `update status` → строка уходит из списка pending; success-уведомление
- [ ] Loading на кнопке, защита от двойного клика, честная ошибка (не ложный success)
- [ ] Пусто → «Нет заявок на модерации»

## Edge cases

- [ ] Не-админ (или аноним) НЕ может сменить статус (RLS отклоняет даже при прямом API-запросе)
- [ ] Двойной approve/reject не ломает (идемпотентно по результату)
- [ ] Approve → запись становится видна анонимной роли (status=approved проходит публичный SELECT)
- [ ] Reject → запись НЕ видна публично, остаётся у автора как rejected

## Тесты (TDD — `tests/09-moderation.spec.js`)

- [ ] admin видит экран модерации; не-админ — нет
- [ ] admin: список pending не пуст после создания заявки; approve → status=approved (проверка в БД)
- [ ] approve → анонимная роль теперь видит запись; reject → не видит
- [ ] не-админ юзер прямым REST-запросом НЕ может сделать update статуса (RLS) — 401/403/0 строк
- [ ] двойной клик не шлёт два update

## Definition of Done

1. Галочки выше отмечены
2. Миграция применена (is_admin + RLS update-политики)
3. E2E `tests/09-moderation.spec.js` зелёные в CI
4. Контракт closed, BACKLOG обновлён (catalog-moderation/events-moderation → done)
5. Архитектура модерации зафиксирована (статус-модель + admin-флаг)

---

## История

- **2026-06-29** — черновик создан (Agent выступает Planner'ом, т.к. сессия продолжается).
- **2026-06-29** — **CLOSED**. Модель `profiles.is_admin` (подтверждена). UI: кнопка «Модерация» (только админ) →
  оверлей со списком pending → approve/reject = смена статуса. Безопасность на RLS (`is_admin()`).
  E2E `tests/09-moderation.spec.js` (БЛОК 12–14) зелёные. Миграция `docs/moderation-migration.sql`.
  Урок: тест-юзер `assistant@creox.ch` должен быть помечен `is_admin=true`, иначе админ-тесты падают.
