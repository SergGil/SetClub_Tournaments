# Журнал змін

Хронологічний запис змін, зроблених у співпраці з Claude — що змінилось, чому, і які файли
торкнулись. Найновіше — зверху.

## 2026-08-08 — SET.club: плаваюче 52-тижневе вікно "Загальний" замість щорічного обнулення

Період SET.club (парний і одиночний) скидався по календарному року (1 січня — усі бали в нуль).
Узгоджено з користувачем: додано новий, тепер **дефолтний**, режим "Загальний" — плаваюче вікно
в 52 тижні від сьогодні, як у справжньому ATP Rankings: бали за турнір діють рівно 52 тижні від
дати цього турніру, а тоді самі "згорають" по мірі того, як час іде, без різкого обнулення всіх
балів одночасно. Конкретні календарні роки лишились доступними як додаткові пілюлі поруч.

- `src/lib/rating/ratings-data.ts` — новий сентинел `ROLLING_SEASON = "rolling"` і тип
  `SetClubSeason = number | typeof ROLLING_SEASON`; `get{Doubles,Singles}SetClubPoints` тепер
  приймають `SetClubSeason` замість голого року, спільний `filterBySeason` розгалужує фільтр
  (`tournamentStartDate >= Date.now() - 52 тижні` для rolling, `getUTCFullYear() === season` для
  року). Той самий кеш-патерн (`fetchRatingMatchRows`, `unstable_cache`) і далі коректний — це
  чисте обчислення поверх уже закешованих рядків, без окремого кешу для "плаваючого" результату.
- `/rating` (`src/app/rating/page.tsx`) — `activeSeason` тепер дефолтиться на `ROLLING_SEASON`;
  пілюля "Загальний" рендериться першою в тому ж ряду, що й роки; оновлено пояснювальний текст.
- `/players/[id]` — бейдж SET.club на профілі напряму бере `ROLLING_SEASON` замість спершу
  тягнути список років і брати найновіший — той самий дефолт, що на `/rating`, без зайвого запиту.
- `docs/RATING.md` — новий розділ, плюс дрібне прибирання застарілої нотатки "одиночний Set Club
  ще не спроєктований" (давно вже спроєктований).

## 2026-08-08 — Фото турнірів у Cloudflare R2, детальний дизайн у docs/PHOTOS.md

Адміни можуть завантажувати фото зі змагань до конкретного турніру (декілька файлів відразу),
всі бачать галерею на сторінці турніру, клік відкриває оригінал у повній якості, адмін може
видаляти фото. Файли зберігаються в Cloudflare R2 (браузер вантажить напряму через presigned URL,
минаючи сервер — Server Actions мають ліміт тіла 1MB), у Postgres лише метадані й ключ об'єкта.

- **Схема** — новий `Photo` model (`prisma/schema.prisma`), `uploadedById` з `onDelete: SetNull`.
- **R2-клієнт** — `src/lib/r2.ts` (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`),
  ліниво ініціалізований (на відміну від `db.ts`'s `PrismaClient`), щоб `next build` не падав
  через відсутні R2-креденшли для фічі, яку ще не всі pages використовують.
- **Presign + Server Actions** — `src/app/api/photos/presign/route.ts` (генерує presigned PUT
  URL), `src/lib/actions/photos.ts` (`confirmPhotoUploadAction`, `deletePhotoAction`), нові
  audit-дії `photo.upload`/`photo.delete` у `src/lib/audit-actions.ts`.
- **UI** — `src/components/admin/photo-upload-dialog.tsx` (мультизавантаження з прогресом),
  `src/components/tournament-gallery.tsx` + `src/components/photo-lightbox.tsx` (сітка через
  `next/image` — перше використання в проєкті — + лайтбокс з оригіналом без стиснення), кнопка
  "Додати фото" й секція галереї на `src/app/tournaments/[id]/page.tsx`.
- **`next.config.ts`** — CSP `img-src` і нове `images.remotePatterns` для `*.r2.dev`.
- Потребує ручного налаштування R2-бакета й env-змінних (`R2_*`) — кроки в `docs/PHOTOS.md`.

## 2026-08-08 — Псевдонім гравця (nickname), детальний дизайн у docs/PLAYER_NICKNAME.md

Опційне поле "Псевдонім" у формі гравця (`src/components/admin/player-dialog.tsx`). Правило
відображення: профіль гравця показує "Ім'я Прізвище (Псевдонім)"; публічний UI всюди інде
(матчі, турнірні таблиці, ростери, рейтинг, лідерборд, картки гравців, фільтри) показує лише
псевдонім, якщо він є; адмінські "технічні" пікери, де можна помилково переплутати гравця (вибір
у матч/ростер, форма рахунку, прев'ю рандомайзерів) — так само "Ім'я (Псевдонім)"; CSV-експорти й
аудит-лог лишаються з реальним ім'ям.

- **Схема** — `Player.nickname String?` (nullable, без default, той самий патерн, що нещодавні
  `withdrawnAt`/`walkover`).
- **Спільний хелпер** — новий `src/lib/player-display.ts`: `displayName()` (nickname ?? name) і
  `fullDisplayName()` ("Ім'я (Псевдонім)" або просто ім'я).
- **Форма** — `src/lib/validation/player.ts` (опційне поле, той самий трансформ-у-null патерн, що
  `email`), `src/lib/actions/players.ts`, `player-dialog.tsx` (нове поле Input), `players-table.tsx`
  (псевдонім у списку + пошук за ним у `getPlayersPage`).
- **Розширення Prisma-вибірок** — скрізь, де запит вибирав `player: { select: { name: true } }`,
  додано `nickname: true` (`src/lib/queries/matches.ts`'s спільний `matchWithDetailsInclude`,
  `queries/tournaments.ts`, `tournament-standings.ts`, рандомайзери) — безпечно саме по собі (лише
  додає поле), тому CSV-експорт і аудит-лог не зачепило: вони споживають ті самі розширені запити,
  але просто не читають `.nickname`.
- **Застосування хелперів** — точково в JSX/label-побудові: `displayName()` у публічних місцях
  (`match-summary.tsx`, `tournament-standings.ts`'s `label`, списки/профіль гравців, `/rating`,
  `/leaderboard`, `results-carousel.tsx`, `matches-filters.tsx`, `opponent-filter.tsx`),
  `fullDisplayName()` на профілі (`<h1>`, `generateMetadata`) і в адмінських пікерах
  (`tournament-roster.tsx`, `create-match-dialog.tsx`, `add-tournament-group-dialog.tsx`,
  `tournament-matches.tsx`'s `sideLabel`, рандомайзер-actions' `nameById`).

## 2026-08-08 — Ребрендинг видимого тексту: "Set Club" → "SET.club"

Скрізь, де назва клубу чи система очок "Set Club" показується користувачу, замінили на
"SET.club" (уже й так саме так виглядає в лого — два рядки "SET." + "club"). Торкнулись:
`src/lib/site.ts` (`SITE_NAME`/`SITE_DESCRIPTION`, звідси підтягується `<title>`, footer,
apple-web-app title в `layout.tsx`), `src/components/logo.tsx` (`aria-label`), `README.md`,
перемикач моделі рейтингу та інформери на `/rating` (`src/app/rating/page.tsx`), бейдж очок на
профілі гравця (`src/app/players/[id]/page.tsx`), і відповідні тести/e2e
(`tests/components/logo.test.tsx`, `e2e/public-pages.spec.ts`). Свідомо **не** чіпали внутрішні
ідентифікатори коду (файли `setclub.ts`/`setclub-singles.ts`, функції на кшталт
`computeSinglesSetClubPoints`, storage-ключі `setclub:theme`/`setclub:bg-photo`, технічні
коментарі, історичні записи в `docs/`) — лише видимий користувачу текст.

## 2026-08-08 — Зняття гравця з турніру (walkover), детальний дизайн у docs/WITHDRAWAL.md

Нова масова дія "Зняти з турніру" в ростері (SINGLES/MIXED; DOUBLES поки не підтримується) —
закриває всі ще не зіграні (SCHEDULED) матчі гравця технічною поразкою (walkover) на користь
суперника: суперник отримує звичайний залік перемоги в таблиці, сам гравець не отримує особистої
поразки, а матч повністю виключається з рейтингу (Glicko-2/OpenSkill/Set Club очки) для обох
сторін. Учасник лишається в ростері з бейджем "Знявся".

- **Схема** — нові поля `TournamentParticipant.withdrawnAt` (nullable timestamp) і
  `Match.walkover` (boolean, окремо від семантично іншого `retired` — "здався ПОСЕРЕД зіграного
  матчу"), міграція `add_participant_withdrawal_and_match_walkover`.
- **Статистика/таблиця** (`src/lib/player-stats.ts`, `src/lib/tournament-standings.ts`,
  `src/lib/bracket-advancement.ts`) — один патерн у кожному ручному підрахунку `wins`/`losses`/
  `matchesPlayed`: сторона-переможець нараховується як завжди, walkover-програвша сторона
  пропускається повністю; `recordHeadToHead` лишається без змін для обох сторін (інакше
  `isRoundRobinComplete` ніколи не побачить групу "дограною" і плейофф не сформується).
- **Просування по сітці** (`bracket-advancement.ts`) — `groupRankPlayer` виключає знятих гравців
  із кандидатів на rank 1/2/3, не чіпаючи підрахунок самих `rows`/`h2h` (щоб суперники отримали
  коректний залік). `withdrawParticipantAction` (`src/lib/actions/tournaments.ts`) перепускає
  кожен закритий матч через той самий `computeAdvancementPropagation`, що й `saveScoreAction` —
  той самий двоетапний cascade-reset confirm, якщо закриття скидає вже зіграний матч нижче по
  сітці.
- **Очки** — `computeMatchPoints([])` для walkover дає явну гілку на місці виклику (переможець
  отримує фіксовані 2 очки, як за звичайну перемогу в 1 сеті), сигнатуру самої функції не чіпали.
- **Рейтинг** (`src/lib/rating/ratings-data.ts`) — один фільтр `walkover: false` у
  `fetchRatingMatchRows` виключає ці матчі з усього рейтингового ланцюжка (Glicko/OpenSkill/Set
  Club очки/снапшоти) одразу.
- **Club-wide H2H** (`src/lib/head-to-head.ts`) — на відміну від внутрішньої h2h-мапи вище, це
  видима користувачу статистика на профілі гравця, тож тут walkover пише лише `wins` переможця,
  без `losses` програвшого.
- **Ростер/UI** — `TournamentRoster` отримав бейдж "Знявся" і кнопку `WithdrawParticipantButton`
  (той самий `AlertDialog` + `useActionState` + двоетапний confirm, що й у `score-dialog.tsx`);
  `src/app/admin/tournaments/[id]/page.tsx` виключає знятих гравців з `roster`, що йде в
  рандомайзери/ручне створення матчу/додавання в кастомну групу; рандомайзери
  (`randomize-singles.ts`, `randomize-singles-groups12.ts`) відповідно фільтрують
  `withdrawnAt: null`; `match-summary.tsx` отримав бейдж "Технічна поразка".
- Повний дизайн-документ і обґрунтування компромісів — `docs/WITHDRAWAL.md`.

## 2026-08-08 — Фікс: діалог "Обнулити турнір" не закривався після успіху

`ResetTournamentButton`'s `AlertDialog` був неконтрольованим, а `resetTournamentAction` (на
відміну від `deleteTournamentAction`) не робить `redirect` — вона перерендерює ту саму сторінку,
тож нічого не змушувало діалог закритись сам. Зробили `AlertDialog` контрольованим (`open`/
`onOpenChange`) і додали `useEffect`, що закриває його та показує `toast.success` щойно
`state.success` стає `true`. Файл: `src/components/admin/reset-tournament-button.tsx`.

## 2026-08-08 — Сіяні першими до перших матчів групи + кнопка "Обнулити турнір"

- **`src/lib/standings-sort.ts`, `src/lib/tournament-standings.ts`** — до першого зіграного матчу
  всі учасники групи мали однакові показники (0 перемог, 0:0 по геймах), і фінальний tie-break
  (`byGamesDiffThenName`) падав прямо на сортування за алфавітом — сіяність участі в порядку не
  брала (поле `seed` взагалі не потрапляло в `StandingsRow`). Додали `StandingsRow.seed?: boolean`
  і новий крок `bySeedThenName` (сіяні перед несіяними, далі — за іменем) перед алфавітним
  fallback-ом у `byGamesDiffThenName`. Оскільки geems diff завжди 0:0 до першого матчу, це і є
  видимий порядок групи на старті турніру; реальні результати після першого зіграного матчу
  природно витісняють цей fallback, як і раніше.
- **`src/lib/actions/tournaments.ts` (`resetTournamentAction`), `src/lib/audit-actions.ts`,
  `src/components/admin/reset-tournament-button.tsx`,
  `src/app/admin/tournaments/[id]/page.tsx`** — нова кнопка "Обнулити турнір" поруч із "Видалити
  турнір": видаляє всі матчі турніру (каскадом — `MatchPlayer`/`MatchSet`/`MatchAdvancement`) і
  весь розподіл по групах (як вбудовані 1-6 через `TournamentParticipant.group = null`, так і
  кастомні "Додаткові групи" через `TournamentGroup.deleteMany`, каскадом чистить
  `TournamentGroupMember`), але залишає самих учасників турніру та їхню сіяність (`seed`) —
  дозволяє провести жеребкування заново без повторного набору ростера. Той самий гейт з
  підтвердженням словом "ВИДАЛИТИ" при завершених матчах, що й у `deleteTournamentAction`/
  рерандомайзері (`checkCompletedMatchesAcknowledged`). Кнопка задизейблена, коли обнулювати
  нічого (немає ні матчів, ні розподілу по групах).

## 2026-08-07 — Глибокий аудит на баги: 12 знахідок, усі виправлено

Чотири паралельні агенти прочесали кодову базу (server actions/auth, турнірні/рейтингові
алгоритми, шар даних, фронтенд) у пошуку реальних (не стилістичних) багів. Знайдено 12, усі
виправлено й покрито тестами де це мало сенс.

- **`src/components/rating-history-chart.tsx`** — `activeIndex` не скидався при зміні `points`
  (клієнтський перехід між профілями гравців зберігає інстанс компонента без `key`), тож перехід із
  профілю з довшою історією на профіль з коротшою міг звертатись за межі масиву й валити сторінку.
  Фікс: react.dev-патерн "adjust state during render" — порівняння `points !== prevPoints`.
- **`src/lib/date-format.ts`** — `formatDateUTC` (UTC-екстракція дня) коректна лише для
  дат-без-часу (`Tournament.startDate/endDate`, `Match.scheduledDate`), але застосовувалась і до
  справжніх timestamp-полів (`NewsPost.createdAt`, `TournamentParticipant.joinedAt`) — пост,
  опублікований вночі за Києвом, показував дату на день раніше. Додали `formatDateKyiv`/
  `toIsoDateKyiv` (фіксований `Europe/Kyiv`, а не UTC чи браузерний часовий пояс — детерміновано і
  для SSR/гідрації, і для реального дня клубу). Оновлено `src/app/page.tsx`, `src/app/news/page.tsx`,
  `src/app/news/[id]/page.tsx`, `src/app/admin/news/page.tsx` (там же прибрали
  `toLocaleDateString("uk-UA")`, що плавав за часовим поясом сервера) і
  `src/lib/export/participants-csv.ts`.
- **`src/lib/actions/matches.ts` (`deleteMatchAction`)** — видалення матчу, який був джерелом
  просування в плей-офф (`MatchAdvancement.sourceMatchId`), просто каскадно видаляло wiring без
  скидання гравця, вже підставленого у наступний матч — той лишався "осиротілим". Тепер видалення
  прогортає `computeAdvancementPropagation` (той самий механізм, що й `saveScoreAction`), трактуючи
  матч, що видаляється, як `CANCELLED` — це коректно очищує/скидає залежні слоти, а якщо це скине
  вже завершений матч нижче по сітці, просить підтвердження (той самий UX, що й для рахунку) через
  `src/components/admin/delete-match-button.tsx`.
- **`src/lib/actions/randomize-singles-groups12.ts`** — плейсхолдер "Фінал" у форматі "4 групи по
  3 + плей-офф" отримував `scheduledDate` рівно як у всіх 12 матчів груп (обидва — зсув 0 від
  `tournament.startDate`), тож міг з'являтись серед матчів груп замість того, щоб бути внизу.
  Виправлено зсувом `+1` для сітки плей-офф.
- **`src/components/admin/news-dialog.tsx`** — лічильники символів заголовка/тексту не скидались
  при повторному відкритті після скасування чи успішного збереження. Скидаються тепер у
  `onOpenChange`.
- **`src/components/horizontal-scroller.tsx`** — стрілка/fade "більше контенту праворуч"
  залишались активними назавжди, якщо контент не переповнював смугу (немає `onScroll`, немає
  оновлення) — клік по стрілці був silent no-op. Тепер стан країв рахується на кожен рендер і на
  resize вікна через `useLayoutEffect`, а не лише в обробнику скролу.
- **`src/lib/actions/players.ts` (`linkPlayerAction`)** — прив'язка гравця до застарілого/вигаданого
  `userId` (наприклад, обліковий запис видалили, поки форма була відкрита) валила необроблений
  виняток замість дружньої помилки. Додали явну перевірку існування користувача плюс fallback на
  `isForeignKeyError` для одночасного видалення.
- **`src/lib/actions/tournaments.ts` (`createTournamentGroupAction`)** — будь-яка P2002 у
  транзакції (створення групи + додавання учасників) списувалась на "групу з таким номером щойно
  створили", хоча дублікат міг бути серед `playerIds`. Тепер перевіряє ціль конфлікту
  (`uniqueConstraintTarget`), як і решта дій у файлі.
- **`src/lib/load-more.ts`** — `?show=` не мав верхньої межі, тож підміна query-параметра могла
  форсувати вибірку необмеженої кількості рядків. Обмежено до `pageSize * 100`.
- **`src/lib/test-login.ts`** — секрет тестового логіну порівнювався через `!==` (не
  constant-time). Замінено на `crypto.timingSafeEqual` у новій `matchesTestLoginSecret`. Ризик був
  теоретичний (роут і так вимкнений у продакшені), фікс — про всяк випадок.
- **`src/lib/randomize-pairs.ts` (`assignUngroupedDoublesToGroups`)** — якщо фіксована пара вже
  сиділа у двох різних групах, функція мовчки губила групу другого гравця замість того, щоб звести
  обох в одну (саме те, що вона мала гарантувати). Наразі недосяжно через виклик
  (`drawDoublesGroupsAction` відхиляє цей кейс раніше), але виправлено як захист про всяк випадок.

Файли тестів: оновлено `tests/lib/actions/matches.test.ts` (нові сценарії для
`deleteMatchAction` — без каскаду, з тихим заповненням, з підтвердженням скиду),
`tests/lib/load-more.test.ts`, `tests/lib/randomize-pairs.test.ts`,
`tests/components/horizontal-scroller.test.tsx`, `tests/components/results-carousel.test.tsx`
(останні два: jsdom не рахує реальний layout, тому за замовчуванням `clientWidth`/`scrollWidth`
завжди 0 — довелось явно мокати "контент переповнює смугу" в `beforeEach`, інакше новий
mount-час розрахунок країв читав це як "нічого скролити"). Усі 730 unit-тестів (окрім одного
відомого флакі — див. запис нижче) і `tsc --noEmit` зелені.

**Продовження флакі-тесту з 2026-08-06**: піднятий тоді timeout (1000→3000мс) на
`tournament-roster.test.tsx:91` таки не прибрав флак повністю — під повним `vitest run`
(без `--coverage`!) тест зрідка все одно не встигав. Корінь: `userEvent.setup()` за замовчуванням
ставить реальний `setTimeout`-темп між кожною симульованою подією (клік/клавіша) — п'ять
взаємодій поспіль means п'ять точок, де паралельні воркери тестів можуть перехопити event loop.
Фікс: `userEvent.setup({ delay: null })` саме для цього тесту — прибирає штучні затримки,
взаємодії виконуються синхронно в одному `act()`. Timeout 3000мс лишили як запас. Перевірено:
4/4 чисто ізольовано, 731/731 у повному прогоні. (Окремо, під час стрес-тестування виявили ще
один тест тієї самої породи — `link-player-control.test.tsx` — який теж зрідка флакає з тієї ж
причини; не займались, поза межами цього запиту.)

## 2026-08-06 — Підняли unit-coverage чотирьох слабко покритих файлів

Аудит `vitest run --coverage` показав чотири файли з реальними (не виключеними конфігом) прогалинами
в покритті: `nav-links.tsx` (63.6%), `tournament-standings.tsx` (70.6%), `stats.ts` (18.9%, майже
не покритий) і `prisma-errors.ts` (68.4%). Додали тести для кожного, не чіпаючи сам продакшн-код.
- `tests/components/nav-links.test.tsx` — тести на `NavLinksDropdownItems` (мобільне hamburger-меню),
  раніше покривались лише `NavLinksInline`; рендериться через справжній `DropdownMenu`/`DropdownMenuContent`
  з `open modal={false}`. → 100% по всіх метриках.
- `tests/components/tournament-standings.test.tsx` — тести на `PlacedTournamentStandings` (таблиця
  за призначеним місцем 1-12), яка раніше не була покрита зовсім: порожній стан, рядок без place
  (`—`), трофей лише коли `complete`, посилання на гравця, а також рендер під `mode: "grouped"` і
  edge-кейси (трофей+href одночасно, group без title). → 100% stmts/lines, 94.6% branches.
- `tests/lib/stats.test.ts` (новий файл) — усі шість експортів (`getPlayerStats`,
  `getAllPlayerStats`, `getResultYears`, `getHeadToHeadMatchRows`, `getMonthlyActivity`,
  `getTournamentStandings`), Prisma й `next/cache`'s `unstable_cache` замокані (той самий
  passthrough-патерн, що й у `tests/lib/rating/ratings-data.test.ts`), включно з рік-фільтром,
  групуванням кількох рядків одного гравця та fallback-ланцюжком `scheduledDate → completedAt →
  createdAt`. → 100% stmts/lines, 90.9% branches (було 18.9%/0%).
- `tests/lib/prisma-errors.test.ts` (новий файл) — усі чотири експорти, включно з обома формами
  P2002-таргета (класична `meta.target` і `@prisma/adapter-neon`-специфічна
  `meta.driverAdapterError.cause.constraint.fields` з лапками навколо імені колонки). → 100%/93.3%.

Загальний unit-coverage: 92.02→93.69% stmts, 84.05→85.6% branches, 91.32→93.87% funcs,
93.28→94.95% lines (усі 725 тестів у 95 файлах зелені).

**Флакі-тест і його причина**: `tournament-roster.test.tsx` під повним прогоном з `--coverage`
падав приблизно у 3 з 7 разів на `findByText("Іван")` (line 86), завжди чисто проходячи ізольовано.
Розслідування: verbose-лог показав, що сам тест виконується ~934ms — впритул до дефолтного 1000ms
таймауту `findByText`/`waitFor` з testing-library. Причина в тому, що цей конкретний тест ланцюжком
робить 5 реалістичних `userEvent`-взаємодій (відкрити select → 2 кліки по опціях → Escape → клік
«Додати всіх») перед фінальною асинхронною перевіркою — найважчий сценарій у файлі. V8-інструментація
coverage додає накладні витрати одночасно по всіх 95 файлах тестів, і паралельні воркери, змагаючись
за CPU, зрідка виштовхують цей рендер за межі таймауту. Без `--coverage` такого запасу завжди
вистачало (3/3 чисто). Підтверджено: без coverage — 3/3 успішних повних прогони; додавання нових
тестів з цієї роботи саме собою не було причиною, лише трохи скоротило й без того тонкий запас часу.
- `tests/components/admin/tournament-roster.test.tsx` — підняли таймаут цього одного `findByText` з
  дефолтних 1000ms до 3000ms. Перевірено: 3/3 чисті повні прогони з `--coverage` після фіксу (раніше
  падало в ~3 з 7).

## 2026-08-06 — Матч без учасників (заготовка плей-офф) + кнопка «Додати групу»

**Матч без учасників**: форма матчу раніше вимагала мінімум одного гравця на сторону, тож не можна
було заздалегідь завести плей-офф матч ("переможець півфіналу 1"), учасники якого стануть відомі
пізніше. Тепер сторону можна лишити порожньою і заповнити її пізніше редагуванням матчу.
- `src/lib/validation/match.ts` — `playerIdList` дозволяє 0 гравців, перевірка кількості під тип
  матчу стала "не більше" замість "точно".

**Кнопка «Додати групу»**: попередня система round-robin груп (`TournamentParticipant.group`) —
жорстко зашите число 1-6, що показується як літери A-F, без можливості додати ще. За проханням
користувача: нова таблиця `tournament_groups` дозволяє адміну в будь-який момент додати ще одну
групу з довільною назвою, поверх стандартних 1-6 — решта системи (рандомайзер, «Рандомізація за
групами», сортування в таблиці результатів) лишається так само числовою й працює з новими групами
без змін, оскільки для неї це просто ще один активний номер.
- `prisma/schema.prisma` + міграція `20260806092903_add_tournament_group` — нова модель
  `TournamentGroup` (`tournamentId`, `number`, `name`), без змін у `TournamentParticipant`.
- `src/lib/randomize-pairs.ts` — `resolveGroupLabel(group, customNames)`: `groupRoundLabel`
  (літери A-F) для 1-6, назва з нової таблиці для решти.
- `src/lib/actions/tournaments.ts` — `createTournamentGroupAction`, `setParticipantGroupAction`
  приймає номери груп понад 6, якщо вони зареєстровані.
- `src/lib/actions/randomize-singles.ts`, `randomize-doubles.ts`, `src/lib/tournament-standings.ts` —
  назви груп у прев'ю жеребкування/раунді матчу/заголовку таблиці резолвляться через нову таблицю.
- `src/components/admin/tournament-roster.tsx` — кнопка «Додати групу» (діалог з полем назви),
  `GroupSelect` підхоплює нові групи.

## 2026-08-06 — "Активність клубу" на /leaderboard: тільки активні місяці + карусель

Графіки "Матчів по місяцях"/"Турнірів по місяцях" зазвичай мали довгий рівний відрізок нульових
місяців перед тим, як клуб почав активно грати — реальна активність стискалась у малу частину
графіка. За проханням користувача: `MonthlyBarChart` (`src/app/leaderboard/page.tsx`) тепер
фільтрує місяці з `count === 0` (`bucketByMonth` у `activity-trend.ts` і далі зберігає нульове
заповнення для інших можливих споживачів — фільтрація суто на рівні відображення), і показує
решту в горизонтальній каруселі замість фіксованої сітки на всю ширину.

Для каруселі виніс спільний shell зі стрілками/fade-країв/`scrollBy`, який раніше жив тільки
всередині `ResultsCarousel` ("Останні результати" на головній), у новий
`src/components/horizontal-scroller.tsx` (`HorizontalScroller`) — `ResultsCarousel` тепер теж
використовує його замість дубльованої копії тієї самої логіки. `scrollStepPx` — опційний проп,
бо крок прокрутки для карток результатів (280px) і для вузьких колонок місячного графіка (56×4px)
природно різний.

Файли: `src/components/horizontal-scroller.tsx` (новий), `src/components/results-carousel.tsx`,
`src/app/leaderboard/page.tsx`, тести — `tests/components/horizontal-scroller.test.tsx` (новий).

## 2026-08-05 — Очки за сети замість "перемога = 2 очки", і групи A-F замість 1-6

Дві незалежні зміни за одним запитом:

1. **Очки залежать від кількості сетів у матчі.** Раніше "Очки" в таблиці результатів завжди були
   `wins * 2` — тепер `computeMatchPoints` (`src/lib/match-result.ts`) рахує їх по-іншому: матч з
   1 сета все ще дає переможцю 2 очки (програвшому — 0, гранулярності нема, сет один), а матч із
   кількох сетів (напр. best-of-3) дає 1 очко за кожен виграний сет — **обом** сторонам, тобто
   програвший 1:2 теж отримує 1 очко за свій виграний сет. `StandingsRow` отримав нове поле
   `points`, яке рахується в обох гілках `getTournamentStandingsRows` (`getIndividualRows` для
   SINGLES/MIXED — тепер підвантажує `sets` у своєму запиті матчів; `getTeamRows` для DOUBLES —
   `sets` там уже підвантажувались, лишалось тільки підсумувати очки поряд із gamesWon/gamesLost).
   Компонент таблиці більше не рахує очки сам (`row.wins * 2` прибрано), просто показує
   `row.points`.
2. **Групи показуються літерами (A-F), а не цифрами (1-6).** Зберігання й уся логіка лишились
   числовими (`TournamentParticipant.group: Int?`, `MAX_TOURNAMENT_GROUPS = 6`, сортування) — це
   суто відображення. `groupRoundLabel` (`src/lib/randomize-pairs.ts`) тепер мапить 1→"Група A" ...
   6→"Група F"; це єдина точка, звідки мітка розходиться по таблиці результатів, рандомайзерах
   (singles/doubles) і бейджах матчів — тож досить було виправити саму функцію плюс дублікат
   мітки в `GROUP_SELECT_ITEMS` (`tournament-roster.tsx`), який раніше сам собі писав "Група N".
   Матчі, створені рандомайзером до цієї зміни, досі мають у БД старий текст "Група 1" в полі
   `round` — додав нормалізацію в `LEGACY_ROUND_LABEL` (`match-summary.tsx`, той самий патерн, що
   вже існував для перейменування Сіяні/Несіяні), суто для відображення, БД не чіпається.

Файли: `src/lib/match-result.ts`, `src/lib/standings-sort.ts`, `src/lib/tournament-standings.ts`,
`src/components/tournament-standings.tsx`, `src/lib/randomize-pairs.ts`,
`src/components/admin/tournament-roster.tsx`, `src/components/match-summary.tsx`,
`src/lib/rating/setclub.ts`, `src/lib/rating/setclub-singles.ts` (лише заглушка `points: 0` для
не пов'язаного локального типу, що випадково теж називався `StandingsRow`), і відповідні тести.

## 2026-08-05 — Групи (1-6) для парних турнірів — повний аналог сінглів

У SINGLES-турнірах адмін давно міг вручну розподілити гравців по групах (1-6) у ростері, а
рандомайзер мав стратегію "За групами" (кругова система лише всередині кожної групи), з окремими
блоками в таблиці результатів. У DOUBLES цього не було взагалі — `GroupSelect` у ростері рендерився
тільки для SINGLES, рандомайзер парних завжди грав одним загальним туром на весь ростер, а таблиця
завжди повертала плаский список команд. Додав повний аналог:

- `src/lib/randomize-pairs.ts` — `assignUngroupedDoublesToGroups` (як `assignUngroupedToGroups`,
  але заздалегідь визначена пара завжди йде в одну групу як єдиний юніт, не розкидається окремо) і
  `buildCustomGroupsDoublesRoundRobin` (бакетить учасників/пари по групі, викликає вже наявний
  `buildRandomDoublesPairing` окремо для кожної групи — команди з різних груп ніколи не грають між
  собою).
- `src/lib/actions/randomize-doubles.ts` — нові `drawDoublesGroupsAction`/`commitDoublesGroupsAction`
  (дзеркалять `drawSinglesGroupsAction`/`commitSinglesGroupsAction`), плюс валідація конфлікту груп
  для заздалегідь визначеної пари (обидва гравці мають бути в одній групі).
- `src/components/admin/tournament-roster.tsx` — `GroupSelect` тепер показується і для DOUBLES (не
  тільки SINGLES; MIXED свідомо поза скоупом).
- `src/components/admin/randomize-matches-button.tsx` — нова стратегія-селект "Усі пари між собою"
  / "За групами" (видима лише коли в ростері вже є хоч одна група), з окремим reveal-UI по групах.
- `src/lib/tournament-standings.ts` — DOUBLES-гілка `getTournamentStandingsRows` тепер теж будує
  групування: команда належить групі лише якщо обидва її гравці мають однакову групу (визначається
  через `row.key.split("+")`), поріг ≥2 групи для реального спліту — той самий, що й у SINGLES/MIXED.

Заразом виправив 3 флейкі-місця в `tests/components/admin/tournament-roster.test.tsx` (той самий
відомий патерн з асинхронним монтуванням попапу Base UI `Select` у портал — див. запис нижче про
`user-role-select.test.tsx`, цей файл тоді пропустили).

Файли: `src/lib/randomize-pairs.ts`, `src/lib/actions/randomize-doubles.ts`,
`src/components/admin/tournament-roster.tsx`, `src/components/admin/randomize-matches-button.tsx`,
`src/components/admin/tournament-matches.tsx`, `src/lib/tournament-standings.ts`,
`prisma/schema.prisma` (doc-коментар), тести в `tests/lib/randomize-pairs.test.ts`,
`tests/lib/actions/randomize-doubles.test.ts`, `tests/components/admin/randomize-matches-button.test.tsx`,
`tests/lib/tournament-standings.test.ts`, `tests/components/admin/tournament-roster.test.tsx`.

## 2026-08-05 — Фікс білду на Vercel: postinstall генерує Prisma Client

Щойно налаштований автодеплой на Vercel (git-інтеграція, productionBranch = master) одразу
впав на першому ж білді: `Module not found: Can't resolve '@/generated/prisma/client'`. Причина —
`prisma/schema.prisma` генерує клієнт у кастомну директорію `src/generated/prisma` (не в
стандартний `node_modules/.prisma`), вона в `.gitignore`, а `package.json`'ний `build` — це просто
`next build`, без попереднього `prisma generate`. Локально й у CI (`ci.yml`) це приховувалось тим,
що `prisma generate` завжди запускався окремим явним кроком перед білдом — а `npm run build`
Vercel так не робить. Стандартний фікс від Prisma для Vercel-деплоїв: додав
`"postinstall": "prisma generate"` у `package.json` — тепер клієнт перегенерюється сам одразу
після `npm install`, на будь-якому середовищі. Перевірив локально: видалив
`src/generated/prisma`, прогнав `npm install` (postinstall сам згенерував клієнт), і `npm run build`
пройшов чисто.

Файли: `package.json`, `package-lock.json`.

## 2026-08-05 — Фікс просвічування даних під sticky-колонкою в таблиці переможця турніру

На мобільному при горизонтальному свайпі таблиці результатів турніру дані інших колонок
просвічували крізь липку (sticky) колонку "Гравець" у виділеному рядку переможця. Причина: фон
sticky-комірки переможця був `bg-amber-500/5` — лише 5% непрозорості без опакової підкладки, тоді
як у звичайних рядків там суцільний `bg-card`. Замінив на
`bg-[color-mix(in_oklch,var(--color-amber-500)_5%,var(--card))]` — той самий прийом, що вже
використовується для підсвіченого рядка глядача на `/rating` і `/leaderboard`, тільки замінили
`var(--accent)` на Tailwind-токен `var(--color-amber-500)` (він реально експортується темою
Tailwind v4 як CSS-змінна).

Файли: `src/components/tournament-standings.tsx`.

## 2026-08-05 — Колонка "Очки" в таблиці турніру

Додав колонку "Очки" в таблицю результатів турніру (`TournamentStandings`) — 2 очки за кожну
перемогу. Це чисто похідне значення (`row.wins * 2`), тому окремого поля в `StandingsRow` чи змін
у сортуванні (`standings-sort.ts`) не знадобилось — сортування вже йде по кількості перемог, яка
монотонно відповідає очкам.

Файли: `src/components/tournament-standings.tsx`.

## 2026-08-05 — Виправлено флейкі-тест user-role-select.test.tsx

Тест падав інтермітентно (1-2 з 4) — після `user.click` на тригері `Select` наступний
`screen.getByRole("option", ...)` іноді не встигав застати опцію: попап Base UI `Select`
монтується в портал асинхронно, а `getByRole` синхронний і не чекає. Інші тестові файли з тим
самим компонентом (`create-match-dialog.test.tsx`, `audit-filters.test.tsx`, `player-dialog.test.tsx`,
`singles-randomize-button.test.tsx`, `tournament-matches.test.tsx`) уже використовують
`await screen.findByRole("option", ...)` для першого клацання після відкриття — той самий
патерн застосував і тут (усі три місця). Перевірено 10 прогонів підряд без жодного провалу
(раніше траплялось у ~25-50% прогонів), плюс повний набір (594/594), lint, `tsc --noEmit`.

Файли: `tests/components/admin/user-role-select.test.tsx`.

## 2026-08-05 — e2e-покриття для /rating

Останній пункт зі списку з аналізу застосунку: `/rating` — найматематично складніша сторінка
застосунку (Glicko-2/OpenSkill/Set Club) — не мала жодного e2e-тесту. Додав два: у
`public-pages.spec.ts` — базовий смоук (200, заголовок "Рейтинг", фільтри форматів/методу видимі),
поруч з іншими публічними сторінками. У `match-flows.spec.ts` — змістовніший тест одразу після
"admin can save a match score and see it marked completed": обидва гравці мають з'явитись у
таблиці одиночного рейтингу, оскільки `/rating` завжди рахує рейтинг наживо з Match/MatchSet (не з
кешованого RatingSnapshot — той лише для графіка історії, див. docs/RATING.md), тож щойно
завершений матч має відобразитись без додаткового очікування фонового rebuild. Розмістив його
свідомо *до* тесту рандомайзера нижче, який перезаписує цей матч.

Перевірив: `tsc --noEmit`, lint, `playwright test --list` (обидва нові тести реєструються в
правильному порядку), і сам смоук-тест `/rating` — реально запустив проти локального dev-сервера
(read-only, безпечно проти живої БД). Тест у `match-flows.spec.ts` не запускав локально — він
створює/видаляє реальні записи через `/api/test-login`, а локальний `.env` не має
`E2E_TEST_LOGIN_SECRET` (і сам `DATABASE_URL` там схожий на спільну, не одноразову БД) — саме тому
CI-конфіг цього репозиторію явно вимагає окремої disposable Neon-гілки для e2e, а не локального
запуску проти чого завгодно. Побічно, запустивши повний `public-pages.spec.ts` для перевірки
регресій, виявив 4 передіснуючі непов'язані провали (головна сторінка й `/leaderboard` очікують
контент/кнопки, яких на поточному dev-стейнджі вже немає, і два 404-тести отримують 200) — не
торкався жодного з цих файлів сьогодні, залишив як є.

Файли: `e2e/public-pages.spec.ts`, `e2e/match-flows.spec.ts`.

## 2026-08-05 — Coverage thresholds у CI

Останній Medium-пункт з аналізу: `vitest.config.ts` рахував coverage, але без порогів, а CI
запускав звичайний `npm run test` (без coverage взагалі) — цифри 91.6%/83.7%/91%/92.7%
(stmts/branches/funcs/lines) існували лише як локальний звіт і могли деградувати непомітно.
Додав `coverage.thresholds` у `vitest.config.ts` (90/82/88/91 — на кілька пунктів нижче поточного
замірy, щоб природні коливання не валили CI, але суттєве падіння покриття — так) і перемкнув
`unit-tests` job у `.github/workflows/ci.yml` на `npm run test:coverage`. Пороги — глобальні
(агреговані), не per-file: кілька тонких "клейових" файлів (`src/lib/db.ts`, `src/lib/auth.ts`,
`src/proxy.ts`, `src/lib/audit.ts`) законно мають ~0% покриття (конфігурація/wiring, не бізнес-
логіка), і per-file порог валив би CI саме на них, а не на реальні регресії. Перевірив механізм і
в обидва боки: тимчасово підняв `statements` до 99% — CI впав з чітким `ERROR: Coverage for
statements (91.56%) does not meet global threshold (99%)`; повернув на 90% — пройшло.

Побічно виявив передіснуючий нестабільний (`user-role-select.test.tsx`) тест — падає інтермітентно
(1-2 з 4 тестів), незалежно від coverage-інструментації, не пов'язаний із жодною зміною сьогодні.
Не входив у список задач цієї сесії, залишив як є.

Файли: `vitest.config.ts`, `.github/workflows/ci.yml`.

## 2026-08-05 — Розбито matches.ts на CRUD / randomize-doubles / randomize-singles

Продовження пунктів з глибокого аналізу застосунку: `src/lib/actions/matches.ts` був 995-рядковим
файлом (CRUD матчу + збереження рахунку + три окремі варіанти рандомайзера — парний, одиночний
round-robin, одиночний за групами), найбільшим hand-written файлом у проєкті. Розбив на:
`matches.ts` (лишились лише CRUD + `saveScoreAction`, 429 рядків), новий `randomize-doubles.ts`
(`drawDoublesTeamsAction`/`commitDoublesMatchesAction` + типи `NamedTeam`/`NamedMatchup`/`DrawState`),
новий `randomize-singles.ts` (`commitSinglesRoundRobinAction`/`drawSinglesGroupsAction`/
`commitSinglesGroupsAction` + типи `NamedGroup`/`NamedSinglesMatchup`/`SinglesGroupDrawState`), і
новий `match-randomize-shared.ts` для того, що використовували обидва рандомайзери й до купи
`tournaments.ts` — `checkCompletedMatchesAcknowledged` і типи `NamedPlayer`/`CommitState`. Чисто
механічний split (жодна логіка не змінилась) — оновив імпорти в трьох клієнтських компонентах
(`randomize-matches-button.tsx`, `singles-randomize-button.tsx`) і `tournaments.ts`, розбив
відповідний тестовий файл на чотири (`matches.test.ts`, `randomize-doubles.test.ts`,
`randomize-singles.test.ts`, `match-randomize-shared.test.ts`), звузивши мок prisma-клієнта в
кожному до того, що реально використовує ця група дій. Перевірено: lint, `tsc --noEmit`, увесь
набір тестів (594/594), `next build`.

Файли: `src/lib/actions/matches.ts`, `src/lib/actions/randomize-doubles.ts` (новий),
`src/lib/actions/randomize-singles.ts` (новий), `src/lib/actions/match-randomize-shared.ts` (новий),
`src/lib/actions/tournaments.ts`, `src/components/admin/randomize-matches-button.tsx`,
`src/components/admin/singles-randomize-button.tsx`, і відповідні тестові файли в `tests/lib/actions/`
та `tests/components/admin/`.

## 2026-08-05 — Гонка при паралельному rebuild rating-снепшотів

Ще один пункт з аналізу: `refreshRatingSnapshots` (`src/lib/rating/snapshot.ts`) робить
`deleteMany({})` + `createMany` по всій таблиці `RatingSnapshot` після кожної мутації матчу, у
фоні через `after()`. Дві мутації поспіль планують два такі rebuild без жодної серіалізації — під
READ COMMITTED другий rebuild міг видалити вже закомічені рядки першого, а тоді впасти на
unique-constraint при вставці своїх (перехоплювалось і логувалось як best-effort, але таблиця
снепшотів лишалась застарілою до наступної вдалої мутації). Обгорнув delete+insert у той самий
`pg_advisory_xact_lock`-патерн, що вже використовують коміти рандомайзера в `matches.ts` — тепер
паралельні rebuild-и чекають один одного замість того, щоб перезаписувати чужі щойно вставлені
рядки. Ключ блокування фіксований (`hashtext('rating_snapshot_refresh')`), бо це один глобальний
rebuild усієї таблиці, а не per-tournament операція. Додав тест, що перевіряє виклик `$executeRaw`
із блокуванням.

Файли: `src/lib/rating/snapshot.ts`, `tests/lib/rating/snapshot.test.ts`.

## 2026-08-05 — Security-заголовки (CSP, HSTS, X-Frame-Options та ін.)

За підсумками глибокого аналізу застосунку (безпека/архітектура/рейтинговий рушій, 3 паралельні
огляди) єдиним High-пунктом виявилась відсутність security-заголовків: `next.config.ts` і
`vercel.json` не задавали CSP/HSTS/X-Frame-Options/X-Content-Type-Options — без захисту від
clickjacking адмін-панелі через iframe. Додав `headers()` у `next.config.ts`: `Content-Security-
Policy` (`default-src 'self'`, `frame-ancestors 'none'`, `img-src` з дозволом на Google-аватарки
`*.googleusercontent.com`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (без `preload` —
це майже незворотний крок, свідомо не вмикав), `Permissions-Policy` (вимикає camera/mic/geo).
CSP навмисно з `'unsafe-inline'` для script-src/style-src, а не nonce-based: у `layout.tsx` є два
`beforeInteractive` inline `<Script>` (ініціалізація теми/фону до першого рендеру, щоб уникнути
спалаху не тієї теми) і кілька компонентів використовують `style={{...}}` — повний nonce-based CSP
вимагав би переробки `src/proxy.ts` (генерація nonce на кожен запит) і всіх цих місць, що виходило
за межі цього фокусованого фіксу. Все одно суттєво звужує поверхню атаки — блокує будь-який
*зовнішньо* захоплений script/style/frame, що є домінантною формою XSS-пейлоаду. Перевірено: lint,
`tsc --noEmit`, dev-сервер віддає всі заголовки коректно, `/`, `/rating`, `/leaderboard`,
`/players`, `/login` — 200.

Файли: `next.config.ts`.

## 2026-08-05 — Глобальна стилізація скролбарів (не лише каруселі)

Той самий "товстий світло-сірий OS-скролбар на темному фоні" глюк, який раніше пофіксили лише для
каруселі "Останні результати" (`.scrollbar-themed`), виявився ще й у dropdown-списках (Base UI
`Select`/combobox з пошуком) та інших overflow-контейнерах по всьому застосунку. Замість
точкового opt-in класу переніс стилізацію (`scrollbar-width: thin` + `scrollbar-color` для
Firefox, `::-webkit-scrollbar` з напівпрозорим track і заокругленим thumb у кольорах теми для
Chrome/Edge) у `@layer base` `globals.css` як глобальне правило — діє автоматично на будь-який
скрольований елемент, без потреби додавати клас у кожному новому компоненті. Прибрав тепер зайвий
клас `scrollbar-themed` з `results-carousel.tsx` (успадковує глобальний стиль). Товщину збільшив з
6px до 8px — раніше 6px підбирались під вузьку горизонтальну смугу каруселі, для вертикальних
списків (players, dropdown) трохи товщий скролбар зручніший для влучання курсором.

Файли: `src/app/globals.css`, `src/components/results-carousel.tsx`.

## 2026-08-05 — Стилізований скролбар каруселі "Останні результати"

Стандартний OS-скролбар під горизонтальною каруселлю останніх матчів на головній сторінці був
товстим і світло-сірим незалежно від теми — виглядав як візуальний глюк на темній картці, що вже
мала власні afordance для скролу (стрілки, edge-fade). Додав utility-клас `.scrollbar-themed` у
`src/app/globals.css` (`scrollbar-width: thin` + `scrollbar-color` для Firefox,
`::-webkit-scrollbar` 6px з напівпрозорим track і заокругленим thumb у кольорах теми для
Chrome/Edge) і застосував його до скролера в `src/components/results-carousel.tsx`. Перевірено
через `getComputedStyle` у headless Chromium (headless-скріншот не показує сам скролбар — overlay-
рендеринг Chromium в автоматизації, але властивості коректно застосовані до потрібного елемента).

Файли: `src/app/globals.css`, `src/components/results-carousel.tsx`.

## 2026-08-05 — Тестове покриття: усі рештки — admin-таблиці/фільтри + вся публічна частина (~30 файлів)

Закрив геть усе, що лишалось непокритим у `src/components/*`:

**Адмінка (7 файлів):** `admin-nav.tsx` (active-стан по exact/prefix match), `audit-filters.tsx` і
`link-player-control.tsx` (URL-параметри, пошук у Select), `players-table.tsx`/`tournaments-table.tsx`
(таблиці — замокав важкі дочірні компоненти, що вже мають власні тести, лишивши фокус на власній
логіці таблиці: сортування з `aria-sort`, empty-стани, посилання-в-кожній-клітинці),
`table-loading-skeleton.tsx` (тривіальний smoke-тест), `user-role-select.tsx` (підвищення до ADMIN
іде через AlertDialog-підтвердження, пониження — напряму, без неї).

**Публічна частина (усі ~23 файли, 0% → покрито):** `match-summary.tsx` (440 рядків — статус-беджі,
нормалізація легасі-назв раунду "Сіяні"→"Gold (сіяні)", прогноз-бар, historical rating), `tournament-standings.tsx`
(компонент — трофей з'являється від `roundRobinDone` окремо від `showWinner`, придушується
`hasPlayoffFinal`), `tournament-playoffs.tsx` (фіксований порядок стадій — Фінал перед 1/2,
незалежно від порядку вхідних матчів), `matches-filters.tsx`/`opponent-filter.tsx`/`search-input.tsx`
(URL-фільтри, дебаунс пошуку через `vi.advanceTimersByTimeAsync`), рейтингові SVG-графіки
(`rating-distribution-chart.tsx`, `rating-history-chart.tsx` — клік по точці перемикає тултип/summary),
`results-carousel.tsx` (edge-кнопки прокрутки за `scrollLeft`/`scrollWidth`, змокано `scrollBy`,
якого нема в jsdom), `pull-to-refresh.tsx` (touch-жест з підробленими `matchMedia`/`userAgent` для
iOS-standalone умови), `nav.tsx` (async Server Component — рендерився напряму через `await Nav()`;
дочірні `ThemeToggle`/`BackgroundToggle`/`SignInButton`/`SignOutButton` замоковані), `nav-links.tsx`,
`theme-toggle.tsx`/`background-toggle.tsx` (`useSyncExternalStore` + localStorage +
`document.documentElement`-клас), `sign-out-button.tsx`, `auth-buttons.tsx`, `load-more.tsx`,
`stat-card.tsx`, `pill-filter.tsx`, `logo.tsx`.

**Знахідки під час роботи:**
- `TournamentStandings`'s трофей: `hasWinner = !hasPlayoffFinal && (showWinner || roundRobinDone) && ...`
  — `showWinner` і `roundRobinDone` **незалежні OR-гілки**, не послідовні кроки; тест, що подає
  обидва одразу, ніколи не побачить різницю.
  `PLAYOFF_DISPLAY_ORDER` в `playoff-rounds.ts` іде від найглибшої стадії (Фінал) до найранішої —
  протилежно інтуїтивному "хронологічному" порядку.
- Base UI `Button`'s `render` на `<Link>`-ціль виставляє `role="button"`, не `role="link"` — та сама
  пастка, що вже раз спіткала e2e-тест головної сторінки, тепер і в `LoadMore`.
- Контрольований `<input type="date">`, чий `value` пропом ніколи не оновлюється в ізольованому
  рендері, скидається до порожнього після кожного keystroke — `user.type` посимвольно тому не
  накопичує значення; правильна симуляція "вибору дати" — один `fireEvent.change` з готовим
  значенням, а не набір символів.
- `document.addEventListener`-обробники (не React-синтетичні події, як у `pull-to-refresh.tsx`)
  вимагають явного `act()` навколо `dispatchEvent`, інакше викликаний ними `setState` не встигає
  застосуватись до наступного ассерту.

594 тести (83 файли), усі зелені; lint (0/0) і `tsc --noEmit` чисті. `src/components` — **94.65%**,
`src/components/admin` — **91.65%**. Загальне покриття зросло з 75.4% до **91.5%** stmt.

Що лишилось непокритим (усвідомлено, не забуто): `src/lib/auth.ts`/`db.ts`/`audit.ts` та кілька
тривіальних one-liner'ів (`rank-style.ts`, `brand-icon.tsx`, `csv-response.ts`, `test-login.ts`,
`actions/auth.ts`) — конфігураційний/інфраструктурний код, не бізнес-логіка; `src/proxy.ts`
(Next.js middleware); `nav-links.tsx`'s `NavLinksDropdownItems` (той самий active-стан, що й
`NavLinksInline`, просто інший рендер-контейнер). `src/app/*` (сторінки) свідомо поза юніт-
покриттям — покриваються Playwright e2e.

Файли: git status містить повний список — 7 нових файлів у `tests/components/admin/`, 23 нових
файли в `tests/components/`.

## 2026-08-05 — Тестове покриття: три CRUD-форми + п'ять кнопок видалення/відв'язки

Закрив решту "легких" admin-компонентів: `tournament-form.tsx`, `player-dialog.tsx`,
`news-dialog.tsx` (форми створення/редагування — character-лічильники, польові помилки з
useActionState, закриття діалогу на успіх) і всі 5 підтверджувальних кнопок
(`delete-match-button`, `delete-news-button`, `delete-player-button`,
`delete-tournament-button`, `unlink-player-button`) — усі за одним патерном: AlertDialog-
підтвердження, помилка не закриває діалог, успіх закриває. `delete-tournament-button.tsx` додатково
має ВИДАЛИТИ-слово-підтвердження (як і рандомайзери) — окремо перевірив, що поле скидається
після "Скасувати".

Попутно прибрав 27 eslint-warnings (`@typescript-eslint/no-unused-vars` на `_prevState`/
`_formData` в типізації моків), які накопичились у попередніх компонентних тест-файлах цієї сесії
(`create-match-dialog.test.tsx` і інші) — вони пройшли повз, бо `tsc --noEmit` (який я гоняв щоразу)
не ловить unused-vars, а `eslint` після конкретно ЦієЇ правки я тоді не перезапускав. Замінив
патерн `vi.fn(async (_prevState: ActionState, _formData: FormData) => ...)` на
`vi.fn<typeof createXAction>().mockResolvedValue(...)` — типобезпечно й без неиспользуемых
параметрів (тип тягнеться з реального exportу через `import type`, що стирається в рантаймі й не
конфліктує з `vi.mock` того ж модуля). Базова лінія `src/` — 0 warnings; тепер і нові тести теж.

Усі нові файли — 86-100% (більшість 100%). `src/components/admin` тепер 80% загалом. 494 тести
(56 файлів), усі зелені; lint (0 errors, 0 warnings) і `tsc --noEmit` чисті. Загальне покриття
зросло з 71.3% до **75.4%** stmt.

Файли: `tests/components/admin/tournament-form.test.tsx`, `player-dialog.test.tsx`,
`news-dialog.test.tsx`, `delete-match-button.test.tsx`, `delete-news-button.test.tsx`,
`delete-player-button.test.tsx`, `delete-tournament-button.test.tsx`,
`unlink-player-button.test.tsx` (усі нові); `create-match-dialog.test.tsx` (типізація моків
виправлена).

## 2026-08-05 — Тестове покриття: tournament-roster + tournament-matches

Закрив ще два важкі admin-компоненти: `tournament-roster.tsx` (мультиселект додавання учасників
із `useOptimistic`, `SeedToggle`/`GroupSelect` з локальним optimistic-станом і відкатом на
помилку, `AlertDialog`-підтвердження видалення) і `tournament-matches.tsx` (пошук/фільтр за
статусом, format-залежний вибір рандомайзера, optimistic-додавання щойно створеного матчу).

Для `tournament-matches.tsx` замокав усі важкі дочірні компоненти (`MatchSummary`,
`MatchDialog`, `DeleteMatchButton`, обидва рандомайзери, `ScoreDialog`) простими заглушками — вони
вже мають власні тести, тож тут цінність саме у власній логіці `TournamentMatches` (фільтрація,
побудова optimistic-запису, format-гілкування), а не в перетестуванні дітей.

**Пастка з `useOptimistic`, на яку варто зважати надалі:** optimistic-значення показується лише
поки transition, що його викликав, дійсно "в польоті" — щойно transition завершується, воно
відкочується до реального пропа, навіть якщо той ніколи не оновився (немає жодного реального
запиту, що міг би його змінити). Синхронний або миттєво завершений async transition-колбек у
моку означає, що ассерт після `await user.click(...)` майже напевно побачить уже відкочений стан
— перегони, не помилку логіки. Рішення: тримати мок-transition свідомо незавершеним (`await new
Promise(() => {})`) на час тесту, а не гнатись за точним таймінгом.

`tournament-matches.tsx` — **100%**, `tournament-roster.tsx` — 84.3%. 464 тести (48 файлів), усі
зелені; lint і `tsc --noEmit` чисті. Загальне покриття зросло з 67.1% до **71.3%** stmt.

Файли: `tests/components/admin/tournament-roster.test.tsx`,
`tests/components/admin/tournament-matches.test.tsx` (усі нові).

## 2026-08-05 — Тестове покриття: три найважчі admin-компоненти (create-match-dialog, обидва рандомайзери)

Закрив три найважчі й досі повністю непокриті client-компоненти адмінки:
`create-match-dialog.tsx` (`MatchDialog` — форма створення/редагування матчу з Base UI Select для
вибору гравців), `randomize-matches-button.tsx` (парний рандомайзер: жеребкування → анімований
reveal пар → коміт) і `singles-randomize-button.tsx` (одиночний рандомайзер: ALL/SEEDED_SPLIT
комітяться напряму, CUSTOM_GROUPS іде через ту саму схему жеребкування з reveal).

Тестую через `@testing-library/react` + `userEvent` у jsdom (`// @vitest-environment jsdom`),
мокаючи лише `@/lib/actions/matches`, `next/navigation`'s `useRouter` і `sonner`'s `toast` — сам
Base UI `Select` (портал + `combobox`/`option` ролі) рендериться реально й керується через ті самі
ролі, що й Playwright-e2e (`getByRole("combobox", {name}); getByRole("option", {name})`), без
жодних заглушок.

Для рандомайзерів (обидва мають `setTimeout`-анімацію reveal + окремий ефект коміту з guard-ref
проти подвійного спрацювання) tests використовують `vi.useFakeTimers({ shouldAdvanceTime: true })`
і `await act(async () => { await vi.advanceTimersByTimeAsync(ms) })`, покроково проганяючи весь
цикл жеребкування → reveal → коміт і звіряючи точний payload, який іде в
`commitDoublesMatchesAction`/`commitSinglesGroupsAction`.

**Пастка, на яку варто зважати надалі:** жоден із цих файлів спершу не мав `beforeEach(() =>
vi.clearAllMocks())` — виклик з одного тесту (`commitDoublesMatchesActionMock`) рахувався в
наступному й ламав `not.toHaveBeenCalled()`-перевірку. Тепер `vi.clearAllMocks()` в `beforeEach`
стоїть у кожному новому компонентному тест-файлі; варто тримати це за замовчуванням у будь-якому
новому файлі з кількома `it()`, що ділять один `vi.hoisted`-мок.

`create-match-dialog.tsx` — 89.6%, `randomize-matches-button.tsx` — 90.4%,
`singles-randomize-button.tsx` — 86.1%. 446 тестів (46 файлів), усі зелені; lint і `tsc --noEmit`
чисті. Загальне покриття зросло з 56.9% до **67.1%** stmt.

Файли: `tests/components/admin/create-match-dialog.test.tsx`,
`tests/components/admin/randomize-matches-button.test.tsx`,
`tests/components/admin/singles-randomize-button.test.tsx` (усі нові).

## 2026-08-05 — Тестове покриття: tournament-standings + весь рейтинговий шар (rating/*)

Закрив `src/lib/tournament-standings.ts` (агрегація турнірної таблиці — окремо парний шлях
`getTeamRows`, що групує матчі за точним складом пари й будує ключ команди із відсортованих
`playerId`, і одиночний `getIndividualRows`; плюс розбиття на групи "За групами"/"За сіяністю" з
чи без заголовків залежно від того, скільки розбиттів активно одночасно) і решту `src/lib/rating/*`:
`snapshot.ts` (повний rebuild `RatingSnapshot` — wipe+reinsert, і `scheduleRatingSnapshotRefresh`,
що ковтає помилку через `console.error` замість падіння) та `ratings-data.ts` (перетворення сирих
Prisma-рядків у `RatingMatchRow` з epoch-ms датами й seed-мапою по гравцю, сортування рейтингів,
фільтр сезону за UTC-роком дати старту турніру, сортування Set Club очок за
points→tournamentsPlayed→playerId).

Тести навмисно не мокають уже покриту чисту математику (`engine.ts`, `glicko2.ts`, `openskill.ts`)
там, де цінність саме в перевірці зшивання шарів — наприклад, `tournament-standings.test.ts`
вручну прораховує очікуваний порядок `sortRows`/`isRoundRobinComplete` для трьох парних команд і
звіряє з реальним викликом. Там, де важливе саме зшивання полів (`snapshot.ts`'s rating/spread
mapping), мокнув `engine.ts`, щоб підставити контрольовані `Glicko2Rating`/`OpenSkillRating`, і
звірив результат із тим самим реальним `conservativeRating`/`conservativeOrdinal`/`displaySpread`,
який використовує сам код — це перевіряє "чи те поле пішло в ту колонку", а не переоцінює вже
протестовану формулу вручну.

`src/lib/rating/*` тепер повністю покритий (усі файли ≥95%, більшість 100%),
`tournament-standings.ts` — 98.8%. 428 тестів (43 файли), усі зелені; lint і `tsc --noEmit`
чисті. Загальне покриття зросло до **56.9%** stmt.

Файли: `tests/lib/tournament-standings.test.ts`, `tests/lib/rating/snapshot.test.ts`,
`tests/lib/rating/ratings-data.test.ts` (усі нові).

## 2026-08-05 — Усі юніт/компонентні тести перенесено в top-level `tests/`

За запитом користувача переніс усі 39 файлів `*.test.{ts,tsx}` із колокації поруч із кодом
(`src/lib/foo.test.ts` поруч із `foo.ts`) у top-level `tests/`, що дзеркалить структуру `src/`
(`tests/lib/foo.test.ts`, `tests/lib/actions/matches.test.ts`, `tests/components/admin/score-dialog.test.tsx`
тощо) — так само, як e2e-тести вже лежать окремо в `e2e/`.

Вісім файлів у `src/lib/rating/*.test.ts` і `playoff-rounds.test.ts` імпортували сусідній вихідний
файл відносним шляхом (`from "./glicko2"`) — після переїзду в `tests/lib/rating/` такий шлях уже
вказував би на неіснуючий файл у `tests/`, тож переписав усі на `@/lib/rating/...`-аліас.
`vitest.config.ts`: `include` тепер `"tests/**/*.test.{ts,tsx}"`, і прибрав з `coverage.exclude`
рядок, що виключав тестові файли зі `src` (уже нема чого виключати — вони деінде).

Усі 411 тестів (40 файлів) далі зелені після переїзду, покриття не змінилось (51.8% stmt) — це
був чистий рефакторинг розташування файлів, без змін логіки. Файли: git-переміщені 37 наявних
тестів + `tests/lib/actions/*`, `tests/lib/permissions.test.ts`, `tests/lib/queries/*` (додані
щойно, до переїзду ще не були закомічені), `vitest.config.ts`.

## 2026-08-05 — Тестове покриття: src/lib/queries/* — 100%

Закрив увесь шар `src/lib/queries/*` (6 файлів, тонкі обгортки над Prisma для сторінок): `matches.ts`,
`players.ts`, `tournaments.ts`, `news.ts`, `users.ts`, `audit.ts`. Головна цінність тут — не
голе покриття рядків, а перевірка `where`/`orderBy`-логіки, яку легко зламати непомітно:
- `queries/matches.ts` — комбінування фільтрів (гравець/дата/статус) у `getMatchesPage`, зокрема
  межі UTC-діапазону дня і фолбек на `createdAt` для матчів без `scheduledDate`.
- `queries/players.ts` — сортування українським колятором (`Intl.Collator("uk")`) замість сирого
  Unicode-порядку (тест явно показує, що "Ірина" мала б піти після "Андрій", а не перед) і
  `getLinkedUserIds`.
- `queries/tournaments.ts` — вибір `orderBy` залежно від `TournamentSortKey`
  (startDate/participants/matches).
- `queries/audit.ts` — виключення E2E-тестового адміна (`excludeTestAdmin`) завжди присутнє в
  `where`, навіть коли додаються фільтри actor/action.

Усі 6 файлів — **100%** stmt. 411 тестів (40 файлів), усі зелені; lint і `tsc --noEmit` чисті.
Загальне покриття зросло до **51.8%** stmt.

Файли: `src/lib/queries/matches.test.ts`, `players.test.ts`, `tournaments.test.ts`, `news.test.ts`,
`users.test.ts`, `audit.test.ts` (усі нові).

## 2026-08-05 — Тестове покриття: гравці/новини/користувачі — весь шар actions закрито

Закрив останні три action-файли: `src/lib/actions/players.ts` (create/update/delete, unlink/link
акаунта користувача), `news.ts` (create/update/delete новини) і `users.ts`
(`updateUserRoleAction`). Той самий патерн моків, що й для tournaments/matches (Prisma,
`@/lib/permissions`, `@/lib/audit`, `next/cache`, `next/server`'s `after`).

Особливості, які покрив окремими тестами:
- `deletePlayerAction` — атомарна умовна видаленя (`deleteMany` з `matchAppearances: { none }`)
  розрізняє "гравець має історію" від "гравця взагалі не існує" по тому, чи `findUnique` перед
  цим щось знайшов.
- `linkPlayerAction` — конфлікт унікальності розрізняється по `uniqueConstraintTarget`: email вже
  зайнятий іншим гравцем vs цей user вже прив'язаний до іншого гравця — дві різні повідомлення з
  однієї P2002.
- `updateUserRoleAction` — єдина action, що кидає `Error` замість повернення `{error}` (не
  `useActionState`-форма); окремо перевірив заборону змінити власну роль і невалідний role-рядок.

Разом із трьома попередніми записами нижче це закриває `src/lib/actions/*` цілком:
92% stmt (лишився не покритим тільки семирядковий `actions/auth.ts` — тонкий ре-експорт, не варте
тесту). Загальне покриття зросло до **49.8%** stmt; 373 тести (34 файли), усі зелені.

Файли: `src/lib/actions/players.test.ts`, `src/lib/actions/news.test.ts`,
`src/lib/actions/users.test.ts` (усі нові).

## 2026-08-05 — Тестове покриття: тести для actions/matches (найбільший і найризикованіший action-файл)

Продовжив закриття тестового покриття (див. попередній запис нижче) — наступний за пріоритетом
файл, `src/lib/actions/matches.ts` (994 рядки, 10 exported functions: create/update/delete матчу,
збереження рахунку з optimistic-lock перевіркою конфліктів, парний/одиночний рандомайзер у трьох
режимах — ALL/SEEDED_SPLIT/CUSTOM_GROUPS — кожен зі своїм draw+commit кроком).

`src/lib/actions/matches.test.ts` (49 тестів) покриває: валідацію форми, перевірку що гравець
зареєстрований у турнірі, дублікат плейофного раунду, конкурентні помилки Prisma (P2003/P2002/
P2025 з розрізненням "конфлікт раунду" від "конфлікт ростеру"), скидання рахунку при зміні складу
гравців у `updateMatchAction`, optimistic-lock конфлікт у `saveScoreAction` (і на швидкій
перевірці, і всередині транзакції), нічию без зняття гравця, усі граничні випадки рандомайзерів
(менше 4/2 учасників, відсутність сіяних, лише 1 сіяний/несіяний у SEEDED_SPLIT, невідомий гравець
у драфті, самогра в CUSTOM_GROUPS, група поза діапазоном 1-6) і успішні шляхи з перевіркою
кількості згенерованих матчів. `randomize-pairs.ts`'s реальні (не замокані) функції жеребкування
використані напряму — вони вже покриті власними тестами, тому підміняти їх сенсу нема, а реальний
виклик перевіряє інтеграцію чесніше за мок.

Мок Prisma довелось розділити на дві частини: `prismaMock` (top-level виклики, з яких
`prisma.$transaction([...])` збирає масив уже викликаних промісів — саме так робить
`updateMatchAction`) і `txMock` (callback-форма `prisma.$transaction(async (tx) => {...})`, яку
використовують `saveScoreAction` і всі commit-actions). Один спільний `$transaction` мок розрізняє
обидві форми за `typeof arg === "function"`.

Усі 343 тести (31 файл) зелені; `actions/matches.ts` тепер 91.5% stmt. Загальне покриття зросло з
33.5% до **45.2%** stmt.

Файли: `src/lib/actions/matches.test.ts` (новий).

## 2026-08-05 — Тестове покриття: coverage-тула + тести для permissions і actions/tournaments

Провів оцінку тестового покриття застосунку (Vitest-юніт + Playwright e2e) і встановив
`@vitest/coverage-v8` для точних цифр замість ручної оцінки файл-за-файлом. Найбільша діра
виявилась у `src/lib/actions/*` і `src/lib/queries/*` (0% на ~3000+ рядків найризикованішого
коду — server actions з мутаціями й авторизацією) та в admin-компонентах (7.8%, лише
`score-dialog.tsx` мав тест).

Закрив два найпріоритетніші місця:
- `src/lib/permissions.test.ts` — `getSession`/`isAdmin`/`requireAdmin`/`requireUser` для
  admin/member/анонімної сесії (мок `@/lib/auth`, `server-only` заглушено як no-op).
- `src/lib/actions/tournaments.test.ts` — усі 7 actions (`create/update/deleteTournamentAction`,
  `add/removeParticipantAction`, `toggle­ParticipantSeedAction`, `setParticipantGroupAction`):
  валідація, блокування зміни формату при наявних матчах, конкурентне видалення (P2025),
  audit-лог, revalidate/updateTag, рефреш рейтингів. Prisma, `next/cache`, `next/navigation`,
  `next/server`'s `after` і `@/lib/rating/snapshot` замоковані.

Додав `test:coverage` скрипт і конфіг покриття у `vitest.config.ts` (виключає
`src/generated`, `src/components/ui`, `src/app` — сторінки покриваються e2e, не юніт-тестами).
Загальне покриття зросло з 28.7% до 33.5% stmt (294 тести, 30 файлів, усі зелені); `tournaments.ts`
сам по собі тепер 96%.

Файли: `vitest.config.ts`, `package.json`, `src/lib/permissions.test.ts` (новий),
`src/lib/actions/tournaments.test.ts` (новий).

## 2026-08-05 — Повторний UX/UI-аудит: усі 24 знахідки (публічна частина + адмінка)

Провів другий раунд UX/UI-аудиту (код обох частин прочитано окремими прохідками + перевірка в
реальному браузері через Playwright на 1440px/390px), опублікував 24 знахідки як окремий
артефакт, і за запитом користувача реалізував усі без винятку. Детальний опис — у
[docs/UX_AUDIT_FIXES.md](UX_AUDIT_FIXES.md) (розділ "Раунд 2").

**Публічна частина (13):**
1. Мобільний хедер — перемикачі теми/фону більше не накладаються на назву сайту (`flex-wrap`
   замість `shrink-0` в `nav.tsx`).
2. Активна сторінка підсвічується в головній навігації — новий `nav-links.tsx`.
3. `generateMetadata` на сторінках новини/турніру/гравця — вкладка браузера показує назву
   сутності, не загальну назву сайту.
4. `formatDateUTC` замість `toLocaleDateString` у ще п'яти місцях, де це досі лишалось
   (`match-summary.tsx`, стрічки новин, сторінка турніру).
5. Пошук у публічних селектах гравця/суперника (`matches-filters.tsx`, `opponent-filter.tsx`).
6. Контраст тексту на `global-error.tsx` піднято до ≈7.8:1.
7. `<th scope="row">` для імені гравця в таблицях лідерборду/рейтингу/h2h-матриці.
8. Імена в парі — кожне на своєму рядку (`SideNames` в `match-summary.tsx`), без розриву посеред
   імені на вузьких екранах.
9. Виправлено текст сторінки входу й картки "Гравці" — раніше стверджували, що вхід потрібен для
   перегляду того, що насправді відкрито без нього.
10. Новий розмір `size="lg"` (44px) для `Select` — застосовано до трьох публічних фільтрів.
11. `FORMAT_FILTERS` отримав `as const`.
12. Гендерована фраза порожнього стану профілю гравця → нейтральна.
13. Посилання "← Усі новини/турніри/гравці" на сторінках деталей.

**Адмін-панель (11):**
14. `admin-nav.tsx` — контейнерна горизонтальна прокрутка замість обрізання "Журналу" на
    телефоні.
15. Список гравців адмінки отримав пагінацію й пошук (був єдиним без цього); новий
    `getLinkedUserIds()` рахує зайнятість акаунтів незалежно від пагінації.
16. `aria-sort` на сортованих заголовках таблиці турнірів.
17. `SeedToggle`/`GroupSelect` в ростері турніру тепер показують `toast.error` замість мовчазного
    відкату.
18. Кнопка підтвердження видалення учасника отримала стан очікування ("Прибираємо…").
19. Форма новини підтягнута до рівня інших форм: `fieldErrors`, `RequiredMark`, лічильники
    символів, відсутній раніше `maxLength` на тілі новини.
20. Видалення турніру тепер вимагає набору слова "ВИДАЛИТИ", коли є завершені матчі — той самий
    захист, що й у рерандомайзера (`checkCompletedMatchesAcknowledged` переекспортовано з
    `actions/matches.ts`).
21. Журнал аудиту показує ім'я гравця замість сирого CUID для дій сіяності/видалення учасника.
22. Кнопка "Прив'язати" заблокована, доки не обрано акаунт.
23. `title`-пояснення на задизейбленому select ролі у власному рядку адміна.
24. Пошук на списках новин і користувачів адмінки (`getNewsPostsPage`/`getUsersPage` отримали
    опційний `query`).

`npm run lint`/`tsc`/`test` (262 тести)/`build` пройшли чисто. Ручна перевірка в реальному
Chromium через Playwright: скріншоти до/після мобільного хедера, програмний скрол admin-nav
(`scrollWidth` 391 проти `clientWidth` 358), `page.title()` для трьох типів сторінок деталей,
живий діалог видалення турніру на реальному завершеному турнірі (15 матчів), новий запис журналу
аудиту після реальної дії в UI перевірено прямим запитом до БД.

## 2026-08-05 — Секція "Дрібні / полірування" з UX/UI-аудиту для адмінки (6 пунктів)

Остання секція UX/UI-аудиту для адмін-панелі — 6 дрібних пунктів. Детальний опис — у
[docs/UX_AUDIT_FIXES.md](UX_AUDIT_FIXES.md).

1. Картка "Журнал" додана на дашборд адмінки (була в навігації, але не серед карток огляду).
2. Візуальна позначка обов'язкових полів — новий `RequiredMark`, застосовано на формах турніру й
   гравця.
3. Сітка рахунку в `score-dialog.tsx`: тай-брейк винесено в окремий рядок під основним рахунком
   (5 колонок → 4 + умовний повнорядковий рядок) — тісно на телефоні більше не буде.
4. Таблиця турнірів: колонки Формат/Покриття/Учасників сховано нижче `md:`, на мобільному
   лишаються лише Назва/Статус/Дати/Матчів без горизонтальної прокрутки.
5. Живі лічильники символів (N/ліміт) на назві й описі турніру та на власній назві раунду матчу;
   заразом додано відсутній `maxLength={2000}` на опис турніру.
6. Пояснення про авто-прив'язку Google-акаунту за email перенесено з загального опису діалогу у
   виділений блок під самим полем email.

## 2026-08-05 — Секція "Суттєві" з UX/UI-аудиту для адмінки (11 пунктів)

Секція "Суттєві" для адмін-панелі. Один із 12 надісланих пунктів виявився вже реалізованим у
першому раунді — пропущено. Детальний опис — у [docs/UX_AUDIT_FIXES.md](UX_AUDIT_FIXES.md).

1. Індикатор активної сторінки в адмін-навігації (`aria-current`, новий `admin-nav.tsx`).
2. Підтвердження перед видаленням учасника з ростера турніру.
3. Кнопка "Пропустити" в анімації жеребкування (парний і одиночний рандомайзери).
4. Помилки форм тепер прив'язані до конкретного поля — новий `src/lib/zod-errors.ts`,
   `tournament-form.tsx`/`player-dialog.tsx`/`score-dialog.tsx` (для рахунку — саме той рядок сету).
5. `aria-pressed` на перемикачі переможця при знятті гравця.
6. Таблиця турнірів: сортування по колонках (дати/учасники/матчі), пагінація замість повного
   списку, справжні `<a>` в кожній комірці замість `router.push` (ctrl/cmd/середній клік тепер
   працюють) — `ClickableTableRow` видалено як більше не потрібний.
7. Кнопку видалення гравця з історією матчів деактивовано заздалегідь (з поясненням), а не після
   циклу підтвердження, що завжди провалювався.
8. Select формату турніру заблокований одразу, коли в турнірі вже є матчі.
9. Пагінація списку новин в адмінці (був необмежений список).
10. Фільтр за автором і типом дії в журналі аудиту.

Під час перевірки знайшов і виправив два побічні баги: `SearchInput` (спільний компонент) скидав
усі інші query-параметри (в т.ч. нове сортування турнірів) через 300мс після монтування незалежно
від того, чи щось вводили; і той самий клас бага з попереднього раунду (Prisma-імпорт у
клієнтському бандлі) — цього разу через `AUDIT_ACTION_LABEL` з `lib/audit.ts`, виправлено виносом
у `lib/audit-actions.ts`.

`npm run lint`/`tsc`/`test`/`build` пройшли чисто; ручна перевірка в браузері через Playwright.

## 2026-08-05 — Секція "Дрібні / полірування" з UX/UI-аудиту (10 пунктів)

Остання секція аудиту. Перед реалізацією окремо обговорили пункт про згорнуті інформери на
`/rating` — замість розгортати весь блок чи одну секцію для всіх, зійшлися на точковому рішенні.
Детальний опис — у [docs/UX_AUDIT_FIXES.md](UX_AUDIT_FIXES.md).

1. Інформер "Чому мене немає в таблиці" на `/rating` тепер розгортається автоматично, але лише
   для залогіненого глядача, чийого профілю справді немає в поточній таблиці.
2. Підписи місяців на графіку активності `leaderboard/page.tsx` — `text-[0.65rem]` → `text-xs`.
3. Смуга "% перемог" у таблиці лідерборду — `h-1.5` → `h-2`.
4. Новий спільний `src/lib/rank-style.ts` — прибрано дублювання `RANK_STYLE` між
   `leaderboard/page.tsx` і `rating/page.tsx`.
5. `StatCard` отримав необов'язковий `tone` (positive/negative) — картки "Перемог"/"Поразок" на
   профілі гравця тепер кольорові, як бейджі в `MatchSummary`.
6. Видимий підпис "Дата:" замість самого лише `aria-label` у фільтрі матчів.
7. Картки на головній сторінці — прибрано дублювання `CardDescription`/`CardContent`, лишилось
   одне речення на картку.
8. Порожній стан пошуку на `/players` і `/tournaments` тепер показує сам запит.
9. `manifest.ts` — додано maskable-варіант іконок PWA (той самий файл, вже безпечний для
   Android-маски).
10. Уніфіковано формулювання порожніх станів фільтрів на `/leaderboard` і `/matches`.

`npm run lint`/`tsc`/`test`/`build` пройшли чисто; ручна перевірка в браузері через Playwright.

## 2026-08-05 — Секція "Суттєві" з UX/UI-аудиту (11 пунктів)

Продовження аудиту UX/UI — усі 11 знахідок секції "Суттєві". Детальний опис — у
[docs/UX_AUDIT_FIXES.md](UX_AUDIT_FIXES.md).

1. Уніфіковано "Gold (сіяні)"/"Silver (несіяні)" — константа в `randomize-pairs.ts` плюс
   нормалізація старих значень на рівні відображення в `match-summary.tsx` (без БД-міграції).
2-3. Новий спільний `src/components/pill-filter.tsx`, ним замінено 6 ручних копій
   сегмент-контрол-розмітки в `rating/page.tsx`/`leaderboard/page.tsx`; MODEL_FILTERS на
   `/rating` тепер той самий вигляд, що й FORMAT_FILTERS; додано підписи "Формат:"/"Стать:"/
   "Рік:" на лідерборді.
4. Графіки рейтингу стали тач-доступними: нові клієнтські `rating-history-chart.tsx` і
   `rating-distribution-chart.tsx` (тап замість hover-тултипу), `RatingCard` переструктуровано
   так, щоб тап по графіку не тригерив навігацію.
5. `/matches` — групування по днях зі sticky-заголовками (день тижня + дата).
6. "На головну" поруч з "Спробувати ще раз" на `error.tsx` і `global-error.tsx`.
7. Кар'юсель "Останні результати" на головній — новий `results-carousel.tsx` зі стрілками й
   двостороннім fade замість самого лише правого градієнта.
8. Новий `/news/[id]`, обрізане (`line-clamp-4`) прев'ю в стрічці новин замість повного тексту.
9. `viewport.themeColor` — медіа-масив light/dark замість єдиного світлого кольору (статус-бар
   PWA більше не лишається зеленим/світлим при темній системній темі).
10. "Скинути фільтри" в `matches-filters.tsx` — кнопка з іконкою замість текстового лінка.
11. Контраст відсотка аутсайдера в `PredictionBar` (`match-summary.tsx`) піднято до
    `text-foreground`.

`npm run lint`/`tsc`/`test`/`build` пройшли чисто; ручна перевірка в браузері через Playwright.

## 2026-08-05 — Топ-5 виправлень з UX/UI-аудиту

Провів аудит UX/UI всього застосунку (44 знахідки, окремий артефакт), реалізував топ-5
найпріоритетніших за вибором користувача. Детальний опис рішень — у
[docs/UX_AUDIT_FIXES.md](UX_AUDIT_FIXES.md).

1. **Рерандомайзер жеребкування** тепер вимагає ввести слово "ВИДАЛИТИ" в діалозі, коли в турнірі
   вже є завершені матчі з рахунком — раніше видаляв їх мовчки з тим самим загальним
   попередженням, що й для порожнього турніру. Захист продубльовано і на сервері.
   `src/lib/actions/matches.ts`, `src/components/admin/randomize-matches-button.tsx`,
   `src/components/admin/singles-randomize-button.tsx`, `src/components/admin/tournament-matches.tsx`.
2. **Підвищення користувача до ADMIN** тепер вимагає підтвердження в `AlertDialog` (раніше
   змінювалось одним кліком у select без жодного запобіжника); додано success-toast.
   `src/components/admin/user-role-select.tsx`, `src/app/admin/users/page.tsx`.
3. **Мобільне меню**: поріг появи повної навігації понижено з 1280px до 1024px, тригер
   гамбургера збільшено до 44px (був 28px). `src/components/nav.tsx`.
4. **Закріплена перша колонка** (ім'я гравця) на мобільній горизонтальній прокрутці — лідерборд,
   обидві таблиці рейтингу, турнірна таблиця. `src/app/leaderboard/page.tsx`,
   `src/app/rating/page.tsx`, `src/components/tournament-standings.tsx`.
5. **Пошук в адмінці**: фільтр за статусом і пошук за гравцем у списку матчів турніру; пошук у
   Select-пікерах вибору гравця/акаунту (новий опційний пропс `searchSlot` у `select.tsx`).
   `src/components/admin/tournament-matches.tsx`, `src/components/admin/link-player-control.tsx`,
   `src/components/admin/tournament-roster.tsx`, `src/components/ui/select.tsx`.

Під час ручної перевірки в браузері виявив і виправив побічний баг: імпорт значення (не типу)
`MATCH_STATUS_FILTER_VALUES` з `lib/queries/matches.ts` у клієнтський компонент тягнув Prisma в
браузерний бандл і ламав збірку — замінив на локально продубльовану константу.

## 2026-08-04 — Ще гідратаційні фікси + React-ключ по імені

Продовжив пошук багів. Той самий клас гідратаційної помилки (`toLocaleDateString` — залежить від
таймзони середовища, різна на сервері й у браузері) знайшовся ще у двох місцях, обидва — той самий
патерн, що вже спричинив баг у графіку рейтингу: компонент або обгорнутий у `Link`, або сам
є Client Component, тож реально рендериться повторно на клієнті при гідратації.
- `src/lib/date-format.ts` — новий спільний `formatDateUTC()` (явні UTC-поля, не `toLocaleDateString`).
- `src/app/tournaments/page.tsx` — картки турнірів (обгорнуті в `Link`).
- `src/components/admin/tournaments-table.tsx` — таблиця сама `"use client"`.
- `src/app/page.tsx` — заодно виправив `ResultTile`: React-ключ по імені гравця замість `playerId`
  (могло дати колізію ключів, якщо двоє тезок в одній команді) і теж застосував `toLocaleDateString`
  → явне UTC-форматування.

Місця без `Link`/`"use client"` навколо (сторінка новин, шапка турніру, `MatchSummary`) — не
чіпав, вони не гідратуються повторно, тож ризику нема.

## 2026-08-04 — Фікс гідратації графіка рейтингу

Реальна помилка з браузера: `RatingHistoryChart` форматував дати через `toLocaleDateString` —
залежить від таймзони середовища виконання. На сервері (Vercel, UTC) і в браузері (локальна
таймзона відвідувача) той самий виклик міг дати різний рядок, тому React бачив розбіжність між
серверним HTML і клієнтським рендером ("hydration mismatch"). Замінено на явне UTC-форматування
(`getUTCDate()`/`getUTCMonth()`/`getUTCFullYear()`), той самий підхід, що вже в `activity-trend.ts`.
- `src/app/players/[id]/page.tsx` — `dateLabel` у `RatingHistoryChart`.

## 2026-08-04 — Глибокий рев'ю: два баги в RatingSnapshot

За запитом користувача пройшовся всім новим функціоналом сесії в пошуках багів. Знайшов і виправив
два реальних (ще не спрацювали на реальних даних, але чекали на слушний момент):

1. **`computeDoublesRatingsWithHistory` ламався на турнірах з однаковою датою.** Межу турніру
   визначав як "id змінився в порівнянні з попереднім рядком" на плоско відсортованому масиві —
   якщо два турніри мають однакову `startDate`, їхні матчі можуть перемежовуватись (тай-брейк по
   `createdAt`/`id` матчу, не турніру), і функція видавала кілька знімків для одного `tournamentId`.
   `RatingSnapshot`'s `@@unique([playerId, matchType, tournamentId])` це відхиляє → `createMany`
   кидає помилку → вся транзакція (разом із `deleteMany`) відкочується → `refreshRatingSnapshots()`
   мовчки перестає оновлювати таблицю назавжди (та сама колізія повторюється щоразу). Виправлено
   тим самим підходом, що вже коректно працює в одиночному рушії: групувати по `tournamentId`
   перед сортуванням, а не визначати межу "на льоту".
2. **`updateTournamentAction` не інвалідував кеш/знімки**, хоча дозволяє міняти `startDate` турніру
   (яка визначає порядок рейтингових періодів). Живий рейтинг самозцілювався б за 60с (є
   revalidate-фолбек), але `RatingSnapshot` — звичайна таблиця без періодичної ревалідації, тож
   графік "рейтинг у часі" міг показувати застарілу історію необмежено довго.
- `src/lib/rating/engine.ts` + новий регресійний тест (перевіряє рівно один знімок на турнір навіть
  коли три матчі з однаковою датою чергуються між двома турнірами).
- `src/lib/actions/tournaments.ts` — `updateTournamentAction` тепер викликає
  `updateTag(STATS_CACHE_TAG)` + `scheduleRatingSnapshotRefresh()`, як і решта мутуючих дій.

## 2026-08-04 — Позиція в загальному рейтингу біля кожного гравця

Кожне ім'я в картці матчу (`/matches`, матчі турніру й плей-офф, адмін-панель, профіль гравця) тепер
показує в дужках `#N` — позицію гравця в поточному загальному рейтингу, для одиночних матчів із
одиночного рейтингу, для парних — із парного. Незалежно від статусу матчу (і заплановані, і
завершені). На завершених одиночних об'єднується з уже наявним історичним рейтингом в одні дужки:
`(#1 · 1409±151)`.

Довелось перебудувати відображення імен: раніше сторона матчу рендерилась одним рядком-рядком
("Ім'я1 / Ім'я2"), що не давало прикріпити окремий ранг до кожного з двох партнерів у парі. Тепер
кожен гравець рендериться окремо зі своєю анотацією, з'єднані " / " для вигляду.
- `src/components/match-summary.tsx` — `SideNames` (по гравцю, не по стороні), `SideRow` приймає
  `players`+`rankByPlayerId`+`historicalByPlayerId` замість плоского рядка `label`.
- Ранг рахується на кожній сторінці з уже наявних `getSinglesRatings()`/`getDoublesRatings()`
  (`Object.fromEntries(ratings.map((r, i) => [r.playerId, i + 1]))`) — нового запиту не знадобилось.

## 2026-08-04 — Множина "фаворити" для парних прогнозів

Градація прогнозу ("явний фаворит" тощо) вживала однину навіть для пари гравців у парному матчі
("Іоганов / Данілюк — явний фаворит"). Тепер множина для 2×2 ("явні фаворити").
- `src/components/match-summary.tsx` — `predictionCaption` приймає `isTeam` (matchType === DOUBLES).

## 2026-08-04 — Історичний рейтинг на завершених одиночних матчах

Картка завершеного одиночного матчу тепер показує поруч з іменем гравця "(рейтинг±розкид)" —
рейтинг станом на той турнір, а не поточний живий. Важливий нюанс: Glicko-2 рахує одиночні
рейтинги періодами по турніру, а не по кожному матчу окремо (`docs/RATING.md`), тож це рейтинг
"станом на кінець турніру", а не буквально "одразу після цього одного матчу", якщо в турнірі було
кілька матчів гравця. Парні матчі не чіпали — там OpenSkill рахує по кожному матчу, але подібного
запиту поки не було потрібно.
- `src/lib/rating/ratings-data.ts` — `getSinglesRatingSnapshotsByTournament()`, весь `RatingSnapshot`
  одним запитом (мало даних, дешевше за фільтрацію по turnamentId на кожній сторінці).
- `src/components/match-summary.tsx` — `HistoricalRatingLabel`, рендериться лише для
  `COMPLETED`+`SINGLES`.
- Підключено на `/matches`, `/tournaments/[id]` (разом з `TournamentPlayoffs`),
  `/admin/tournaments/[id]`, `/players/[id]`.

## 2026-08-04 — Рейтинг гравців у картці прогнозу + градація формулювань

Картка запланованого матчу тепер показує ще й поточний рейтинг кожного гравця (у порожній
колонці, де інакше був би рахунок) — саме те, що обіцяв мокап прогнозу, але не було в першій
реалізації. Підпис під смугою більше не бінарний ("майже рівні" / "фаворит") — п'ять градацій за
відсотком: майже рівні шанси, невеликий фаворит, фаворит, явний фаворит, безумовний фаворит.
- `src/lib/rating/match-preview.ts` — `MatchPreview.ratingByPlayerId` (display-готові
  рейтинг+розкид на кожного гравця матчу, не лише ймовірності).
- `src/components/match-summary.tsx` — `SideRatings` (рейтинг у колонці рахунку для запланованих
  матчів), `predictionCaption` (5-рівнева градація замість бінарного вибору).

## 2026-08-04 — Товща смуга прогнозу з відсотками всередині, "Матчі" за замовчуванням без фільтра статусу

Смуга прогнозу матчу повернулась ближче до початкового мокапу: замість тонкої смуги + підпис знизу —
товща (h-6), два сегменти, кожен зі своїм відсотком прямо всередині. Окремо: `/matches` тепер
за замовчуванням показує матчі всіх статусів (раніше — лише завершені, доки не обереш інший фільтр).
- `src/components/match-summary.tsx` — `PredictionBar` переписано на двосегментну товщу смугу.
- `src/app/matches/page.tsx`, `src/components/matches-filters.tsx` — дефолтний статус "ALL".

## 2026-08-04 — Прогноз матчу на `/matches`

Той самий прогноз (уже був на сторінці турніру й в адмінці) тепер і на глобальному списку матчів.
- `src/app/matches/page.tsx` — рахує `preview` так само, як інші сторінки.

## 2026-08-04 — RatingSnapshot: історія рейтингу й графік "рейтинг у часі"

Найбільша окрема інвестиція зі списку пропозицій — детальний план у `docs/RATING.md` (розділ
"RatingSnapshot"). Коротко: нова таблиця `RatingSnapshot` фіксує рейтинг кожного гравця на кінець
кожного турніру (похідний кеш, не джерело істини — повністю перебудовується після кожної мутації
матчів). Профіль гравця тепер показує лінійний графік рейтингу в часі зі смугою невизначеності.
- `prisma/schema.prisma` + міграція `20260804163117_add_rating_snapshot`.
- `src/lib/rating/engine.ts` — `compute{Singles,Doubles}RatingsWithHistory`, існуючі
  `computeSinglesRatings`/`computeDoublesRatings` стали тонкими обгортками (тести не змінились).
- `src/lib/rating/snapshot.ts` — `refreshRatingSnapshots`/`scheduleRatingSnapshotRefresh`,
  підключено до всіх 11 місць `updateTag(STATS_CACHE_TAG)` у `matches.ts`/`tournaments.ts`.
- `src/lib/rating/ratings-data.ts` — `getPlayerRatingHistory`.
- `src/app/players/[id]/page.tsx` — `RatingHistoryChart` (ручний SVG) у картці рейтингу.
- Одноразовий бекфіл через `npx tsx` дав 50 рядків історії; жива інвалідація перевірена вручну
  (пере-збереження рахунку в адмінці автоматично перебудувало таблицю знімків).

## 2026-08-04 — Прогноз матчу в адмінці + пояснення, коли його немає

Прогноз матчу (див. запис нижче про "Прогноз матчу для запланованих ігор") був підключений лише на
публічній сторінці турніру — в адмінському перегляді (`/admin/tournaments/[id]`, вкладка "Матчі")
запланований матч його не показував, бо `TournamentMatches` ніколи не отримував `preview`.
Заодно: коли прогноз недоступний (хтось із гравців ще не грав матчі цього формату), картка раніше
мовчала — тепер явно пише "Прогноз недоступний — хтось із гравців ще не грав [одиночні/парні] матчі."
- `src/components/match-summary.tsx` — розрізняє `preview === null` ("порахували, даних нема") від
  `preview === undefined` ("ця сторінка прогноз не рахує") замість одного фолсі-чека.
- `src/app/admin/tournaments/[id]/page.tsx` — рахує `previewByMatchId` так само, як публічна
  сторінка турніру.
- `src/components/admin/tournament-matches.tsx` — прокидає прогноз у кожен `MatchSummary`.

## 2026-08-04 — Розподіл рейтингів клубу на `/rating`

Не гістограма з фіксованими бінами — при 9-14 оцінених гравцях на формат фіксовані біни здебільшого
порожні або по 1 гравцю. Замість цього dot/strip-plot: кожен гравець — крапка на шкалі рейтингу,
близькі значення розкладаються по "доріжках" замість накладання, лідер і аутсайдер підписані
іменами напряму. Показує саме те, що просили — загальний рівень і розрив топ/низ (в парному
рейтингу є реальний викид: -416 у гравця з рахунком 1-17 за сезон).
- `src/lib/rating-distribution.ts` (+ `.test.ts`) — `layoutStripPlot`, чиста функція розкладки
  крапок по "доріжках" (жадібний beeswarm, greedy lane assignment).
- `src/app/rating/page.tsx` — `RatingDistribution`, рендериться над таблицею для активного формату
  (тільки офіційна модель Glicko-2/OpenSkill, не Set Club).

## 2026-08-04 — Тренд активності клубу + бекфіл `completedAt`

Нова секція "Активність клубу" на `/leaderboard` — два барчарти (матчів і турнірів по місяцях),
намальовані вручну на HTML/CSS (без нової бібліотеки графіків), кожен стовпчик підписаний числом.
- `src/lib/activity-trend.ts` (+ `.test.ts`) — `monthsBetween`/`bucketByMonth`, чисте групування
  дат по календарних місяцях із заповненням "тихих" місяців нулем.
- `src/lib/stats.ts` — `getMonthlyActivity()`.
- `src/app/leaderboard/page.tsx` — `MonthlyBarChart`, секція внизу сторінки.

Дорогою знайшли й виправили дві проблеми з реальними даними:
1. **60 завершених матчів, 25 без `completedAt`** (колонку додали пізніше без бекфілу) —
   `prisma/migrations/20260804155214_backfill_match_completed_at` заповнює їх через
   `COALESCE(scheduledDate, createdAt)`. Заодно прибирає потенційний баг сортування в стрічці
   "Останні результати" на головній (null у `completedAt` міг випливти в топ списку).
2. **`completedAt` ≠ дата гри для історичних турнірів**: адмін заносив результати травня/червня
   одним заходом 3 серпня, тож у цих матчів `completedAt`/`createdAt` — серпневі, а не травневі.
   Для тренду активності `getMonthlyActivity()` тепер пріоритезує `scheduledDate` (реальна дата
   матчу) над `completedAt`/`createdAt` — інакше графік показував би всю історію клубу як "серпень".
   Та сама проблема була й у стрічці "Останні результати" на головній (`getRecentCompletedMatches`,
   `src/lib/queries/matches.ts`) — сортування й дата на картці тепер теж за `scheduledDate`
   (fallback на `completedAt`/`createdAt`), а не за моментом внесення рахунку.

## 2026-08-04 — Прогноз матчу для запланованих ігор

Картка матчу (`MatchSummary`) для матчів у статусі "Заплановано" тепер показує смугу очікуваного
результату — хто фаворит за поточним рейтингом і з якою ймовірністю, за тим самим рейтинговим
рушієм, що вже є на `/rating` (без нової БД, лише виведення вже порахованого). Підключено поки що
тільки на сторінці турніру (`/tournaments/[id]`), де саме показуються матчі після жеребкування,
до внесення рахунку.
- `src/lib/rating/glicko2.ts` — `winProbability(player, opponent)`, публічна обгортка над наявною
  формулою очікуваного рахунку Гліко-2.
- `src/lib/rating/openskill.ts` — `winProbabilities(teamA, teamB)` через `predictWin` з пакета `openskill`.
- `src/lib/rating/match-preview.ts` (+ `.test.ts`) — `buildMatchPreview`: чиста функція, що з
  масиву гравців матчу й мап рейтингів повертає ймовірності або `null`, якщо в когось із гравців
  ще немає рейтингу цього формату.
- `src/components/match-summary.tsx` — `PredictionBar`, рендериться лише для `SCHEDULED`-матчів
  з переданим `preview`; колір ніколи не єдиний сигнал — підпис завжди називає фаворита й відсоток.
- `src/app/tournaments/[id]/page.tsx` — рахує прогноз для запланованих матчів турніру.

## 2026-08-04 — "Останні результати" на головній

Головна сторінка (`/`) тепер показує стрічку останніх завершених матчів клубу — компактними
картками-квадратиками в горизонтальний ряд (snap-scroll + градієнт-підказка з краю), а не повними
`MatchSummary`-картками. Кожен напарник у парі — на своєму рядку (не через " / "), щоб задовге
ім'я не ховало другого партнера при обрізанні тексту.
- `src/lib/queries/matches.ts` — `getRecentCompletedMatches(limit)`, сортує за `completedAt`
  (момент фактичного внесення рахунку), а не за датою проведення.
- `src/app/page.tsx` — секція "Останні результати" з компактним `ResultTile`.

## 2026-08-04 — Set Club бали на рейтинговій картці профілю

Рейтингова картка (`/players/[id]`) тепер показує й бали "Set Club" за поточний сезон, а не лише
офіційний рейтинг (Glicko-2/OpenSkill). Картка перебудована на два рядки-секції: лейбл формату
("Одиночний"/"Парний рейтинг") зверху, далі офіційна модель (число + бейдж + власний рядок рангу),
розділювач, і так само для Set Club (бали + бейдж + власний рядок рангу) — кожен метод має свій
рахунок місця, а не один спільний. Рядок рангу: `# N з M гравців` (пробіл після `#`), трохи
збільшений шрифт (`text-sm`) для читабельності.
- `src/app/players/[id]/page.tsx` — `getSetClubSeasons`/`get{Singles,Doubles}SetClubPoints` для
  найновішого сезону, `RatingCard` перебудовано на дві секції з окремим рангом кожна.

## 2026-08-04 — Рейтингова картка на профілі гравця + клубна матриця "хто кого обігравав"

**Рейтингова картка** (`/players/[id]`): секція "Рейтинг клубу" з Glicko-2 (одиночний) та/або
OpenSkill (парний) рейтингом, ±розкидом і місцем у клубі — раніше було відкладено в
`docs/RATING.md` через відсутність спільного компонента для стат-карток.
- `src/components/stat-card.tsx` — `StatCard` винесено із `players/[id]/page.tsx` у спільний компонент.
- `src/app/players/[id]/page.tsx` — секція рейтингу, локальний `RatingCard`.

**Клубна матриця head-to-head** (нова секція на `/leaderboard`): для топ-8 гравців за перемогами
(з урахуванням активних фільтрів типу матчу/року) — таблиця рахунків "хто кого скільки разів
обіграв", з diverging-заливкою (зелений/червоний за win rate), рахунок завжди показаний текстом.
- `src/lib/head-to-head.ts` (+ `.test.ts`) — чиста функція побудови матриці з сирих рядків матчів.
- `src/lib/stats.ts` — `getHeadToHeadMatchRows`, кешований запит (той самий `STATS_CACHE_TAG`).
- `src/app/leaderboard/page.tsx` — секція "Хто кого обігравав".

## 2026-08-04 — Автоматичне очищення журналу адмін-дій (AuditLog)

Записи `AuditLog` раніше не видалялись ніколи. Домовились видаляти записи старші за рік.
- `.github/workflows/audit-log-retention.yml` — новий cron (щопонеділка), видаляє записи
  `audit_logs` старіші за 1 рік, за патерном `db-backup.yml`.
- `src/app/admin/audit/page.tsx` — примітка про ретенцію в UI журналу.
