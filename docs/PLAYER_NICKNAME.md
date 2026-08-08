# Псевдонім гравця (nickname)

## Контекст

Деякі гравці хочуть, щоб замість імені та прізвища скрізь відображався псевдонім. Адмін вносить
псевдонім як опційне поле у формі гравця (`src/components/admin/player-dialog.tsx`). Правило
відображення:

- **Профіль гравця** (`/players/[id]`) — показує обидва: "Ім'я Прізвище (Псевдонім)".
- **Публічний UI всюди інде** (матчі, турнірні таблиці, ростери, рейтинг, лідерборд, картки
  гравців, фільтри) — якщо псевдонім є, показує тільки його; якщо нема — повне ім'я.
- **Адмінські "технічні" місця, де можна помилково переплутати гравця** (вибір гравця в матч,
  ростер, форма введення рахунку, прев'ю рандомайзерів) — показує "Ім'я Прізвище (Псевдонім)",
  як на профілі — щоб адмін бачив обидва варіанти й не помилився.
- **CSV-експорти та аудит-лог** — лишаються з реальним ім'ям (записи для судді/адміна мають бути
  однозначними).

## Дизайн

**Схема**: `Player.nickname String?` — nullable, без default, той самий патерн, що нещодавні
`withdrawnAt`/`walkover`.

**Спільний хелпер** — `src/lib/player-display.ts`: `displayName(player)` (nickname ?? name, для
публічного UI) і `fullDisplayName(player)` ("Ім'я (Псевдонім)" або просто ім'я — профіль і
адмінські пікери).

**Форма**: `src/lib/validation/player.ts` (новий опційний рядок, той самий трансформ-у-null
патерн, що `email`), `src/lib/actions/players.ts` (create/update actions), `player-dialog.tsx`
(нове поле Input), `players-table.tsx` (показ псевдоніма в адмінському списку + пошук за ним).

**Розширення вибірок**: скрізь, де Prisma-запит вибирає `player: { select: { name: true } }`,
додано `nickname: true` — безпечно саме по собі (лише додає поле), не змінює поведінку доти, доки
консюмер явно не викликає `displayName()`/`fullDisplayName()`. Це дозволило НЕ чіпати CSV-експорт
і аудит-лог — вони споживають ті самі розширені запити, але просто не читають `.nickname`.

**Застосування хелперів**: точково в JSX/label-побудові — `displayName()` у публічних місцях
(match-summary, tournament-standings' `label`, players list/profile list, rating, leaderboard,
results-carousel, matches-filters, opponent-filter), `fullDisplayName()` на профілі (`<h1>`,
`generateMetadata`) і в адмінських пікерах (tournament-roster, create-match-dialog,
add-tournament-group-dialog, score-dialog/tournament-matches, randomizer-прев'ю).

## Верифікація

`npx prisma migrate dev`, `tsc --noEmit`, `npm run build` (обов'язково після недавнього уроку з
обмеженнями "use server"-файлів — Next.js-специфічне обмеження, яке `tsc`/`vitest` не ловлять),
`vitest run`, і вручну — задати псевдонім гравцю, перевірити профіль/списки/таблиці/адмінку.
