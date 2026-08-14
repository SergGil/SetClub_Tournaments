# SEO та соціальні прев'ю

## Контекст

Ручний аудит застосунку (окрема сесія, "Подивись застосунок увесь, чи є що покращувати?") виявив
дві прогалини, не пов'язані з жодним багом: жодна сторінка не мала `openGraph`/`twitter`
metadata (лише `title`), і не було ні `robots.ts`, ні `sitemap.ts`. Найцінніше: застосунок вже
вміє генерувати branded PNG-картинки для турнірів/матчів/сезону через `next/og` `ImageResponse`
(`docs/SHARE_CARDS.md`) — але лише за явним кліком кнопки «Поділитися», не для прев'ю самого
посилання в месенджері.

## Канонічний домен: `getSiteUrl()`

`src/lib/site.ts` — `getSiteUrl()` резолвиться з Vercel-івської `VERCEL_PROJECT_PRODUCTION_URL`
(production-домен проєкту — власний, якщо підключений, інакше `*.vercel.app`; Vercel сама
виставляє цю змінну в кожному середовищі) замість ручного env var, яку довелось би тримати
синхронізованою вручну. Фолбек на `http://localhost:3000` для `next dev`/локального `next build`,
де цієї змінної нема. Свідомо не хардкодиться (на відміну від `card-chrome.tsx`'s
`set-club.vercel.app` у футері карток — той рядок поза межами цього фіксу).

## `metadataBase` + сайт-вайд `openGraph`/`twitter` (src/app/layout.tsx)

`metadataBase: new URL(getSiteUrl())` — дозволяє всюди нижче писати відносні URL (`/api/share/...`)
замість ручного конкатенування `getSiteUrl()` в кожному місці; Next сам резолвить їх в абсолютні.

Дефолтний `openGraph`/`twitter` показує **новий** branded fallback-образ
(`/api/share/default`, `src/lib/share/default-card-image.tsx`) — той самий `card-chrome.tsx`
(фон/шапка/підвал), що й у match/tournament/season картках, тож будь-яка сторінка без власного
образу все одно виглядає "на бренді", а не голим текстом. Маршрут `GET /api/share/default`
(`src/app/api/share/default/route.tsx`) — чисто статичний вивід (жодного DB-читання), тому
`export const dynamic = "force-static"`.

**Важливо для будь-якої майбутньої сторінки**: Next мерджить metadata між сегментами лише
**неглибоко** — якщо дочірня сторінка сама задає `openGraph`, весь об'єкт з батьківського
layout **замінюється**, а не мерджиться поле-в-поле (див.
`node_modules/next/dist/docs/.../generate-metadata.md`'s "Merging"). Тобто сторінка, що хоче
власний `openGraph.title`, має повторити й `images`/`description` самостійно — інакше
втратить дефолтний образ мовчки.

## Сторінки з власним, конкретнішим прев'ю

- `src/app/tournaments/[id]/page.tsx` / `src/app/padel/tournaments/[id]/page.tsx` —
  `openGraph.images` вказує на вже наявний `/api/share/(padel-)tournament/[id]` (той самий
  ендпоінт, що й кнопка «Поділитися» на цій сторінці). Той маршрут сам 404-иться (JSON, не
  картинка), поки в турнірі не вирішені підсумкові місця — тоді прев'ю просто без картинки
  (title/description лишаються), не зламана сторінка.
- `src/app/news/[id]/page.tsx` — `openGraph.images` вказує на вже завантажене фото новини
  (`publicPhotoUrl(post.photoKey)`), якщо воно є; без фото — не задає власний `openGraph` взагалі,
  тож успадковує сайт-вайд дефолт (title/description все одно свої). Опис — `excerpt(post.body)`
  (`src/lib/text-excerpt.ts`, + тест): збиває переноси рядків у пробіли, ріже до ~160 символів,
  додає "…" лише коли справді обрізано.

Свідомо НЕ чіпалось: `/players/[id]`, `/gallery/[id]`, `/gallery/padel/[id]` — власного
share-card-образу для гравця чи фотоальбому в застосунку не існує (тільки match/tournament/season),
тож ці сторінки просто успадковують сайт-вайд дефолт без додаткового коду.

## `robots.ts` / `sitemap.ts`

- `src/app/robots.ts` — дозволяє все, крім `/admin` (і так за автентифікацією — це гігієна для
  сканерів, не межа доступу) і `/api` (не контент сторінки).
- `src/app/sitemap.ts` — статичні хаб-сторінки (`/`, `/tennis`, `/padel`, `/tournaments` тощо) +
  динамічні: турніри (Tennis/Padel), гравці, новини, галерея (лише турніри з фото, той самий
  `getTournamentsWithPhotosAcrossSports`, що й `/gallery`). `lastModified` — з `updatedAt` там, де
  модель його має (Tournament/PadelTournament/NewsPost); `Player` його не має, тому без
  `lastModified` для `/players/[id]`.
