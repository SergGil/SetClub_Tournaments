# Мобільний застосунок (Expo/React Native) — `mobile/`

## Контекст

Продовження мобільного напрямку після бекенд-шару (`docs/MOBILE_API.md`, `/api/v1/**` — повний
CRUD + bearer-автентифікація). Тепер сам React Native застосунок — окрема Expo-папка `mobile/` у
корені репозиторію, з прицілом на публікацію в Play Market і App Store через EAS Build.
Користувач підтвердив: окрема папка без monorepo-інструменту, і **повний адмінський
функціонал**, не лише перегляд — той самий принцип, що й для бекенду.

Обсяг величезний (10 доменів × CRUD × 2 види спорту), тож застосовано той самий підхід, що й для
бекенду: спершу повністю збудований один domain slice (**Tournaments**) як референс — bootstrap,
auth, навігація, дата-шар, форми, підтвердження. Решта доменів (matches, teams/ties, players,
news, menu, users, жеребкування, padel-дзеркала) — той самий патерн, наступними ітераціями.

## Стек і дизайн

- **Expo SDK 57**, TypeScript, Expo Router (файлова навігація, `src/app/` — стандартна структура
  шаблону `create-expo-app` на цій версії SDK, `@/` → `src/*`).
- **Навігація**: `expo-router`'s стабільні JS-таби (`Tabs` з `expo-router`, не
  `expo-router/unstable-native-tabs`, який стоїть у шаблоні за замовчуванням і вимагає власних
  PNG-іконок на таб — замінено на `@expo/vector-icons`, без кастомних асетів). П'ять табів:
  Турніри, Матчі, Рейтинг, Новини, Профіль (`src/app/(tabs)/`).
- **Дані**: `@tanstack/react-query` — кеш, `isLoading`/`isError`, інвалідація після мутацій.
  Хуки по доменах у `src/features/<domain>/api.ts`, дзеркалячи структуру бекенд-доменів.
- **Автентифікація**: `expo-auth-session` (генерична `AuthRequest`, НЕ застарілий
  `expo-auth-session/providers/google` і НЕ Expo auth-proxy — обидва вже не актуальні), PKCE,
  `response_type=code` проти Google OAuth/OIDC ендпоінтів напряму, обмін коду на токен —
  теж напряму (Google's "OAuth for Mobile & Desktop Apps" — публічний клієнт, без секрету).
  Отриманий `id_token` іде на вже готовий `POST /api/v1/auth/google`. Сесія (`sessionToken`,
  `expires`, `user`) зберігається через `expo-secure-store` (Keychain/Keystore).

  **Важливо, і це відхилення від початкового плану**: сучасна офіційна документація Expo
  (`docs.expo.dev/guides/google-authentication`) прямо каже, що жодна бібліотека для Google
  Sign-In (ні рекомендована нативна `@react-native-google-signin/google-signin`, ні
  генеричний `expo-auth-session` із власною custom-scheme redirect URI, яку тут використано) **не
  працює в Expo Go** — потрібен **development build** (`npx expo run:android` /
  `npx expo run:ios` / `eas build --profile development`). Це не вибір конкретної бібліотеки, а
  наслідок того, що Expo Go не може заздалегідь зареєструвати в Google Console свій redirect URI.
  Решта застосунку (перегляд/форми без входу) працює в Expo Go нормально — обмеження стосується
  лише самого екрана входу.
- **Перегляд без входу**: мовою бекенду — усі `GET /api/v1/**` для турнірів/матчів/рейтингу/новин
  публічні (як і відповідні сторінки вебу), тож `/` веде одразу в `(tabs)/tournaments`, без
  auth-гейту. Профіль-таб — єдине місце входу/виходу; кнопки адмінських дій (створити/
  редагувати/видалити) рендеряться лише коли `session.user.role`/`domains` дозволяють — та сама
  логіка, що й `isDomainAdmin` на бекенді, порахована на клієнті (`src/lib/permissions.ts`,
  клієнтський хелпер; сервер усе одно перевіряє права на кожен запис).

## Референс-домен: Tournaments

Повний слайс — `src/app/(tabs)/tournaments/`:
- `index.tsx` — список, пошук, кнопка "+" (лише для TENNIS-адміна).
- `[id]/index.tsx` — картка: інфо, учасники (сіяність/зняти/прибрати), групи, дії
  (редагувати/додати учасника/обнулити/видалити — з підтвердженнями, включно з
  cascade-reset діалогом при знятті учасника).
- `new.tsx`, `[id]/edit.tsx` — форма (`src/features/tournaments/tournament-form.tsx`, спільна),
  сегментовані пікери формату/статусу/покриття, дати через нативний `DateField`
  (`src/components/date-field.tsx`, `@react-native-community/datetimepicker` — діалог на Android,
  inline на iOS; емітує/приймає той самий `YYYY-MM-DD`, що раніше було текстовим полем).
- `[id]/add-participants.tsx` — пошук + мультивибір гравців (`src/features/players/api.ts`).

`src/features/tournaments/{api,types,tournament-form}.tsx` — react-query хуки й типи, що
дзеркалять `/api/v1/tournaments/**` (список/картка/CRUD/учасники/групи).

**Заготовки-плейсхолдери** (`src/components/screen-placeholder.tsx`): таби Матчі/Рейтинг/Новини
поки показують "Скоро тут з'явиться цей розділ" — наповнюються наступними ітераціями тим самим
патерном.

## Запуск і зовнішні кроки (користувач, не агент)

1. **Змінні середовища** — скопіювати `mobile/.env.example` → `mobile/.env`:
   - `EXPO_PUBLIC_API_BASE_URL` — LAN-IP машини, що піднімає `next dev` (не `localhost` — телефон
     його не бачить). `ipconfig` → знайти адресу вигляду `192.168.x.x`.
   - `EXPO_PUBLIC_GOOGLE_CLIENT_ID` — новий OAuth-клієнт (тип **"iOS"** або **"Android"**, НЕ
     "Web") у тому ж Google Cloud проєкті, що й `AUTH_GOOGLE_ID` кореневого `.env`.
2. **Development build** (обов'язково для входу через Google — Expo Go недостатньо, див. вище):
   `cd mobile && npx expo run:android` (Windows може білдити Android локально; iOS потребує Mac
   або `eas build --profile development --platform ios`).
3. Без входу (`npx expo start`, Expo Go) — можна розробляти й тестувати все, що не потребує
   сесії: перегляд списку/картки турніру, навігацію.

## Файли

- `mobile/` — весь Expo-проєкт (свій `package.json`/`node_modules`/`.gitignore` — останній вже
  ігнорує `node_modules/`, `.expo/`, `/ios`, `/android`, тож кореневий `.gitignore` окремо не
  чіпали).
- `mobile/src/lib/{api,auth-context,sport-context,session-storage,query-client,permissions,
  rating-math,photo-upload}.ts`.
- `mobile/src/features/{tournaments,matches,teams,players,news,menu,users,rating,randomize,
  photos}/**`.
- `mobile/src/components/date-field.tsx`.
- `mobile/src/app/**` (root `_layout.tsx`/`index.tsx`, `(tabs)/**` — `tournaments/`, `matches/`,
  `rating.tsx`, `news/`, `profile/` кожен свій Stack, `profile/` додатково хостить
  `players/`, `menu/`, `users.tsx` як адмінські підрозділи, а не окремі таби).
- `mobile/.env.example`.

## Статус доменів

Готово:
- **tournaments** — повний CRUD, учасники, групи; перемикач Теніс/Падел (`SportProvider`,
  `src/lib/sport-context.tsx`) на екрані списку — `canCreate` і всі мутації йдуть через
  `sportDomain(sport)`/`useBasePath()`.
- **matches** — список (з опційним `?tournamentId=` скоупом, кнопка "+ Матч" — з картки турніру),
  картка, форма створення/редагування (пікер гравців зі складу турніру), окремий екран рахунку
  (`[id]/score.tsx` — сети, зняття гравця, cascade-reset підтвердження при зміні рахунку).
  Перемикач Теніс/Падел показується лише коли список не заскоуплений на конкретний турнір
  (`!tournamentId`) — сам турнір уже фіксує вид спорту.
- **rating** — перемикач Теніс/Падел (тепер спільний глобальний `useSport()`, а не локальний стан
  екрана) і Одиночний/Парний, список гравців за conservative rating/ordinal
  (`src/lib/rating-math.ts` — легке дублювання чистої математики з
  `src/lib/rating/{glicko2,openskill}.ts`, без залежності від бекенду).
- **news** — список, картка, CRUD, завантаження фото (`expo-image-picker` → presign → PUT в R2,
  той самий `/api/news/photo-presign`, що й веб; `GET /api/v1/news{,/[id]}` тепер повертає
  обчислений `photoUrl`, оскільки `publicPhotoUrl()` потребує серверного `R2_PUBLIC_URL`).
- **players** — повний CRUD (список/пошук, створення/редагування/видалення), доступний під
  Профіль → "Гравці" (не окремий таб — гравці не мали власного пункту в узгодженому списку з
  5 табів; підрозділ доступний будь-якому domain-адміну, як і на вебі).
- **menu** (лише COFFEE) — секції + напої, CRUD, перемикач активності — під Профіль → "Меню
  кав'ярні", видимо лише COFFEE-адміну.
- **users** (SUPERADMIN-only) — список, зміна ролі (сегментований пікер) і доменів (чіпи
  TENNIS/COFFEE/PADEL, показані лише для ADMIN) — під Профіль → "Користувачі".
- **teams/ties** (лише MIXED-формат турнірів) — команди (CRUD, 2-4 гравці зі складу турніру),
  зустрічі (створення/видалення, вибір двох команд), раббери (матч у межах зустрічі, гравці
  обмежені саме складом двох команд цієї зустрічі, а не всім ростером), турнірна таблиця команд.
  Окремий екран `tournaments/[id]/teams.tsx`, кнопка "Команди та зустрічі" на картці турніру
  (лише коли `format === 'MIXED'`). Sport-aware (`canManage` через `sportDomain(sport)`).
  **Бекенд-прогалина, знайдена й закрита під час цього кроку**: `GET
  /api/v1/tournaments/[id]/{teams,ties}` не існували — були лише write-роути; додано,
  перевикористовуючи `getTournamentTeams`/`getTeamTieStandings`. Той самий брак виявлено й закрито
  для padel-дзеркала (`GET /api/v1/padel/tournaments/[id]/{teams,ties}`) і для фото турніру
  (`GET /api/v1/{,padel/}tournaments/[id]/photos`).
- **жеребкування** (повністю) — `tournaments/[id]/randomize.tsx`, кнопка "Жеребкування" на картці
  турніру (не для MIXED — ті керуються через Команди/зустрічі). Усі стратегії з
  `src/lib/actions/randomize-{singles,doubles,singles-groups12}.ts`: одиночний round robin
  (ALL/SEEDED_SPLIT, без прев'ю), одиночний CUSTOM_GROUPS (розбиття на групи), одиночний
  GROUPS_12_PLAYOFF (групи по 1-2 гравці з плейоф), парний плоский жереб і парний "За групами" —
  усі draw/commit-стратегії показують прев'ю перед підтвердженням і мають cascade-confirm при
  заміні вже завершених матчів (спільний хелпер `handleCommit()` в екрані).
- **фото турніру** — грід мініатюр (`expo-image`), "+ Фото" (`expo-image-picker` → presign → PUT
  в R2, той самий `/api/{news,photos,padel-photos}/presign`), довге натискання — видалити
  (лише для адміна відповідного виду спорту). `src/features/photos/**`.
- **Padel-параметризація** — tournaments, matches, teams/ties, randomize, rating усі йдуть через
  спільний глобальний `SportProvider`/`useSport()` (`src/lib/sport-context.tsx`): кожен домен
  вибирає базовий шлях (`/api/v1/tournaments` vs `/api/v1/padel/tournaments`) усередині своїх
  `api.ts`-хуків через `useBasePath()`, замість дублювання екранів (на відміну від бекенду, де
  кожен вид спорту — окремий Server Action файл). Перемикач — на екранах Турніри/Матчі(club-wide)/
  Рейтинг; сама картка турніру фіксує вид спорту, тож нижче за течією (учасники/матчі/команди/
  жеребкування/фото цього турніру) перемикач не потрібен.
- **нативний date-picker** — `src/components/date-field.tsx`
  (`@react-native-community/datetimepicker`), замінив текстові `РРРР-ММ-ДД`-поля в формах
  турніру, матчу й раббера.

### Налаштування ESLint

`mobile/` має власний `eslint.config.js` (`eslint-config-expo/flat`) і власні devDependencies
(`eslint`, `eslint-config-expo`) — **обов'язково**, оскільки ESLint flat config шукає найближчий
`eslint.config.*` вгору по дереву каталогів; без власного файлу `expo lint` мовчки підхоплював
кореневий `eslint.config.mjs` (Next.js-правила, не пристосовані під React Native) замість
Expo-специфічних. Побічний ефект виявився під час виключення `mobile/` з кореневого lint-run —
глобальний `globalIgnores(["mobile/**"])` без власного конфіга в `mobile/` ламав `npm run lint`
там повністю ("all files matching ... are ignored").

## Верифікація

- `npx tsc --noEmit`, `npx expo-doctor` (21/21) — чисто. `npm run lint` — одна помилка в
  незміненому шаблонному `use-color-scheme.web.ts` (успадковано з `create-expo-app`, поза межами
  цієї роботи).
- Кореневий Next.js застосунок не зачіпається — `mobile/` повністю ізольований.
- Ручна перевірка (потребує dev build + реальний Google-акаунт): вхід → `POST
  /api/v1/auth/google` → список турнірів → створення/редагування/видалення турніру, участь —
  синхронно видно на вебі (`/admin/tournaments`).
