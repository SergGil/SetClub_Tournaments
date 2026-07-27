# Set Club — сайт тенісного клубу

## Контекст

Порожня папка проєкту, потрібно побудувати сайт "з нуля" для місцевого тенісного клубу Set Club:
Google-авторизація, ролі (адмін/учасник), створення турнірів з датами, підтримка форматів
1х1 / 2х2 / змішаний (в межах одного турніру частина матчів одиночні, частина парні),
загальна таблиця результатів за всю історію, і адмін-only редагування (учасники — тільки перегляд).

Узгоджено з користувачем:
- Стек: **Next.js (App Router) + TypeScript + Auth.js (Google OAuth) + Prisma + PostgreSQL**
- Хостинг: **Vercel + Neon** (безкоштовні плани)
- Гравці — окрема сутність **Player**, відв'язана від акаунту: адмін може створити гравця
  просто за іменем (без Google-акаунту, для історичних результатів), і такий гравець пізніше
  автоматично прив'язується до User, якщо увійде через Google з тим самим email.

## Модель даних (Prisma schema)

- **User** — акаунт через Google (id, name, email unique, image, role: `ADMIN`|`MEMBER`, createdAt).
- **Player** — учасник клубу (id, name, email? nullable, userId? nullable unique FK→User, createdAt).
  Саме Player використовується всюди в турнірах/матчах/рейтингу — не User напряму.
- **Tournament** (id, name, description?, format: `SINGLES`|`DOUBLES`|`MIXED`, startDate, endDate,
  status: `UPCOMING`|`ONGOING`|`COMPLETED`, createdById→User).
- **TournamentParticipant** — ростер (tournamentId, playerId, seed?).
- **Match** (id, tournamentId, round?, matchType: `SINGLES`|`DOUBLES`, scheduledDate?,
  status: `SCHEDULED`|`COMPLETED`|`CANCELLED`, winnerSide: `A`|`B`|null).
  `matchType` дозволяє мати одиночні й парні матчі в одному MIXED-турнірі.
- **MatchPlayer** (matchId, side: `A`|`B`, playerId) — 1 запис на сторону для singles, 2 для doubles.
- **MatchSet** (matchId, setNumber, sideAGames, sideBGames) — рахунок по сетах; переможець матчу
  рахується автоматично з більшості виграних сетів (з можливістю ручного override адміном).

Глобальна таблиця результатів (`/leaderboard`) рахується агрегуючим запитом по Match+MatchPlayer
(матчі, перемоги, поразки, win%) — без окремої денормалізованої таблиці статистики (не потрібно
на цьому масштабі).

## Авторизація та ролі

- Auth.js (NextAuth v5) з Google provider + PrismaAdapter, **database session strategy** (щоб
  зміна ролі адміном одразу відображалась, без чекання на refresh JWT).
- Бутстрап першого адміна: env `ADMIN_EMAILS` (comma-separated) — перевіряється в `createUser`
  event, якщо email у списку → role=ADMIN, інакше MEMBER.
- Адмін може змінювати ролі інших користувачів через `/admin/users`.
- Захист: middleware на `/admin/**` перевіряє `session.user.role === 'ADMIN'`; усі server actions,
  що мутують дані (створення турніру, гравця, матчу, зміна ролі) — додатково перевіряють роль
  на сервері (не покладаємось лише на приховування UI).
- Лінкування Player↔User: у `createUser`/`signIn` callback шукаємо Player з таким самим email без
  userId і прив'язуємо автоматично; адмін також може лінкувати/відв'язувати вручну.

## Структура сторінок (App Router)

```
/                              публічна головна (інфо про клуб, найближчі турніри)
/leaderboard                   загальна таблиця результатів (усі, view-only)
/players                       список гравців
/players/[id]                  профіль гравця: статистика + історія матчів
/tournaments                   список турнірів (фільтр за статусом)
/tournaments/[id]               деталі турніру: ростер, матчі/сітка, результати
/admin                         адмін-панель (лінки на розділи нижче)
/admin/tournaments/new          створення турніру (назва, дати, формат)
/admin/tournaments/[id]         редагування турніру, ростер, керування матчами/рахунком
/admin/players                  CRUD гравців (створення заглушок, лінк/анлінк до User)
/admin/users                    керування ролями User
/api/auth/[...nextauth]         Auth.js route handler
```

Мутації — через Next.js **Server Actions** (без окремого REST/API шару), з Zod-валідацією вхідних
даних.

## Технічний стек / залежності

- Next.js 16 (App Router, React 19), TypeScript, ESLint
- Tailwind CSS + shadcn/ui (форми, таблиці, діалоги для адмін-CRUD)
- Prisma ORM + PostgreSQL (Neon)
- Auth.js (`next-auth@beta`) + `@auth/prisma-adapter`
- Zod для валідації server actions
- Пакетний менеджер: npm

## Тестування

- **Vitest** — юніт-тести для чистої бізнес-логіки в `lib/` (найцінніші тести, без потреби в БД):
  визначення переможця матчу з рахунку сетів (`lib/match-result.ts`), агрегація статистики для
  `/leaderboard` (`lib/leaderboard.ts`), Zod-схеми валідації форм. Запускаються в CI/локально
  без зовнішніх залежностей.
- **Playwright** — smoke e2e для критичних шляхів: публічні сторінки рендеряться і доступні
  без логіну, `/admin/**` редіректить неавторизованих і MEMBER-користувачів, а не тільки ховає
  UI. Повний Google OAuth не автоматизуємо (немає сенсу мокати зовнішній OAuth) — для
  адмін-сценаріїв (створення турніру/матчу) використовуємо тестовий helper, що підставляє сесію
  напряму в тестову БД (обхід реального Google-логіну лише в test-режимі).
- Тести пишуться паралельно з кожним великим кроком реалізації (5–8), а не окремим фінальним
  етапом — так простіше зловити регресії одразу.

## Кроки реалізації

1. **Скафолдинг проєкту**: `create-next-app` (TS, Tailwind, App Router, ESLint), налаштування
   shadcn/ui, базова структура папок (`app/`, `components/`, `lib/`, `prisma/`).
2. **Prisma schema + міграції**: описані вище моделі, `npx prisma migrate dev`, Prisma Client
   singleton у `lib/db.ts`.
3. **Auth.js**: `lib/auth.ts` (Google provider, PrismaAdapter, database sessions, role у сесії,
   ADMIN_EMAILS бутстрап, Player↔User автолінк), route handler, middleware для `/admin/**`,
   компоненти Sign in/out, `lib/permissions.ts` з хелперами `requireAdmin()`/`isAdmin()`.
4. **UI-каркас**: layout з навігацією (Set Club брендинг), умовне відображення адмін-пунктів меню
   залежно від ролі, сторінка `/` (публічна інформація + найближчі турніри).
5. **Гравці (admin)**: `/admin/players` — список, створення (ім'я, опційно email), лінк/анлінк до
   User; публічна `/players` і `/players/[id]` зі статистикою та історією матчів.
6. **Турніри (admin)**: створення/редагування (назва, опис, дати, формат SINGLES/DOUBLES/MIXED,
   статус), керування ростером (додавання/видалення Player з турніру); публічні
   `/tournaments`, `/tournaments/[id]`.
7. **Матчі та рахунок (admin)**: у `/admin/tournaments/[id]` — створення матчу (вибір типу
   singles/doubles, обмеженого форматом турніру; вибір гравців на сторони A/B — 1 чи 2 залежно
   від типу), введення рахунку по сетах, автоматичне визначення переможця (+ ручний override).
   Публічний перегляд матчів/результатів на `/tournaments/[id]`.
8. **Глобальна таблиця результатів**: агрегуючий запит (матчі, перемоги/поразки, win%) →
   `/leaderboard`, сортування за перемогами, потім win%.
9. **Полірування**: порожні стани, базова стилізація під бренд Set Club, перевірка типів і білду.

## Ручні кроки користувача (поза кодом)

Після скафолдингу знадоблюся дані для `.env`:
- `DATABASE_URL` — зі створеного безкоштовного проєкту Neon (postgres connection string).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — з Google Cloud Console (OAuth Client, redirect URI
  `http://localhost:3000/api/auth/callback/google` для дев-режиму).
- `AUTH_SECRET` — згенерую сам (`npx auth secret` або випадковий рядок).
- `ADMIN_EMAILS` — email(и) користувача(ів), що мають стати першими адмінами (запитаю окремо).

Без цих значень локальний запуск підніметься, але вхід через Google і робота з БД не
запрацюють — про це попереджу після скафолдингу і попрошу надати дані.

## Верифікація

- `npx tsc --noEmit` та `npm run build` — перевірка типів і білду на кожному великому етапі.
- `npx prisma migrate dev` + `npx prisma studio` (за потреби) — перевірка схеми БД.
- `npm run dev` + ручна перевірка в браузері (skill `run`): навігація по сторінках, перевірка
  view-only обмежень для ролі MEMBER, створення турніру/гравця/матчу під адміном, перевірка
  таблиці результатів.
- Google-логін реально перевіримо тільки після того, як користувач надасть свої
  Google OAuth credentials та Neon `DATABASE_URL`.
