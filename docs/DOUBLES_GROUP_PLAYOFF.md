# Плей-офф для парного "За групами" (2 групи по 4 пари)

## Контекст

У діалозі жеребкування пар (стратегія "За групами") користувач хоче опційний чекбокс: коли групи
рівно 2 (по 4 пари в кожній), одразу після групового етапу сформувати плей-офф на 1-8 місце:

1. 1/2 (верх, за 1-4): A1-B2, A2-B1 → переможці грають Фінал, програші — За 3 місце.
2. Півфінал за 5-8 (низ): A3-B4, A4-B3 → переможці грають За 5 місце, програші — За 7 місце.
3. Увесь скелет із 8 матчів плей-офф видно одразу (порожні плейсхолдери, без складу) поряд із 12
   груповими матчами — і **заповнюється сам**, щойно визначається джерело кожного слоту
   (завершується групова стадія / попередній раунд плей-офф), без ручного втручання адміна.

Це **не нова інфраструктура** — той самий механізм, що вже є в SINGLES-рандомайзері "4 групи по 3
+ плей-офф" (`docs/GROUPS12_PLAYOFF.md`): статична топологія сітки
(`src/lib/doubles-group-playoff-bracket.ts`, аналог `src/lib/groups12-playoff-bracket.ts`),
резолвер (`src/lib/bracket-advancement.ts::computeAdvancementPropagation`, той самий, що вже є —
лише узагальнений з "1 гравець на слот" на "команда (1-2 гравці) на слот"), і той самий патерн
коміту: групові + плейсхолдер-матчі + `MatchAdvancement`-рядки в одній транзакції.

**Жодної зміни схеми Prisma не знадобилось** — `MatchAdvancement.sourceRank` уже просто `Int?` без
constraint на 1-3, розширення до 1-4 (рейтинг команди в групі з 4) — суто TS-типова зміна.

## Узагальнення резолвера на команди

Найбільша частина роботи — `src/lib/bracket-advancement.ts` раніше розумів лише "заповнити
сторону одним гравцем" (`groupRankPlayer`, `DesiredFill.playerId: string | null`). Парний матч —
сторона з ДВОМА гравцями, тож:

- `TournamentBracketSnapshot` отримав `format: "SINGLES" | "DOUBLES"` (явно, а не вгадування з
  кількості гравців на стороні матчу — коректно навіть поки жоден матч групи ще не завершено).
- `DesiredFill.playerId` → `DesiredFill.playerIds: string[]` (порожній масив = "ще не вирішено").
- `groupRankPlayer` (SINGLES, player-keyed) лишився **без змін** усередині — обгорнутий новою
  `groupRankTeam`, яка для DOUBLES іде новим шляхом: `computeDoublesGroupStandings` (аналог
  `computeGroupStandings`, але team-keyed — команда = двоє гравців групи, той самий принцип, що й
  `buildTeamRows`/`teamGroup()` в `tournament-standings.ts`).
- `matchOutcomePlayer` → `matchOutcomeTeam` (бере всіх гравців сторони, не лише одного) — вже
  природно працює для обох форматів.

Це строго адитивний рефакторинг: для SINGLES-снепшота `playerIds` завжди має рівно 1 елемент —
функціонально ідентично попередній поведінці (усі наявні тести для GROUPS_12_PLAYOFF пройшли без
змін логіки, лише форма фікстур `playerId` → `playerIds`).

## Топологія сітки (`src/lib/doubles-group-playoff-bracket.ts`)

Групи нумеруються 1=A, 2=B (`groupRoundLabel`, `src/lib/randomize-pairs.ts`). 8 плейсхолдер-матчів,
16 рядків `MatchAdvancement`:

```
SF_TOP (1/2):        A1 - B2   →  FINAL:         winner(SF_TOP) - winner(SF_BOTTOM)
SF_BOTTOM (1/2):     A2 - B1   →  THIRD_PLACE:   loser(SF_TOP)  - loser(SF_BOTTOM)

LOWER_SF_TOP:         A3 - B4   →  FIFTH_PLACE:   winner(LOWER_SF_TOP) - winner(LOWER_SF_BOTTOM)
LOWER_SF_BOTTOM:      A4 - B3   →  SEVENTH_PLACE: loser(LOWER_SF_TOP)  - loser(LOWER_SF_BOTTOM)
```

Новий round-мітка `LOWER_SEMIFINAL_ROUND = "Півфінал за 5-8"` (`src/lib/playoff-rounds.ts`) —
навмисно НЕ "1/2" (це не той самий раунд глибини, а паралельна сітка за нижчі місця) і НЕ "Втішний
півфінал" (`CONSOLATION_SEMIFINAL_ROUND` — той механізм для програних чвертьфіналів, losers
bracket; тут — прямий crossover з 3-4 місць групи, без залежності від іншого матчу). Як і
`CONSOLATION_SEMIFINAL_ROUND`/`MINI_GROUP_ROUND`, свідомо поза `PLACEMENT_ROUNDS` — 2 матчі
легально ділять цю мітку.

**Bracket-relative групи "1"/"2" — не літеральні номери груп.** `validateGroupPlayoffEligibility`
(`src/lib/actions/randomize-doubles.ts`) визначає реальні 2 номери групи (`TournamentParticipant.
group`), сортує за зростанням, і мапить менший → "1"/A, більший → "2"/B при записі
`MatchAdvancement.sourceGroup`. Це коректно навіть коли адмін обрав 2 з кількох уже наявних груп
(наприклад, групи 3 і 5), а не завжди 1 і 2.

## Commit-дія

`drawDoublesGroupsAction`/`commitDoublesGroupsAction` (і padel-дзеркало) отримали `withPlayoff:
boolean = false`. Валідація — і в draw, і в commit (defense-in-depth): рівно 2 групи, у кожній
рівно 4 команди (виводиться напряму з фактичних matchups, що йдуть у commit, а не з кількості
учасників — коректно незалежно від того, як групи сформувались). Інакше — `"Плей-офф доступний
лише коли рівно 2 групи по 4 пари кожна"`.

## UI

Чекбокс "Сформувати плей-офф на 1-8 місце" у діалозі жеребкування (`randomize-matches-button.tsx`,
і padel-дзеркало) — видимий лише коли стратегія "За групами" **і** придатність уже видно з наявних
пропсів (`roster.length`/`groupCounts`), без потреби чекати на сам жеребок:

```ts
const canOfferGroupPlayoff =
  strategy === "CUSTOM_GROUPS" &&
  (canSplitByGroup
    ? Object.keys(groupCounts).length === 2 && Object.values(groupCounts).every((c) => c === 8)
    : groupCount === 2 && roster.length === 16);
```

Коли недоступно — приглушена підказка чому (той самий стиль, що й groups12's "Потрібно рівно 12
учасників і рівно 4 сіяних").

## Таблиця результатів — нового коду не знадобилось

`getTournamentStandingsRows`'s DOUBLES-гілка вже викликає `buildGeneralPlacedTableForTeams`
(`src/lib/tournament-standings.ts`) для **будь-якого** парного турніру з реальними вирішальними
матчами (`PLACEMENT_ROUND_RANKS` — Фінал/За 3/5/7/9/11 місце), команда-keyed — той самий шлях, що
вже показує "Підсумкову таблицю" для будь-якого вручну зібраного парного плей-офф. Щойно
з'являються матчі з мітками "Фінал"/"За 3 місце"/"За 5 місце"/"За 7 місце", зведена таблиця 1-8
з'явиться автоматично поряд із таблицями "За групами".

## Плейсхолдер-слот показує джерело, а не голий "?"

Той самий механізм, що вже описаний для GROUPS_12_PLAYOFF (`docs/GROUPS12_PLAYOFF.md`) —
`emptySlotLabel` (`src/lib/match-display.ts`) — покриває й ці 8 матчів: "Переможець Групи A"/"2-ге
місце Групи A" для `GROUP_RANK`-слотів (SF_TOP/SF_BOTTOM/LOWER_SF_*), "Переможець 1/2"/"Той, хто
програв 1/2" для `MATCH_RESULT`-слотів (Фінал/За 3/5/7 місце) — нового коду для парного випадку не
знадобилось, лише спільна `matchWithDetailsInclude`'s `advancementsAsTarget`.

## Мобільний застосунок

`/api/v1/tournaments/[id]/randomize/doubles/{draw-groups,commit-groups}/route.ts` (і padel-
дзеркало) читають `withPlayoff` з тіла запиту (`body?.withPlayoff === true`), той самий контракт,
що й веб.

`mobile/src/app/(tabs)/tournaments/[id]/randomize.tsx` — тумблер (`Switch` з `react-native`, не
кастомний `Checkbox`-компонент, якого в мобільному UI ще нема) у секції "За групами". На відміну
від веб-діалогу, мобільний екран не має власного input'у "кількість груп" для свіжого розбиття
(`useDrawDoublesGroups` завжди йде проти вже призначених у ростері груп) — тож придатність рахується
простіше, напряму з уже завантаженого `tournament.participants` (виключаючи знятих), без окремого
запиту чи пропу `groupCounts`:

```ts
const groupHeadcounts = new Map<number, number>();
for (const p of tournament.participants) {
  if (p.withdrawnAt || p.group == null) continue;
  groupHeadcounts.set(p.group, (groupHeadcounts.get(p.group) ?? 0) + 1);
}
const canOfferGroupPlayoff =
  groupHeadcounts.size === 2 && [...groupHeadcounts.values()].every((count) => count === 8);
```

`mobile/src/features/randomize/api.ts`'s `useDrawDoublesGroups`/`useCommitDoublesGroups` отримали
`withPlayoff` параметр (мутація приймає `boolean`, за замовчуванням `false` — явна TS-анотація
`(withPlayoff: boolean = false)`, той самий обхід TVariables-інференс-багу react-query, що й
скрізь у мобільному коді з дефолтним аргументом мутації).

## Побічні фікси, знайдені під час роботи

`drawPadelDoublesGroupsAction` викликала `assignUngroupedDoublesToGroups` без поля `seeded` —
розподіл сіяних гравців по групах (`docs/CHANGELOG.md`, запис від 2026-09-11) ніколи не
мирювався в padel-дзеркало. Виправлено заразом, оскільки цей самий виклик все одно редагувався.

**Порядок показу пар під час анімації жеребкування "За групами"** (веб і мобільний, обидва читають
`randomTeams` в порядку масиву) раніше йшов послідовно по групах — спершу вся Група A розкривалась
повністю, потім Група B, замість впереміш. `buildCustomGroupsDoublesRoundRobin`
(`src/lib/randomize-pairs.ts`) раніше конкатенувала кожної групи `randomTeams` одну за одною;
тепер інтерліивить їх round-robin (по одній команді з кожної групи по черзі, поки не вичерпаються
всі), тож обидві картки груп заповнюються паралельно. Коли групи різного розміру — довша група
дописує залишок наприкінці (перевірено тестом на нерівні групи 2/4 команд).
