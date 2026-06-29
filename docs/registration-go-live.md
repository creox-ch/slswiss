# Runbook: запуск регистрации (Resend SMTP + DNS)

**Создан:** 2026-06-29
**Цель:** довести `registration-fix` до рабочего состояния — письма подтверждения реально
доходят в Inbox, клик по ссылке логинит пользователя на сайте.
**Решения:** провайдер — **Resend**, отправитель — **noreply@slswiss.ch**, домен — **slswiss.ch**.

> Код регистрации уже готов (валидация, экран «Проверь почту», resend с лимитами, вход-до-подтверждения,
> восстановление сессии из URL). Остался только внешний конфиг доставки + ручная проверка.
> Секреты (Resend API key) вводит Ksenia, не агент.

---

## Этап 1 — Resend: аккаунт и домен (Ksenia) — ⚠ почти готово

Проверено агентом 2026-06-29 через `nslookup`: домен **уже заводили в Resend в прошлой итерации**,
все DNS-записи на месте. Осталось подтвердить статус и ключ:

- [ ] Войти на https://resend.com (тем аккаунтом, где slswiss.ch уже добавлен)
- [ ] **Domains → slswiss.ch** — убедиться, что статус **Verified** (DNS уже стоит, должен быть зелёным)
- [ ] **API Keys** — взять существующий `re_…` или создать новый (Sending access). Нужен на этапе 3.

## Этап 2 — DNS в Hostpoint — ✅ СДЕЛАНО

Проверено агентом 2026-06-29, все записи Resend присутствуют и корректны (регион **eu-west-1**):

| Тип | Имя (host) | Значение | Статус |
|---|---|---|---|
| MX | `send.slswiss.ch` | `feedback-smtp.eu-west-1.amazonses.com` (10) | ✅ |
| TXT | `send.slswiss.ch` | `v=spf1 include:amazonses.com ~all` | ✅ |
| TXT | `resend._domainkey.slswiss.ch` | `p=MIGf…` (DKIM) | ✅ |
| TXT | `_dmarc.slswiss.ch` | `v=DMARC1; p=none; rua=mailto:dmarc@creox.ch` | ✅ |

Прим.: корневая почта slswiss.ch — на **Google Workspace** (MX `smtp.google.com`, root SPF
`include:_spf.google.com`). Resend живёт на поддомене `send`, конфликта нет. Корневой SPF не трогать.

## Этап 3 — Supabase: Site URL + SMTP + подтверждения (Ksenia вводит секрет)

Проект: `dwcmiommviauwzkhkbki`.

**3a. URL Configuration** (Authentication → URL Configuration) — ⭐ без этого ссылка из письма не сработает:
- [ ] **Site URL** = `https://creox-ch.github.io/slswiss/`
- [ ] **Redirect URLs** — добавить `https://creox-ch.github.io/slswiss/**`

**3b. Custom SMTP** (Authentication → Emails → SMTP Settings → Enable Custom SMTP):
- [ ] Host: `smtp.resend.com`
- [ ] Port: `465`
- [ ] Username: `resend`
- [ ] Password: `re_…` (API key с этапа 1)
- [ ] Sender email: `noreply@slswiss.ch`
- [ ] Sender name: `Свои Люди` (или `SoiLüDi`)

**3c. Подтверждения и шаблон:**
- [ ] Authentication → Providers → Email: **Confirm email = ON**
- [ ] (опц.) Email Templates → «Confirm signup»: проверить, что есть `{{ .ConfirmationURL }}`,
      добавить телеграм/поддержку в текст

## Этап 4 — Проверка end-to-end (вместе)

- [ ] Регистрация с реальным **Gmail** → письмо в Inbox (не спам) за ≤60с
- [ ] Регистрация с реальным **Outlook/Hotmail** → письмо в Inbox (не Junk)
- [ ] Клик по ссылке в письме → открывается `creox-ch.github.io/slswiss/` уже **залогиненным**
- [ ] Supabase → Authentication → Users: у юзера `email_confirmed_at` ≠ null
- [ ] Supabase → Table `profiles`: есть строка с first_name/last_name/canton/plz
- [ ] Кнопка «Отправить ещё раз»: disabled 60с, потом активна; лимит 3/час
- [ ] Попытка войти до подтверждения → экран «Проверь почту», сессии нет

## Этап 5 — Закрытие (агент)

- [ ] `contracts/registration-fix.md`: отметить выбор Resend, проставить галочки SMTP/доставка
- [ ] `BACKLOG.md`: `registration-fix` → done + дата; `resend-smtp` → done
- [ ] `STATE.md`: снять «на паузе», обновить «где мы сейчас»
- [ ] `slswiss-architecture.md`: SMTP-провайдер Resend, email-flow (если файл есть в репо)

---

## Заметки / решения

- **2026-06-29** — выбран Resend вместо ожидания SendPulse (модерация). DNS-доступ к Hostpoint у Ksenia есть.
- `emailRedirectTo` в коде не задан намеренно — Supabase редиректит на Site URL (этап 3a).
  Если позже понадобится — можно добавить явно в `sbSignUp`/`resendConfirmation`.
