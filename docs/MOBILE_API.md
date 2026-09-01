# API-шар для мобільного застосунку (RN/Expo) — `/api/v1/**`

## Контекст

Плануємо React Native (Expo) застосунок поверх наявного Next.js бекенду, з прицілом на публікацію
в Play Market і App Store. До цього стабільного HTTP API для бізнес-даних не існувало: читання
йшло напряму з Prisma всередині Server Components (`src/lib/queries/*.ts`), запис — через Next.js
Server Actions (`src/lib/actions/*.ts`, `FormData`/`ActionState`/`redirect()`), обидва контракти
непридатні для мобільного JSON-клієнта. Автентифікація — `next-auth` v5, лише Google OAuth,
**database session strategy** (сесія = рядок у таблиці `Session`, читається через cookie) — без
JWT, без токена, придатного для мобільного клієнта.

Мета: мобільний застосунок має ту саму функціональність, що й веб — перегляд і повне
адміністрування (турніри, матчі, гравці, команди, тай/раббери, новини, меню, фото, жеребкування,
користувачі), без відкладення адмінських операцій на "потім".

## Дизайн

### Автентифікація

`POST /api/v1/auth/google` — мобільний клієнт передає Google ID-токен (отриманий на пристрої),
роут верифікує його через `google-auth-library`, знаходить/створює `User`+`Account` (та сама
модель, що й `@auth/prisma-adapter` для веб-логіну), створює рядок `Session` і повертає
`{ sessionToken, expires, user }` у JSON (не cookie). Спільна бізнес-логіка, що раніше жила лише
в `events.createUser`/`events.signIn` (`src/lib/auth.ts`) — автопризначення ролі за
адмін-allowlist і автозв'язування `Player` за email — винесена в `src/lib/auth-provisioning.ts`
(`provisionNewUser`, `provisionSignIn`), щоб веб- і мобільний канал входу поводились однаково.

`POST /api/v1/auth/logout` — видаляє рядок `Session` за bearer-токеном.

Мобільний клієнт зберігає `sessionToken` (наприклад, `expo-secure-store`) і надсилає його як
`Authorization: Bearer <sessionToken>` на кожен запит до `/api/v1/**`.

### Наскрізна bearer-підтримка в `src/lib/permissions.ts`

Замість дублювання guard-ів в окремі "Api"-версії, кожна функція (`getSession`, `isAdmin`,
`requireAdmin`, `isDomainAdmin`, `requireDomainAdmin`, `isDomainsAdmin`, `requireDomainsAdmin`,
`hasAnyAdminAccess`, `requireAnyDomainAdmin`, `requireUser`) отримала необов'язковий другий
аргумент `request?: Request`. Внутрішній `resolveSession(request?)`: якщо передано `Request` із
заголовком `Authorization: Bearer <token>` — шукає сесію в таблиці `Session` напряму
(як у `test-login/route.ts`, тільки без cookie); інакше — той самий cookie-шлях через `auth()`,
що й раніше. Усі наявні виклики в Server Actions/сторінках (без аргументу) не змінили поведінки.
Як наслідок, чотири presign-роути фото (`api/{photos,menu/photo-presign,news/photo-presign,
padel-photos/presign}`) отримали bearer-підтримку "безкоштовно", просто передавши `request`
другим аргументом — окремих мобільних роутів для завантаження фото не знадобилось.

### Помилки прав доступу → HTTP-коди

`src/lib/api-auth.ts::withApiErrorHandling(handler)` — обгортка над кожним `/api/v1/**`
route handler'ом, що ловить `Error("Unauthorized: ...")`/`Error("Forbidden: ...")`, які кидають
guard-и з `permissions.ts`, і мапить їх у 401/403 замість непрокинутого 500.

### Патерн запису: "форма" і "ядро" в кожному файлі actions

Кожна експортована дія в `src/lib/actions/*.ts` ділиться на:
- `xxxCore(session, data)` — сама бізнес-логіка (Prisma-запис, `logAudit`, `revalidatePath`),
  без `FormData` і без `redirect()`;
- саму Server Action (`FormData` → `parsed.data` → `xxxCore` → `redirect()`/`ActionState`) —
  поведінка й формат не змінились для веб-адмінки;
- новий `/api/v1/**` route handler (JSON body → та сама Zod-схема → `xxxCore` →
  `NextResponse.json`) — той самий запис, той самий `revalidatePath`, той самий audit log.

Референсна реалізація патерну — `src/lib/actions/tournaments.ts` /
`src/app/api/v1/tournaments/route.ts`.

### Мапа роутів

REST там, де природний CRUD; RPC-стиль (`.../actions/...`) там, де дія — команда, а не CRUD
(жеребкування, збереження рахунку). Padel-домени дзеркалять теніс під `/api/v1/padel/**`.

| Домен | Read | Write |
|---|---|---|
| tournaments | `/tournaments`, `/tournaments/[id]` | CRUD + reset/participants/groups |
| matches | `/matches` | CRUD + `/matches/[id]/score` |
| teams | (включено в tournament) | CRUD `/teams` |
| ties | (включено в tournament) | `/ties`, `/ties/[id]/rubbers` |
| players | `/players`, `/players/[id]` | CRUD + link/unlink |
| news | `/news`, `/news/[id]` | CRUD |
| menu | `/menu` | CRUD + toggle |
| users | — (SUPERADMIN-only) | `PATCH /users/[id]/role`, `.../domains` |
| photos | — | наявні presign-роути + `actions/photos.ts::confirm*/delete*` |
| жеребкування | — | `/tournaments/[id]/randomize/*` |
| rating/leaderboard | `/rating`, `/leaderboard` | — |

## Код/файли

Готово:
- `src/lib/auth-provisioning.ts`, зміни в `src/lib/auth.ts` (events → спільні функції).
- `src/lib/permissions.ts` — `resolveSession(request?)` + bearer-підтримка в усіх guard-ах.
- `src/lib/api-auth.ts` — `withApiErrorHandling`.
- `src/app/api/v1/auth/{google,logout}/route.ts`.
- Presign-роути (`api/photos/presign`, `api/menu/photo-presign`, `api/news/photo-presign`,
  `api/padel-photos/presign`) — bearer-підтримка через `request`.
- **tournaments + padel-tournaments** — повний домен: `src/lib/actions/tournaments.ts` і
  `padel-tournaments.ts` розділені на `xxxCore`/форма-обгортку (5 form-based дій кожен) або
  отримали `request?: Request` (9 typed-arg дій кожен); `src/app/api/v1/tournaments/**` і
  `src/app/api/v1/padel/tournaments/**` (список, картка, create/update/delete/reset, participants
  add/remove/withdraw/seed/group, groups CRUD, включно з doubles-парами). Референсна реалізація
  всього патерну — дивись ці файли перед тим, як братись за наступний домен.

  **Важливо**: `tests/lib/tennis-padel-parity.test.ts` звіряє, що кожен `src/lib/actions/X.ts`
  експортує ті самі (нормалізовані) імена, що й `src/lib/actions/padel-X.ts` — тож нові `xxxCore`
  експорти треба додавати в ОБИДВА файли одночасно (tennis і padel), інакше цей тест впаде.

- **matches + padel-matches** — те саме: `xxxCore` для create/update/delete/saveScore (усі 4
  функції в обох файлах були form-based), `src/app/api/v1/matches/**` і
  `src/app/api/v1/padel/matches/**` (список з фільтром `tournamentId`/`playerId`, картка,
  CRUD, `POST .../score`).

- **teams + ties (+ padel-дзеркала)** — `createTeamAction`/`updateTeamAction`/`deleteTeamAction`
  і tie-еквіваленти вже приймали типізовані аргументи → просто `request?`; лише
  `createRubberAction`/`createPadelRubberAction` (form-based) отримали `xxxCore`. Роути під
  `/api/v1/tournaments/[id]/{teams,ties}/**` і padel-дзеркало.

- **players** (без padel-дзеркала — гравці спільні для доменів) — усі 5 дій були form-based,
  усі отримали `xxxCore`. `src/app/api/v1/players/**` (список/пошук/пагінація, картка, CRUD,
  `POST .../link`, `POST .../unlink`).

- **news** (без padel-дзеркала) — усі 3 дії form-based, отримали `xxxCore`.
  `src/app/api/v1/news/**` (список/пошук/пагінація, картка, CRUD із `photoKey`/`removePhoto`).

- **menu** (лише COFFEE, без padel-дзеркала) — усі 8 дій (sections + items, CRUD + toggle
  active) form-based, отримали `xxxCore`. `src/app/api/v1/menu/**`: `GET /menu` (публічне активне
  меню, `?all=true` — повне, лише для COFFEE-адміна), CRUD `/menu/sections`/`/menu/items`,
  `PATCH .../active`.

- **users** (SUPERADMIN-only, без padel-дзеркала) — обидві дії вже приймали типізовані
  аргументи, отримали лише `request?`. Вони кидають прості `Error`, а не повертають `{error}` —
  роути ловлять їх самі й мапують у 400 (`withApiErrorHandling` спеціально обробляє лише
  `Unauthorized`/`Forbidden`-префікси). `src/app/api/v1/users/**`: `GET /users`,
  `PATCH .../[id]/role`, `PATCH .../[id]/domains`.

- **жеребкування** (6 файлів randomize-*, кожен із padel-дзеркалом) — усі 18 функцій вже
  приймали типізовані аргументи (draw/commit пара на кожну стратегію — round robin,
  CUSTOM_GROUPS, GROUPS_12_PLAYOFF, doubles teams, doubles groups), тож лише `request?`.
  `src/app/api/v1/tournaments/[id]/randomize/**` і padel-дзеркало: `round-robin`,
  `groups/{draw,commit}`, `groups12/{draw,commit}`, `doubles/{draw-teams,commit-teams,
  draw-groups,commit-groups}`.
- **photos** — `confirmPhotoUploadAction`/`deletePhotoAction` (+ padel) вже типізовані, отримали
  `request?`. `POST /api/v1/tournaments/[id]/photos` (body `{ key, caption? }`, `key` зі
  presign-роуту), `DELETE .../photos/[photoId]`, padel-дзеркало.
- **rating + leaderboard** (read-only, без запису) — `GET /api/v1/rating` (`?season=`, singles+
  doubles Glicko-2/OpenSkill рейтинги й тренди, Set Club бали) і `GET /api/v1/leaderboard`
  (`?type=`, `?year=`, W/L-статистика, head-to-head, місячна активність, доступні роки), обидва з
  padel-дзеркалом.

Усі домени з таблиці вище реалізовано — v1 API-шар (читання й запис) для мобільного застосунку
завершено.

## Верифікація

- `npx tsc --noEmit` — чисто після кожного домену й фінально.
- `npm run build` — чисто, усі ~100 нових роутів у виводі `Route (app)`.
- `npm run test` (vitest) — 1763/1763 тестів проходять, включно з `resolveSession`
  (bearer/cookie/протермінований/відсутній токен) і `tennis-padel-parity`.
- `npm run test:e2e` (Playwright) — адмін-флоу (створення турніру/матчу, зняття з турніру,
  GROUPS_12_PLAYOFF) пройшли; 4 тести в `public-pages.spec.ts` (заголовок на головній,
  `/leaderboard`, 404 для неіснуючого турніру/гравця) падають відтворювано навіть ізольовано —
  жоден з торкнутих цією роботою файлів не бере участі в цих сторінках (головна, 404-рендеринг),
  і `git status` на початку сесії вже показував незакомічені зміни в
  `src/lib/rating/openskill.ts`/`tournament-filter.tsx`/`pill-filter.tsx`/`opponent-filter.tsx`
  від попередньої роботи користувача — найімовірніша причина, не регресія цієї сесії. Потребує
  окремого розслідування поза межами мобільного API.
- Ручна перевірка циклу: `POST /api/v1/auth/google` → `sessionToken` →
  `POST /api/v1/tournaments` (bearer) → звірити з `/admin/tournaments` у браузері →
  `GET /api/v1/tournaments/[id]` (bearer).
