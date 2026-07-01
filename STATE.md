# STATE — SoiLüDi / slswiss

> **Если сессия слетела или Cowork переустановили — читай этот файл первым.**
> Это канонический снимок состояния проекта. Живёт в git → переживает потерю сессии,
> переустановку приложения и смену компьютера. Восстановление = `git clone` + прочитать этот файл.

**Обновлено:** 2026-07-01
**Репо:** `github.com/creox-ch/slswiss`, ветка `main`
**Прод (тест):** https://creox-ch.github.io/slswiss/ · цель — `slswiss.ch` (Netlify, позже)
**Владелец:** Kseniia Chudina (Creox)

---

## 🔴 Где мы сейчас (самое главное)

| | |
|---|---|
| **Текущий спринт** | 🟡 `unify-registration` — В РАБОТЕ (2026-07-01, ждёт CI + подтверждения Ksenia) |
| **✅ Готово (2026-06-29)** | `registration-fix` (Resend) · `resend-smtp` · `forms-mvp-backend` · `moderation` (admin approve/reject) |
| **✅ Пофикшено (2026-07-01)** | баг canton/plz после регистрации — код-фоллбэк `backfillProfileGeo` из метаданных (тест 15.1 зелёный) |
| **✅ Замкнуто (2026-07-01)** | `catalog-display` — одобренные заявки показываются в каталоге/афише (форма → модерация → публикация) |
| **✅ Роль модератора (2026-07-01)** | `moderator-role` — бейдж-счётчик, снять/вернуть публикацию, in-app статус заявок автора в профиле; тесты зелёные |
| **✅ Ещё сделано (2026-07-01)** | `legal-consent` (согласия+cookie+юр-док в футере) · `cantons-fix` · `draft-persistence` · `user-content-moderation` (статьи в модерации: автор+полный текст) |
| **Разъезд регистрации** | Google-вход пропускает кантон/PLZ/интересы (у email — есть); Apple — заглушка; Telegram не подключён → задачи `unify-registration` + `telegram-auth` в BACKLOG |
| **Ориентир по срокам** | **~01.07.2026** — открыть регистрацию (ориентир, не жёсткий дедлайн) |
| **Дальний ориентир** | **~01.09.2026** — платформа открыта для всех (ориентир) |

### ▶️ Продолжение работы (для новой сессии) — 2026-07-01

**Активного спринта нет.** За 2026-07-01 закрыто много (см. таблицу выше + BACKLOG «Сделано»). main зелёный, всё под E2E (`tests/01…15`).

**Ждём решения Ksenia (блокируют часть задач):**
- `forms-fields-spec` — подтвердить состав/обязательность полей форм (черновик `contracts/forms-fields-spec.md`, отправлен в ТГ; 4 вопроса в конце).
- `legal-consent` — юрпроверка текстов `docs/legal/*.md` (черновики) + добавить UID/CHE/телефон, возможно нем. версия.
- Модерация: отклонение **с причиной** + **уведомление автора** — отложено (см. `contracts/moderator-role.md` ⏳ и коммент №4).
- **Платежи (Payrexx):** что первым — 99 (бизнес разово) vs 19 (подписка) + подтвердить подход **Supabase Edge Functions** (slswiss статический; Next.js-роуты из билетного проекта «как есть» не переносятся). Путь оплаты — в `contracts/business-role.md`.

**Можно брать без решений (decision-light):**
- 🟡 `unify-registration` — **В РАБОТЕ (2026-07-01)**: общий экран дозаполнения `#m-complete` после любого входа (кантон/PLZ + согласие AGB), если их нет. Контракт `contracts/unify-registration.md`, тесты `tests/16-*`. Ждёт зелёного CI. Apple не трогаем (решение Ksenia).
- `telegram-auth` — вход через Telegram (переиспользует экран дозаполнения из `unify-registration`).
- Хвост `user-content-moderation`: автор видит статус своих **статей** в профиле (для services/events уже сделано в `moderator-role`).

**Что применено в БД Supabase (не потерять):**
- Статус-модель (`pending_moderation/approved/rejected`) + RLS на `services`, `events`, `articles`. Миграции: `docs/{forms-mvp,moderation,articles}-migration.sql`.
- Функция `public.is_admin()`; `profiles.is_admin` — флаг модератора.
- ⚠ **Тест-юзер `assistant@creox.ch` (секрет `TEST_USER_*`) должен быть `is_admin=true`** — иначе ~34 login-теста падают (симптом: «кнопка Выйти не найдена»).

**Как продолжить:** прочитать этот файл + `docs/BACKLOG.md` («Сделано» и «Комментарии Ksenia») + нужный контракт в `docs/contracts/`. Взять пункт из «decision-light» или дождаться решений Ksenia.

### ✅ Сделано — `forms-mvp-backend` (2026-06-29)
Формы «Добавить в каталог» и «Добавить событие» пишут заявки в Supabase.
- **Статус-модель модерации** на существующих таблицах `services` (каталог) / `events` —
  НЕ отдельные `*_submissions`. Заявка → `status='pending_moderation'`; модерация позже = смена статуса.
- Запись от **авторизованного** юзера (регистрация заработала), `owner_id`/`created_by = user_id`.
- **RLS:** публично видно только `approved`; автор видит свои; вставка только `pending` от автора.
- Починен баг ложного success (overlay закрывается только после ответа БД), loading, защита от двойного клика,
  проверка даты события в прошлом. Чинит и поломку каталога (слал несуществующую колонку `status`).
- Миграция: `docs/forms-mvp-migration.sql` · E2E: `tests/08-forms.spec.js` (CI зелёный).
- Разблокированы `catalog-moderation` / `events-moderation` (админ-UI смены статуса).

### ✅ Сделано — `registration-fix` (2026-06-29)
Регистрация работает end-to-end: signup → письмо подтверждения (Resend SMTP) → клик по ссылке → залогинен на `/slswiss/`.
- Провайдер писем — **Resend** (не SendPulse). DNS под Resend стоит в Hostpoint (DKIM/SPF на `send.slswiss.ch`, регион eu-west-1).
- Ключевой фикс: `emailRedirectTo` в коде (`authRedirectURL()` = текущая страница), т.к. поле Site URL в Supabase роняло redirect на корень GitHub Pages. См. `docs/registration-go-live.md`.
- ⚠ Остаточный не-блокер: письма пока попадают в **Спам** (новый домен + ссылка на supabase.co). Вынесено в `email-deliverability` (BACKLOG) — прогрев/брендинг шаблона.

---

## 📁 Реальная структура репо (ВАЖНО — не путать с устаревшими доками)

```
slswiss/
├── STATE.md              # этот файл — точка входа
├── CLAUDE.md             # правила для агента, real selectors, JS-валидация
├── AGENT-PROMPT.md       # шаблон запуска спринта
├── HANDOFF.md            # заметки по тестам, известные баги
├── index.html            # ⭐ ГЛАВНОЕ приложение (~440 КБ, single-file SPA)
├── tests/                # Playwright: 01-auth … 15-articles-moderation + helpers.js (CI гоняет их на пуш)
├── .github/workflows/test.yml   # CI (paths-ignore: только .github/** и **.md)
└── docs/                 # ⭐ источник истины по процессу
    ├── PROCESS.md · BACKLOG.md · roadmap-to-2026-09-01.md · IVANNA-NEXT-SPRINT.md
    ├── registration-go-live.md            # рунбук Resend/DNS
    ├── {forms-mvp,moderation,articles}-migration.sql   # ПРИМЕНЁННЫЕ миграции статус-модели + RLS
    ├── legal/{impressum,datenschutz,agb}.md            # юр-черновики (нужна юрпроверка)
    ├── meetings/meeting-extract-2026-06-18.md
    └── contracts/
        ├── _template.md · registration-fix · forms-mvp-backend · moderation · catalog-display
        ├── forms-fields-spec.md            # ⏳ ждёт подтверждения Ksenia (поля форм)
        ├── user-content-moderation.md      # ✅ closed (статьи)
        ├── moderator-role.md               # зонтичный контракт РОЛИ модератора
        └── business-role.md                # зонтичный контракт РОЛИ бизнеса (путь оплаты 99)
```

> ⚠️ **Главный файл — `index.html`.** Старые доки иногда называют его `soiludi_v4.html` —
> такого файла НЕТ. Админ-файла (`soiludi_admin.html`) тоже нет.

> 🆕 **Role-контракты** (`*-role.md`) — новый тип: не один спринт, а вся роль целиком
> (story map + все пути по 7 вопросам + тест-план). `[x]` = сделано, `[ ]` ⏳ = будущий под-спринт.
> Использовать как источник задач и как образец «как не упустить детали». Метод — в `docs/PROCESS.md`.

---

## 🔧 Реальные селекторы и факты (проверено в коде)

- Логин-модалка: `#m-login` · email `#login-email-input` · пароль `#login-pwd-input` ·
  submit `getByRole('button', { name: 'Войти', exact: true }).last()`
- Регистрация: `#m-reg`, шаги `#rs1`/`#rs2`/`#rs3`
  - Шаг 1: `#rs1-first`, `#rs1-last`, `#rs1-email`, `#rs1-pwd`, кнопка `#rs1-next`
  - Ошибки: `#rs1-first-err`, `#rs1-email-err`, `#rs1-pwd-err`, `#rs2-plz-err`
  - Шаг 2: `#rs2-canton` (select), `#rs2-plz`, кнопка `#rs2-next`
  - Экран после регистрации: `#m-checkemail` (адрес в `#checkemail-addr`, resend `#resend-btn`)
- Шапка: вход `button.btn-login` · регистрация `button.btn-join:has-text("Вступить")`
- Навигация: `nav li:has-text("Кантоны")` — это `<li>`, не `<a>`
- baseURL: `https://creox-ch.github.io/slswiss/` → в тестах `page.goto('')`, НЕ `'/'`
- Supabase: `dwcmiommviauwzkhkbki.supabase.co`

### Статус известных багов
- ✅ Дубликат `#login-email-input` — **исправлен** (в коде один элемент)
- ✅ `showModal()` undefined — исправлен · ✅ конфликт `createEvent` — исправлен
- ⚠️ Верхняя кнопка «+ Добавить в каталог» в баннере не открывает форму (рабочая — нижняя). Решить в `forms-mvp-backend`.

---

## 🔄 Процесс (кратко — полностью в `docs/PROCESS.md`)

Planner → Agent → Evaluator, 1 спринт/неделю.
1. **Planner** (Kseniia) пишет черновик `docs/contracts/<feature>.md`
2. **Evaluator** критикует контракт (edge cases, UI-инварианты, mobile)
3. **Planner** финализирует → контракт **неприкосновенен**
4. **Agent** (этот чат) реализует в `index.html` по пунктам, маленькие коммиты
5. **Evaluator** (CI + тестовый чат) пишет Playwright из контракта, разбирает падения
6. Петля до зелёного CI → спринт closed → обновить `docs/BACKLOG.md`

**Правила:** контракт = истина; не выходить за scope (всё лишнее → BACKLOG);
не пушить если `node --check` падает или прошлый CI красный без фикса.

### JS-валидация перед коммитом (обязательно)
```bash
python3 -c "import re; c=open('index.html').read(); s=re.findall(r'<script[^>]*>(.*?)</script>', c, re.DOTALL); open('/tmp/main.js','w').write(max(s,key=len))"
node --check /tmp/main.js
```

---

## ▶️ Как возобновить работу после сбоя

1. Открой папку проекта в Cowork (CLAUDE.md подхватится сам).
2. Скажи агенту: **«прочитай STATE.md и docs/IVANNA-NEXT-SPRINT.md»**.
3. Агент знает: текущий спринт, что на паузе, реальные файлы и селекторы — и продолжает с нужного места.
4. Контракт текущего спринта — в `docs/contracts/`. Это источник истины.

### Чего я (агент) НЕ могу из этой среды
- `gh` CLI не установлен → **статус CI читать на github.com** (или у себя), не через `gh run`.
- Push зависит от сохранённых кредов GitHub — если не пустит, коммит остаётся локальным.

---

## 🗺️ Что дальше по дорожной карте (полностью — `docs/roadmap-to-2026-09-01.md`)

`registration-fix` → `payment-provider` → `business-99` → `access-logic` →
`subscription-19` → `birzha-auth` (это critical path к 01.09).

**Темп работы:** ~10 спринтов на горизонте до сентября. Идём в комфортном темпе, без гонки —
даты выше ориентиры, а не жёсткие обязательства. Если что-то не успевается — сдвигаем спокойно.
Опции при необходимости (в roadmap): второй разработчик / вынести часть за ориентир / урезать MVP.

---

## 🧾 Закрытые продуктовые решения (не пересматривать без причины)
- Защита от ботов: **email-confirmation** (НЕ капча)
- Поля регистрации: текущие 2 шага (имя/фамилия/email/пароль → kanton/PLZ)
- После регистрации: редирект на главную как залогиненный
- Premium: **19 CHF/мес** (подтверждено встречей 06-18)
- Каталог бизнеса: 99 CHF разово за карточку

---

## История STATE.md
- **2026-07-01** — большая сессия: закрыты `catalog-display`, `moderator-role` (бейдж, снять/вернуть,
  in-app статус автора), `cantons-fix`, `draft-persistence`, `legal-consent` (согласия+cookie+юр-док в футере),
  `user-content-moderation` (статьи в модерации: автор+полный текст). Фикс canton/plz. Все с E2E, main зелёный.
  Обработаны 6 комментариев Ksenia (см. BACKLOG «Комментарии Ksenia»). Ждём Ksenia: спека полей, юрпроверка,
  решения по платежам. Добавлен раздел «Продолжение работы» выше.
- **2026-06-29** — `forms-mvp-backend` закрыт: формы каталога/событий пишут в Supabase по **статус-модели**
  (status на `services`/`events`, авторизованная вставка, RLS). E2E `08-forms` зелёные. Контракт уточнён
  против черновика (не `*_submissions`, не аноним). Активного спринта нет — выбрать следующий.
- **2026-06-29** — `registration-fix` закрыт: регистрация рабочая end-to-end через **Resend SMTP**.
  Фикс `emailRedirectTo` в коде (обход бага Site URL). Остаток — спам-доставка (не блокер, → BACKLOG).
  Снят с паузы; текущий спринт снова `forms-mvp-backend`.
- **2026-06-29** — даты 01.07 и 01.09 переформулированы как ориентиры (а не жёсткие дедлайны):
  убраны формулировки про давление, гонку и «нулевой резерв». Темп комфортный, даты можно сдвигать.
- **2026-06-24** — создан. Процессные доки перенесены из Project knowledge в `docs/`,
  чтобы пережить потерю сессии. Исправлен дрейф `soiludi_v4.html` → `index.html`,
  текущий спринт в доках выставлен на `forms-mvp-backend`.
