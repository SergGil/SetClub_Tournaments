# Зняття гравця з турніру (walkover)

## Контекст

Гравець достроково знімається з турніру (SINGLES/MIXED). Усі його ще не зіграні (SCHEDULED)
матчі мають автоматично закритись технічною поразкою (walkover) на користь суперника — щоб
турнір і плейофф могли коректно продовжитись. При цьому:

- суперник отримує звичайний залік перемоги в турнірній таблиці (wins/matchesPlayed);
- сам матч **не** рахується як особиста поразка гравця, що знявся (його losses/matchesPlayed
  не зростають);
- матч **повністю виключається з рейтингу** (Glicko-2/OpenSkill/Set Club очки) для обох сторін.

Дія — масова, на рівні учасника (одна кнопка "Зняти з турніру" в ростері), не точковий
прапорець на кожному матчі. DOUBLES свідомо не підтримується — зняття одного гравця з пари
суттєво складніше (партнер, повторне комплектування) і не було попрошено.

Свідомо поза скоупом: "скасувати зняття". Якщо адмін помилився — виправлення вручну (рахунок
окремого матчу, "Обнулити турнір").

## Дизайн

**Схема.** `TournamentParticipant.withdrawnAt: DateTime?` (null = активний) і
`Match.walkover: Boolean` — окреме поле від уже наявного `retired` (те означає "здався ПОСЕРЕД
зіграного матчу", рахується як звичайна поразка + рейтинг; `walkover` — протилежна семантика).

**Статистика/таблиця.** Скрізь, де матч вручну перебирається для `wins`/`losses`/
`matchesPlayed`/games (`player-stats.ts`, `tournament-standings.ts`, `bracket-advancement.ts`'s
`computeGroupStandings`) — один патерн: сторона-переможець нараховується як завжди, сторона, що
програла walkover, пропускається повністю. `recordHeadToHead` викликається для обох сторін як
завжди навіть для walkover — це внутрішня структура для `isRoundRobinComplete`/tie-break, не
показується користувачу; якщо її не писати, група ніколи не покаже "дограно" і плейофф не
сформується для групи зі знятим гравцем.

**Просування по сітці.** `groupRankPlayer` виключає знятих гравців із кандидатів на rank 1/2/3
(інакше знятий міг би "паперово" мати найвищий winPct через менше зіграних матчів і потрапити в
плейофф) — фільтр застосовується після сортування, не до підрахунку (щоб суперники знятого
отримали свій h2h/матчі коректно). `withdrawParticipantAction` перепускає кожен щойно закритий
матч через той самий `computeAdvancementPropagation`, що й `saveScoreAction` — той самий
двоетапний cascade-reset confirm (`CascadeResetPendingError`), якщо закриття скидає вже зіграний
матч нижче по сітці.

**Очки.** `computeMatchPoints([])` повертає `{A:0,B:0}` — для walkover явна гілка на місці
виклику (не в самій функції) підставляє переможцю фіксовані 2 очки (як за перемогу в 1 сеті).

**Рейтинг.** Один фільтр `walkover: false` у `fetchRatingMatchRows` (`ratings-data.ts`) —
єдина точка входу для Glicko-2/OpenSkill/Set Club очок/снапшотів, виключає walkover з усього
ланцюжка одразу.

**Club-wide H2H.** `buildHeadToHeadMatrix` (видима на профілі гравця статистика, окремо від
внутрішньої h2h-мапи вище) для walkover пише лише `wins` переможця, без `losses` програвшого.

**Ростер.** Знятий гравець лишається в ростері (з бейджем "Знявся"), виключається з пулу
`roster`, що йде в рандомайзери/ручне створення матчу/додавання в кастомну групу.

## Код/файли

`prisma/schema.prisma`, `src/lib/player-stats.ts`, `src/lib/stats.ts`,
`src/lib/tournament-standings.ts`, `src/lib/bracket-advancement.ts`,
`src/lib/rating/ratings-data.ts`, `src/lib/head-to-head.ts`, `src/lib/actions/matches.ts`
(експорт `buildBracketSnapshot`/`CascadeResetPendingError`), `src/lib/actions/tournaments.ts`
(`withdrawParticipantAction`), `src/lib/audit-actions.ts`,
`src/lib/actions/randomize-singles.ts`/`randomize-singles-groups12.ts`,
`src/components/admin/tournament-roster.tsx`, `src/app/admin/tournaments/[id]/page.tsx`,
`src/components/match-summary.tsx`.

## Верифікація

Типи (`tsc --noEmit`), повний `vitest run`, і вручну: SINGLES-турнір з груповим етапом → зняти
гравця з активними SCHEDULED-матчами → перевірити бейдж у ростері, COMPLETED-статус його
матчів без рахунку, залік перемоги суперникові в таблиці, незмінний рейтинг/W-L знятого, і (для
GROUPS12) що плейофф-слот не заповнюється знятим гравцем.
