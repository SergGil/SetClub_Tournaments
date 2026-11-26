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
  сканерів, не межа доступу) і `/api` (не контент сторінки). З 2026-11-25 це
  `src/app/robots.txt/route.ts` з тими самими правилами плюс `Content-Signal` (див. «AI-готовність»
  нижче).
- `src/app/sitemap.ts` — статичні хаб-сторінки (`/`, `/tennis`, `/padel`, `/tournaments` тощо) +
  динамічні: турніри (Tennis/Padel), гравці, новини, галерея (лише турніри з фото, той самий
  `getTournamentsWithPhotosAcrossSports`, що й `/gallery`). `lastModified` — з `updatedAt` там, де
  модель його має (Tournament/PadelTournament/NewsPost); `Player` його не має, тому без
  `lastModified` для `/players/[id]`.

## AI-готовність (сканування sagbot.app, 2026-11-25)

### Контекст

Сканер sagbot.app оцінив головну на 47/100 (Agent-ready) і 41/100 (Answer-ready) та видав 13
виправлень. Корінь більшості з них один: головна майже повністю візуальна (фото TripleSplit,
бігучий рядок, цифри), тож без JavaScript краулер бачив ~125 слів, жодного `<h1>`, жодного
абзацу під заголовком і жодної структурованої розмітки. До того ж `<title>` був 8 символів
(`SET.club`), не було canonical, `llms.txt`, Markdown-версії та сигналів автора й дати.

### Що зроблено

- **Текст для цитування.** Новий блок `HomeAbout` (`src/components/home-about.tsx`) унизу головної,
  перед футером: `<h1>`, вступ і 9 пар «питання `<h2>` → відповідь `<p>`». Текст лежить у
  `src/lib/home-about.ts`. Кожна відповідь має 1–2 речення та 40–320 символів, і `<p>` стоїть
  одразу під заголовком: саме такий абзац системи відповідей беруть у цитату. Тест
  `tests/lib/home-about.test.ts` стежить за цими межами. Без скорочень із крапкою («м.», «обл.»),
  бо наївний поділ на речення рахує їх як кінець речення. Писати лише те, що вже підтверджують
  інші сторінки сайту (ціни, школа, тренери, рейтинг): ШІ повторить це дослівно. Після змін на
  головній ~426 слів без JS.
- **Ціни з одного джерела.** `PRICES` винесено зі сторінки цін у `src/lib/tennis-pricing.ts`, бо
  відповідь про оренду корту цитує ту саму ціну.
- **Заголовок і canonical** (лише на головній, `src/app/page.tsx`). `title.absolute` =
  `SET.club — теніс, кава та падел у Південному` (44 символи, без шаблону `%s · SET.club`).
  `alternates.canonical: "/"` і `alternates.types["text/markdown"]: "/index.md"`. Canonical
  свідомо не в root layout: там він направив би на `/` кожну сторінку без власного canonical.
  Next сам віддає canonical головної як голий origin (`https://set-club.vercel.app`, без `/`):
  це та сама адреса.
- **JSON-LD** (`src/lib/structured-data.ts`). Один `@graph`: `Organization` (`#org`: name,
  url, logo 512px з `/manifest-icons/512`, телефон, адреса, `sameAs`), `WebSite` з
  `publisher` → `#org` і `WebPage` з `author`/`publisher` → `#org` та `dateModified`. Саме
  `Organization`, а не `SportsClub`/`LocalBusiness`: ті мають сенс лише з вулицею й
  координатами, яких сайт не публікує. `name` дорівнює `SITE_NAME`, як і `og:site_name` та
  початок `<title>`, тож це одна сутність. Скрипт екранує `<` (`jsonLdScriptContent`).
- **FAQPage** (додано 2026-11-25 після повторного сканування). Вузол головної — не `WebPage`, а
  `FAQPage` (підтип `WebPage`, тож `author`, `dateModified` тощо лишаються валідними) з
  `mainEntity`: усі 9 пар `Question` → `acceptedAnswer` з `HOME_FAQ`. Розмітка будується з тієї
  самої константи, що й видимий текст, бо schema.org і Google вимагають точного збігу; тест
  `tests/lib/structured-data.test.ts` це перевіряє. Google не показує FAQ-сніпети для звичайних
  сайтів і не потребує цієї розмітки для AI Overviews, але інші системи відповідей її читають.
- **Автор і дата.** `authors` у root layout дає `<meta name="author" content="SET.club">` на всіх
  сторінках: усе публікує сам клуб. Дата — справжня: `getContentLastUpdatedAt()`
  (`src/lib/queries/home-stats.ts`) бере найновіше з двох джерел: останній запис журналу дій
  (`AuditLog`, `entityType` Tournament/Match/NewsPost) — лише він пам'ятає видалення, бо в
  видаленого рядка немає `updatedAt`; і найновіший `updatedAt` тенісних турнірів, матчів і новин —
  для змін, що оминули журнал (скрипти, імпорт, невдалий best-effort `logAudit`). Вона
  показується як `<time datetime>` («Оновлено 9 листопада 2026 р.», `formatLongDateKyiv`) і йде в
  `dateModified`. Падел не враховується, поки він доступний лише адмінам.
- **`sameAs`.** Профілі клубу тепер у `SOCIAL_PROFILES` (`src/lib/site.ts`); футер бере звідти
  ж Instagram. Сканер хоче щонайменше два профілі (тест у `tests/lib/structured-data.test.ts`
  це перевіряє). Другий — місце клубу в Google Maps (там воно поки називається «SET.kava»),
  додане 2026-11-25 у формі `https://maps.google.com/?cid=4568471442672815895`, а не скопійованим
  `/maps/place/...`: `cid` — постійний ідентифікатор місця, він не зміниться після
  перейменування чи інших правок у Google Maps і не несе координат камери чи трекінг-параметрів.
  `cid` — це десяткова форма hex-id `0x3f66789283078f17` з посилання на місце. Нові профілі
  (Facebook тощо) додавати в цей самий масив.
- **`/llms.txt`** (`src/app/llms.txt/route.ts`, статичний): H1, цитата-опис, розділи з
  абсолютними посиланнями на публічні сторінки (`PUBLIC_SECTIONS`; без `/padel/*`, `/admin`,
  `/api`, `/login`). Віддається як `text/plain`, щоб браузер показував файл, а не завантажував.
- **Markdown для агентів.** `/index.md` (`src/app/index.md/route.ts`, динамічний, бо містить
  живі цифри й дату) віддає головну як `text/markdown` з `Vary: Accept` і
  `Link: <…/>; rel="canonical"`, щоб пошуковик не вважав її дублем. `/` віддає її,
  коли Accept надає перевагу Markdown: це вирішує `src/proxy.ts` через `prefersMarkdown`
  (`src/lib/accept-markdown.ts`) з урахуванням q-значень, тож `text/markdown;q=0` («ніколи») чи
  вищий q для `text/html` лишають HTML; при рівних q перемагає Markdown, бо клієнт назвав його
  прямо. Proxy запускається лише для `/` з `text/markdown` в Accept (`has` у matcher); браузери
  такого не надсилають, тож звичайні відвідини головної його оминають. Спершу це був `beforeFiles`
  rewrite у `next.config.ts`, але regex не вміє порівнювати q-значення. HTML `/` має `Cache-Control: private, no-store`, тож спільний кеш не
  переплутає дві версії.
- **Заголовок `Link`** на `/` (`next.config.ts`): `</index.md>; rel="alternate"; type="text/markdown"`
  і `</llms.txt>; rel="describedby"`. Next дописує свої preload-значення шрифтів/CSS окремим
  `Link`, а не замінює наш.
- **`robots.txt`.** `robots.ts` замінено route handler'ом `src/app/robots.txt/route.ts`, бо тип
  `MetadataRoute.Robots` не має місця для `Content-Signal`. Додано
  `Content-Signal: search=yes, ai-input=yes, ai-train=yes`; правила allow/disallow ті самі.
  `ai-train=yes`, бо robots.txt і так пускає тренувальних ботів (GPTBot, ClaudeBot), а клубу
  вигідно, щоб моделі його знали. Якщо колись треба заборонити навчання, змінити на `ai-train=no`.

### Верифікація

`tsc`, `eslint`, повний `vitest run`, `npm run build`, потім `next start` з реальною базою:
`/` з `Accept: text/markdown` → `text/markdown` + `Vary: Accept`; звичайний `/` → HTML з обома
`Link`; `robots.txt` з `Content-Signal`; `llms.txt`; у `<head>` title, canonical, alternate,
author; JSON-LD валідний; ~426 слів без JS. Скриншоти блоку на 1440 і 390 px.

## Google Search Console (2026-11-25)

Сайт підтверджено в Google Search Console як «Ресурс із префіксом у URL»
`https://set-club.vercel.app/` (доменний ресурс неможливий: DNS `vercel.app` належить Vercel).
Спосіб — HTML-файл: `public/google61fcf92309bca5ac.html`, вміст рівно
`google-site-verification: google61fcf92309bca5ac.html` (без переносу рядка). Next віддає його
як статичний файл за адресою `/google61fcf92309bca5ac.html`.

**Не видаляти й не перейменовувати**: Google періодично перевіряє файл, і без нього ресурс
втрачає підтвердження. Якщо сайт переїде на власний домен, його треба буде підтвердити заново
(для власного домену вже можна й доменний ресурс через DNS TXT). Після підтвердження в Search
Console варто надіслати карту сайту `https://set-club.vercel.app/sitemap.xml` (Індексування →
Файли Sitemap).

## Фавікон (2026-11-26)

Після першого індексування Google показував біля сайту сірий глобус (фавікон ще не оброблено), а
готувався показати гірше: `src/app/favicon.ico` з першого коміту був стандартною іконкою
create-next-app — трикутником Vercel. Як найбільша оголошена іконка (256px) і перша в `<head>`,
вона й стала б фавіконом у пошуку.

Тепер `src/app/favicon.ico` видалено, а `src/app/icon.tsx` через `generateImageMetadata` віддає дві
іконки: `/icon/large` (192px, кратно 48 — фірмовий знак «SET. club» з `brandIconElement`, як у PWA,
Apple-іконці та аватарі Instagram; саме його бере Google, якому потрібен квадрат понад 48px) і
`/icon/small` (32px, зелене коло з «S» для вкладок браузера, де «SET. club» нечитабельний).
`/favicon.ico` переписано на `/icon/small` у `next.config.ts` для клієнтів, які просять його
навмання (не-HTML сторінки, деякі боти прев'ю). Google оновлює фавікон із затримкою: від кількох
днів до кількох тижнів після повторного сканування головної.

## Назва сайту в Google: «Vercel» замість «SET.club» (2026-11-26)

Над заголовком результату Google показував «Vercel». Назву сайту Google обирає сам; розмітка
`WebSite.name` (`SET.club`) — лише підказка. Для сайтів на `*.vercel.app` інші розробники
повідомляють той самий симптом без гарантованого рішення, якщо Google не впевнений у назві.

Що зроблено, щоб посилити сигнали:
- `WebSite.alternateName` = `["SET club", <host сайту>]` (`SITE_ALTERNATE_NAMES` у `src/lib/site.ts`,
  host додається в `structured-data.ts` з `getSiteUrl()`). Документація Google: якщо система не
  впевнена в `name`, вона зважає на `alternateName`, а власний домен/піддомен у кінці списку —
  рекомендований запасний варіант. Тож у гіршому разі буде `set-club.vercel.app`, а не «Vercel».
  «SET club» без крапки, бо «SET.club» схоже на окремий домен set.club.
- Заголовок і `<h1>` головної: «SET.club — тенісний клуб, кава та падел у Південному»; вступ
  починається з «SET.club — тенісний клуб…»; `SITE_DESCRIPTION` (meta description, og, Organization)
  тепер «SET.club — тенісний клуб у м. Південне, Одеська обл.: ґрунтові корти, турніри, рейтинг
  гравців, кав'ярня та падел.» Кава й падел лишились, щоб не повернутися до старого
  «тільки теніс» формулювання.

Google оновлює назву від кількох днів до кількох тижнів після повторного сканування. Єдиний
надійний спосіб отримати власну назву (і доменний ресурс у Search Console) — власний домен.
