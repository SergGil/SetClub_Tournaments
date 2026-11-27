# Повне рев'ю застосунку — 2026-11-27

> **Статус: усі знахідки 1–12 виправлено того ж дня** — див. [docs/CHANGELOG.md](CHANGELOG.md),
> «Повне рев'ю застосунку: усунення знахідок» за 2026-11-27. Під час виправлення №5 знайдено ще
> одну проблему (мобільне підтвердження каскадного скиду було недосяжним) — виправлено там само.
> Для №3 потрібен крок поза кодом: змінна `AUTH_GOOGLE_MOBILE_CLIENT_IDS` на Vercel. Документ
> лишається як знімок самого рев'ю.

Перевірка всього репозиторію (веб + `mobile/`) після сьогоднішніх оновлень (TypeScript 7, oxlint,
переїзд на `www.setclub.love`). Фокус — шари, де помилка коштує найдорожче: права доступу, спільні
`*Core`/server actions, мобільний API, сітка плей-оф і зняття гравців, рейтинг.

Легенда серйозності: 🔴 High · 🟡 Medium · ⚪ Low.

## Автоматичні перевірки

| Перевірка | Результат |
|---|---|
| `tsc --noEmit` (корінь) | ✅ 0 помилок |
| `oxlint` (корінь) | ✅ 0 зауважень |
| `vitest run` | ✅ 231 файл, 2475 тестів |
| `next build` | ✅ без попереджень |
| `prisma validate` | ✅ |
| `mobile/`: `tsc --noEmit`, `npm run lint` | ✅ / ✅ |
| `npm audit --omit=dev` | ⚠️ 3 high — уже відома ReDoS в `effect` через `prisma` (див. CHANGELOG) |

Перевірено й **проблем не знайдено**: кожна експортована server action викликає guard з правильним
доменом (TENNIS/PADEL/COFFEE/суперадмін); маршрути `/api/v1/**` або мають guard, або делегують дії,
що його мають; email гравців прибирається з публічних відповідей API і не потрапляє в клієнтські
компоненти; ключі фото новин/меню/турнірів прив'язані до свого префікса; JSON-LD будується з
констант; тестовий логін вимкнений у production.

## 1. Знахідки

### 🔴 1. `updateTag` у 20 функціях, які викликає мобільний API — 500 після успішного запису

Виправлення від 2026-11-13 («Мобільний API: запис більше не повертає 500») замінило `updateTag` на
`expireCacheTag` лише у файлах `*-core.ts`. Але мобільні маршрути викликають і звичайні
`"use server"`-функції з тих самих файлів дій, і в 20 із них `updateTag` лишився. Next у route
handler'і кидає помилку (`node_modules/next/dist/server/web/spec-extension/revalidate.js:59`:
`workStore.page.endsWith('/route')`) — **уже після** запису в БД. Тож мобільний застосунок бачить
«Внутрішня помилка сервера» для збереженої зміни, кеш статистики/рейтингу лишається застарілим до
60 с, а `scheduleRatingSnapshotRefresh()` (рядком нижче) не запускається.

Зачеплені функції → маршрути (теніс і падел дзеркально):

- `addParticipantAction`, `removeParticipantAction`, `toggleParticipantSeedAction`,
  `createTournamentGroupWithPairsAction`, `updateTournamentGroupPairsAction`
  (`src/lib/actions/tournaments.ts:164, 201, 255, 582, 740`) → `/api/v1/tournaments/[id]/participants/**`,
  `/groups/**`;
- `commitSinglesRoundRobinAction`, `commitSinglesGroupsAction` (`randomize-singles.ts:154, 444`),
  `commitDoublesMatchesAction`, `commitDoublesGroupsAction` (`randomize-doubles.ts:284, 612`),
  `commitGroups12PlayoffAction` (`randomize-singles-groups12.ts:249`) → `/randomize/**`;
- падельні двійники: `padel-tournaments.ts:157, 191, 244, 520, 664`,
  `padel-randomize-singles.ts:126, 394`, `padel-randomize-doubles.ts:230, 526`,
  `padel-randomize-singles-groups12.ts:218`.

Тест-запобіжник `tests/lib/cache-invalidation.test.ts:23` перевіряє лише `*-core.ts`, тому цього не
бачить. **Виправлення:** замінити всі 20 викликів на `expireCacheTag(...)`; розширити тест на кожен
файл `src/lib/actions/*.ts`, який імпортує хоч один маршрут у `src/app/api/`.

### 🔴 2. Прапорець `walkover` ніколи не скидається

`walkover: true` ставить лише зняття гравця (`tournaments-core.ts:290`,
`padel-tournaments-core.ts:241`), а жоден запис, що змінює результат матчу, його не очищає:

- `saveScoreCore` / `savePadelScoreCore` (`matches-core.ts:458-470`, `padel-matches-core.ts:379-390`);
- `updateMatchCore` / `updatePadelMatchCore` при зміні складу (`matches-core.ts:206`,
  `padel-matches-core.ts:177`);
- усі каскадні скиди сітки (`matches-core.ts:343, 512`, `padel-matches-core.ts:289, 430`,
  `tournaments-core.ts:350`, `padel-tournaments-core.ts:288`).

Кнопка «Рахунок» в адмінці доступна і для технічної поразки (`tournament-matches.tsx:252` — лише
`status !== "CANCELLED"`), діалог відкривається з порожнім рядком. Наслідки:

- адмін вносить справжній рахунок → матч і далі виключений з рейтингу, той, хто програв, не отримує
  поразки, на картці лишається бейдж «Технічна поразка»;
- адмін відкрив діалог і просто натиснув «Зберегти» → матч стає `SCHEDULED`, але `walkover` лишається
  `true` (бейдж на незіграному матчі), і будь-який майбутній рахунок теж не піде в рейтинг.

`docs/WITHDRAWAL.md` прямо радить виправляти помилкове зняття «рахунком окремого матчу» — саме цей шлях
і зламаний. **Виправлення:** додати `walkover: false` у всі перелічені записи.

### 🟡 3. Мобільний вхід через Google, найімовірніше, завжди отримує 401

`src/app/api/v1/auth/google/route.ts:36` перевіряє ID-токен лише з `audience = AUTH_GOOGLE_ID`
(веб-клієнт NextAuth). Мобільний застосунок проходить PKCE-flow з окремим клієнтом типу iOS/Android
(`mobile/src/lib/auth-context.tsx`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, «НЕ Web» за
`docs/MOBILE_APP.md`), а в такому flow Google видає токен з `aud` = id цього мобільного клієнта.
`verifyIdToken` тоді відхиляє токен → «Недійсний Google-токен». На пристрої вхід ще не перевіряли
(CHANGELOG: «Не перевірено на пристрої»), тож це варто підтвердити першим же тестом.
**Виправлення:** нова змінна (наприклад `AUTH_GOOGLE_MOBILE_CLIENT_IDS`) і
`audience: [AUTH_GOOGLE_ID, ...mobileIds]` — `verifyIdToken` приймає масив.

### 🟡 4. Прострочений мобільний токен на адмін-маршрутах дає 403, а не 401

Коли Bearer-токен недійсний, `resolveSession` повертає `null`, і `requireDomainAdmin`/
`requireDomainsAdmin`/`requireAnyDomainAdmin`/`requireAdmin` кидають `Forbidden` (`permissions.ts:51,
77, 102, 135`) → 403 з англійським «Forbidden: admin access required». Мобільний клієнт скидає сесію
лише на 401 (`mobile/src/lib/api.ts:101`), а 401 дає тільки `GET /players/me` (вкладка «Профіль»).
Тож на інших вкладках адмін бачить себе увійденим, а кожна дія падає з незрозумілим текстом.
**Виправлення:** у `require*`-guard'ах без сесії кидати `Unauthorized: sign-in required`, а
`Forbidden` лишити для «увійшов, але не має прав».

### 🟡 5. Зміна складу матчу в сітці не запускає просування плей-оф

`saveScoreCore` і `deleteMatchCore` після змін викликають `computeAdvancementPropagation`, а
`updateMatchCore`/`updatePadelMatchCore` (`matches-core.ts:133`, `padel-matches-core.ts:117`) — ні.
Якщо в турнірі з `MatchAdvancement` змінити гравців завершеного групового або сіткового матчу, його
рахунок скидається, але матчі нижче по сітці лишаються заповненими (і, можливо, зіграними) за старим
результатом. **Виправлення:** та сама гілка `hasAdvancements` → snapshot → propagation з
підтвердженням каскадного скиду, що й у `saveScoreCore`.

### 🟡 6. Зняття гравця в MIXED-турнірі ламає парні матчі

`withdrawParticipantCore` закриває матч технічною поразкою лише якщо в ньому рівно 2 гравці
(`tournaments-core.ts:284`, `padel-tournaments-core.ts:235`). У MIXED-турнірі бувають парні матчі
(рубери командних зустрічей) — для них спрацьовує гілка «слот суперника ще не заповнений»: гравця
просто прибирають, і лишається `SCHEDULED`-матч на 3 гравці. Кнопка зняття показується для всіх
форматів, крім DOUBLES (`tournament-roster.tsx:256`). **Виправлення:** для 4-гравцевого матчу —
walkover на користь протилежної сторони (або явна відмова з поясненням).

### ⚪ 7. Рубери командних зустрічей редагуються без перевірки складу команд

Рубери показуються в загальному списку матчів адмінки з тим самим `MatchDialog`.
`updateMatchCore` перевіряє лише ростер турніру, а не те, що сторона A — з `teamA`, а B — з `teamB`
(це перевіряє тільки `ties-core.ts` при створенні). Після такого редагування `buildTieTeamRows`
зараховує перемогу не тій команді. **Виправлення:** для матчу з `tieId` перевіряти склад команд так
само, як при створенні рубера.

### ⚪ 8. «Обнулити турнір» не повертає знятих гравців

`resetTournamentCore` (`tournaments-core.ts:188-190`) видаляє матчі й групи, але не очищає
`withdrawnAt`, а дії «скасувати зняття» немає. Знятий гравець і після обнулення виключений з
жеребкувань — хоча `docs/WITHDRAWAL.md` пропонує «Обнулити турнір» як спосіб виправити помилку.
Обхідний шлях — прибрати учасника й додати знову. **Виправлення:** скидати `withdrawnAt: null` при
обнуленні (або виправити документ).

### ⚪ 9. Перший мобільний вхід адміна повертає роль MEMBER

`provisionNewUser(user)` (`auth/google/route.ts:72`) підвищує роль у БД до SUPERADMIN, але у
відповідь іде старий об'єкт `user` (`:94`, `role: user.role` = MEMBER). Мобільний застосунок зберігає
цю роль і не показує адмін-розділи до повторного входу. Стосується лише нового акаунта з
`ADMIN_EMAILS`, який ще не входив через веб. **Виправлення:** перечитати користувача після
provisioning.

### ⚪ 10. Гонка в `refreshRatingSnapshots`

Рейтинг рахується до взяття advisory lock (`rating/snapshot.ts:34`), а lock береться лише на запис
(`:80`). Два майже одночасні оновлення можуть записатись у зворотному порядку — тоді в таблиці
лишається старший розрахунок до наступної мутації. Коментар там стверджує, що lock це вирішує.
**Виправлення:** брати lock до читання (або порівнювати «версію» даних перед записом).

### ⚪ 11. Неточності в коментарях і документації

- `prisma/schema.prisma:50` — коментар `UserAdminDomain` («for MEMBER users (Role.ADMIN is always a
  superadmin…)») суперечить реальній моделі (SUPERADMIN — повний доступ, ADMIN — за доменами).
- `prisma/schema.prisma:425` посилається на неіснуючий `src/lib/validation/team.ts`.
- `docs/PADEL.md` не існує, але на нього посилаються 4 місця (`schema.prisma:265, 692`,
  `src/app/admin/page.tsx:18`, `src/app/api/share/season/[year]/route.tsx:19`).
- `rating/snapshot.ts:76` — advisory lock рандомайзерів живе в `randomize-*.ts`, не в `matches.ts`.
- `tournament-ties.ts:15` — «retired/walkover rubber with no sets» отримує 2/0, але код дає 2/0
  будь-якому `retired`, навіть із сетами.

### ⚪ 12. Дрібниці UX

- Матчі без `scheduledDate` групуються й фільтруються за UTC-днем `createdAt`
  (`queries/matches.ts:133`, `matches/page.tsx:45`) — створені між 00:00 і 03:00 за Києвом
  потрапляють у попередній день.
- Прострочена сесія з cookie: адмін-layout редіректить на `/login?callbackUrl=/admin`, і посилання,
  яке відкривали, губиться.
- «Відв'язати» лишає `email` гравця, тож той самий Google-акаунт прив'яжеться знову при наступному
  вході. Діалог про це попереджає, але помилкову прив'язку так не прибрати — треба ще очистити email.

## 2. Пріоритет виправлення

1. №1 і №2 — реальні помилки даних/відповідей у проді, виправлення механічні.
2. №3 і №4 — блокують або псують мобільний вхід; №3 спершу підтвердити на пристрої.
3. №5–№8 — коректність турнірної логіки в рідкісних адмінських сценаріях.
4. №9–№12 — за нагоди.
