# Фото турнірів — Cloudflare R2

## Контекст

Клуб хотів додати фотографії зі змагань (галерея на сторінці турніру). Порівняли кілька хмарних
сховищ (Vercel Blob, Cloudflare R2, Backblaze B2, Cloudinary) за ціною й архітектурою — обрали
**Cloudflare R2**: безкоштовний egress (важливо, бо фото переглядатимуть повторно), S3-сумісний
API (без vendor lock-in — стандартний `@aws-sdk/client-s3` працює без змін), і при масштабі клубу
(~100 користувачів/міс) реальна вартість — центи на місяць навіть при сотнях МБ/ГБ фото. Публічний
доступ до файлів — через вбудований **r2.dev** домен (без власного домену), з можливістю пізніше
перейти на кастомний домен без міграції даних: у БД зберігається лише ключ об'єкта, не повний URL.

## Архітектура завантаження: браузер → R2 напряму, минаючи сервер

Next.js docs (`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`, "Verify
payloads") прямо рекомендують завантажувати файли з браузера напряму в сховище, а в БД зберігати
лише URL/ключ. Причини й для нас: Server Actions мають ліміт тіла запиту 1MB за замовчуванням
(фото з телефону — 3-8MB), і виконуються послідовно по одному per client (паралельне завантаження
кількох фото чергувалось би).

Флоу:
1. Адмін обирає один чи декілька файлів у `PhotoUploadDialog` (`src/components/admin/photo-upload-dialog.tsx`).
2. Для кожного файлу клієнт викликає `POST /api/photos/presign` (`src/app/api/photos/presign/route.ts`,
   гейт `isAdmin()`), який генерує presigned PUT URL через `@aws-sdk/s3-request-presigner`
   (`src/lib/r2.ts`'s `createPresignedUploadUrl`).
3. Клієнт робить `fetch(uploadUrl, { method: "PUT", body: file })` — файл летить напряму в R2,
   минаючи наш сервер повністю.
4. Після успішного PUT клієнт викликає Server Action `confirmPhotoUploadAction` (`src/lib/actions/photos.ts`) —
   створює рядок `Photo`, пише audit log (`photo.upload`), `revalidatePath`.
5. Видалення — `deletePhotoAction`: видаляє рядок з БД і best-effort (не блокуюче, всередині
   `after()`) видаляє об'єкт з R2; якщо R2-видалення впаде, лишається лише `console.error` —
   осиротілий об'єкт коштує копійки й не впливає на коректність.

### Чому `confirmPhotoUploadAction` НЕ ревалідує `/tournaments/[id]`

`revalidatePath` для шляху, який адмін саме зараз переглядає, за офіційною поведінкою Server
Function ("Updates the UI immediately if viewing the affected path") одразу перерендерює всю
сторінку — а `PhotoUploadDialog` вантажить кілька файлів паралельно (`Promise.all`), кожен зі
своїм окремим викликом `confirmPhotoUploadAction`. Якби кожен виклик сам ревалідував
`/tournaments/${tournamentId}`, пакет із N фото перерендерював би відкриту (з діалогом і
галереєю позаду) сторінку турніру N разів поспіль — видимий "дриганий" ефект, коли спінер
завантаження то зникає, то з'являється знову.

Фікс: дія ревалідує лише `/gallery` і `/gallery/[id]` (не поточно відкриту сторінку), а
`PhotoUploadDialog` сам викликає `router.refresh()` **один раз**, коли весь `Promise.all`-пакет
завершився — один чистий перерендер замість N.

## `src/lib/r2.ts` — лінива ініціалізація клієнта

На відміну від `src/lib/db.ts` (де `PrismaClient` створюється одразу при імпорті модуля, бо
`DATABASE_URL` — це загальна для всього застосунку залежність), S3-клієнт у `r2.ts` створюється
**лінива** — лише при першому реальному виклику `createPresignedUploadUrl`/`deleteObject`. Якби
клієнт створювався на рівні модуля, `next build` падав би для всього застосунку, щойно
`/api/photos/presign` імпортується під час збору даних сторінок (Next це робить для кожного route
незалежно від того, чи він реально викликається) — а R2-креденшли ще не обов'язково існують
одразу (це фіча, що додається окремо, не hard-залежність усього застосунку).

## Показ фото: превью через `next/image`, повна якість — оригінал

- Сітка галереї (`src/components/photo-lightbox.tsx`) — `next/image` (перше використання в
  проєкті) з `remotePatterns` на `*.r2.dev` (`next.config.ts`), дефолтна якість 75% — досить для
  превью, значно менший розмір файлу.
- Лайтбокс (клік на фото) — пряме посилання на оригінал у R2 (`<img>` без next/image
  оптимізації, `publicPhotoUrl()` з `r2.ts`) — це і є перегляд "без втрати якості": превью швидко
  вантажаться стисненими, повнорозмірний перегляд — оригінал 1:1.

## Код/файли

- **Схема** — `Photo` model у `prisma/schema.prisma` (`tournamentId`, `key` — R2-ключ, не URL,
  `caption`, `uploadedById` з `onDelete: SetNull`, як `AuditLog.actor`/`Player.user` — видалення
  юзера не ламає історію фото).
- **`src/lib/r2.ts`** — S3-клієнт (лінивий, див. вище), `createPresignedUploadUrl`,
  `deleteObject`, `publicPhotoUrl`.
- **`src/lib/validation/photo.ts`** — Zod-схеми (`presignRequestSchema`, `confirmPhotoSchema`),
  `ALLOWED_PHOTO_CONTENT_TYPES` (jpeg/png/webp), `MAX_PHOTO_BYTES` (20MB — лише запобіжник проти
  випадково величезного файлу, не про якість).
- **`src/app/api/photos/presign/route.ts`** — Route Handler, генерує presigned URL.
- **`src/lib/actions/photos.ts`** — `confirmPhotoUploadAction`, `deletePhotoAction`.
- **`src/lib/audit-actions.ts`** — `photo.upload`/`photo.delete`.
- **UI** — `src/components/admin/photo-upload-dialog.tsx` (мультизавантаження з прогресом на
  кожен файл, без `useActionState`/`<form action>` — несумісно з presign+PUT флоу, де потрібен
  клієнтський прогрес; `useTransition` + прямі виклики Server Actions, як `addParticipantAction` у
  `tournament-roster.tsx`), `src/components/tournament-gallery.tsx` (серверний, завантажує список
  фото), `src/components/photo-lightbox.tsx` (клієнтський, сітка + лайтбокс + видалення).
- **`src/app/tournaments/[id]/page.tsx`** — кнопка "Додати фото" (адмін-гейт) поруч з "Керувати",
  секція галереї після списку матчів.
- **`next.config.ts`** — CSP `img-src` і `images.remotePatterns` для `*.r2.dev` (показ фото), і
  окремо CSP `connect-src` для `*.r2.cloudflarestorage.com` (сам аплоад — presigned PUT, який
  браузер шле напряму на S3 API endpoint, не на публічний r2.dev; це два різні хости, і без
  `connect-src` браузер блокує сам fetch ще до CORS-перевірки).
- **`src/lib/queries/photos.ts`** — `getPhotosByTournament(tournamentId)` (спільний запит для
  `TournamentGallery` і `/gallery/[id]`, мапить `key` → публічний URL), `getTournamentsWithPhotos()`
  (турніри з хоч одним фото, з обкладинкою-мініатюрою й лічильником, для `/gallery`).
- **`src/app/gallery/page.tsx`** і **`src/app/gallery/[id]/page.tsx`** — окремий розділ меню
  ("Фото" у `src/lib/site.ts`'s `NAV_LINKS`): список турнірів, у яких є фото (грід карток з
  обкладинкою), клік → повна галерея цього турніру (той самий `PhotoLightbox`, що й на сторінці
  турніру). Без пагінації/пошуку — навмисне спрощення, кількість турнірів з фото росте повільно.

## Падел: окрема таблиця, спільна `/gallery`

Падел-турніри отримали ту саму можливість — фотографії, ідентичні за флоу Тенісу, — але
`Photo.tournamentId` є FK лише на `Tournament`. Замість nullable другого FK на `Photo`
(зламало б наявні cascade/index на цій таблиці) додано окрему модель `PadelPhoto`, що дзеркалить
`Photo` поле-в-поле, FK'd на `PadelTournament` — той самий принцип "повністю окремі
`Padel*`-таблиці", що й для решти турнірного рушія Падела (`docs/PADEL.md`).

- **Схема** — `PadelPhoto` у `prisma/schema.prisma` (той самий набір полів, що й `Photo`).
- **`src/lib/queries/padel-photos.ts`** — `getPhotosByPadelTournament`/
  `getPadelTournamentsWithPhotos`, прямі двійники функцій із `queries/photos.ts`.
- **`src/lib/actions/padel-photos.ts`** — `confirmPadelPhotoUploadAction`/`deletePadelPhotoAction`,
  `requireDomainAdmin("PADEL")` замість `"TENNIS"`.
- **`src/app/api/padel-photos/presign/route.ts`** — той самий флоу, гейт `isDomainAdmin("PADEL")`,
  ключ `padel-tournaments/${tournamentId}/...` (окремий префікс від `tournaments/...`, хоч дані й
  так у різних таблицях — про всяк випадок, той самий принцип, що й окремий ключ advisory lock у
  Падел-рандомайзерах).
- **`src/components/admin/padel-photo-upload-dialog.tsx`**, **`src/components/padel-tournament-gallery.tsx`** —
  двійники, змонтовані на `src/app/padel/tournaments/[id]/page.tsx` так само, як тенісні на
  `src/app/tournaments/[id]/page.tsx`.
- **`src/app/gallery/padel/[id]/page.tsx`** — двійник `gallery/[id]/page.tsx` (окремий шлях, а не
  той самий `[id]`, щоб `/gallery/[id]` і надалі однозначно означав тенісний турнір).

### `/gallery` — одна спільна стрічка на обидва види спорту

`getTournamentsWithPhotosAcrossSports()` (`src/lib/queries/photos.ts`) викликає
`getTournamentsWithPhotos()` і `getPadelTournamentsWithPhotos()` паралельно, мапить кожен рядок у
`{ sport: "TENNIS" | "PADEL", id, name, startDate, endDate, coverKey, photoCount }` і сортує
разом за датою початку — єдина функція, яку викликає `/gallery/page.tsx`. Кожна картка отримує
бейдж "Теніс"/"Падел" і веде на `/gallery/${id}` або `/gallery/padel/${id}` залежно від виду
спорту. Перегляд конкретного турніру лишається на двох різних шляхах (не єдиному `[id]`) саме
тому, щоб не ускладнювати `/gallery/[id]` пошуком по обох таблицях і не міняти наявні тенісні
посилання.

### `PhotoLightbox` — один компонент, дія передається пропсом

`PhotoLightbox` раніше імпортував `deletePhotoAction` напряму — єдине місце в цьому флоу, де
компонент не можна було перевикористати як є. Тепер він приймає `deleteAction` пропсом
(`(photoId: string) => Promise<{ error?: string }>`); `TournamentGallery`/`gallery/[id]/page.tsx`
передають `deletePhotoAction`, `PadelTournamentGallery`/`gallery/padel/[id]/page.tsx` —
`deletePadelPhotoAction`. Той самий принцип, що й `renderGroupHeaderExtra` на
`TournamentStandingsSection` — параметризувати змінну частину пропсом замість дублювання ~150
рядків UI лайтбоксу/клавіатурної навігації/підтвердження видалення.

## Новини: одна обкладинка замість галереї

Новини (`NewsPost.photoKey`) мають щонайбільше одне фото — не окрему таблицю `Photo`, а один
nullable-стовпець на самому пості, бо тут немає ні множинності, ні підпису/автора для кожного
фото. Флоу той самий "браузер → R2 напряму" з причин вище, лише інакше влаштований, бо фото
обирають ще у формі створення посту, коли рядка `NewsPost` в БД ще не існує:

- `src/app/api/news/photo-presign/route.ts` — presign без `tournamentId`/`newsPostId`, ключ
  просто `news/${randomUUID()}-${ім'я файлу}`.
- `src/components/admin/news-photo-field.tsx` — на вибір файлу одразу пресайнить і вантажить у R2
  (до сабміту форми), показує локальний preview, кладе готовий ключ у прихований `photoKey`.
  Нема окремого "confirm" Server Action, як у `confirmPhotoUploadAction`, — `createNewsPostAction`/
  `updateNewsPostAction` просто пишуть цей ключ у `photoKey` як звичайне поле форми.
- Видалення/заміна старого R2-об'єкта — best-effort, у самих `createNewsPostAction`/
  `updateNewsPostAction`/`deleteNewsPostAction` (`src/lib/actions/news.ts`), той самий підхід, що
  й `deletePhotoAction`: не блокує, помилка йде лише в `console.error`.
- Показ — `next/image` (`src/components/news-card.tsx`, `src/app/news/[id]/page.tsx`,
  `src/app/admin/news/page.tsx`), `sanitizeFileName`/`publicPhotoUrl` з того самого `src/lib/r2.ts`.

## Налаштування R2 (ручні кроки, виконує адмін клубу)

1. Cloudflare Dashboard → R2 → створити bucket (напр. `setclub-photos`).
2. Bucket → Settings → **Public Development URL** (те саме, що раніше називалось "r2.dev
   subdomain" — Cloudflare перейменував) → Enable → скопіювати URL виду `https://pub-<hash>.r2.dev`.
3. R2 Object Storage → Overview → Manage API Tokens → створити токен з правами Object Read &
   Write, обмежений на цей bucket → Access Key ID, Secret Access Key. Account ID видно в самому
   bucket на вкладці Settings, поле "S3 API" (частина URL перед `.r2.cloudflarestorage.com`).
4. Додати `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
   `R2_PUBLIC_URL` у `.env.local` (локально) і у Vercel project settings (production) — див.
   коментарі в `.env.example`.
5. Bucket → Settings → **CORS Policy** — без цього браузер блокує сам presigned PUT (preflight
   не проходить, окремо від CSP `connect-src` вище — обидва потрібні). Приклад політики:
   ```json
   [
     {
       "AllowedOrigins": ["https://set-club.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   Через S3 API (`PutBucketCorsCommand`) це не виставити токеном з правами лише Object Read &
   Write (потрібен ширший "Admin" рівень) — простіше й безпечніше додати руками через UI, це
   одноразове налаштування бакета, не рантайм-креденшл.

Перехід пізніше на власний домен: прив'язати домен до Cloudflare, підключити як custom domain до
bucket, оновити `R2_PUBLIC_URL` і `next.config.ts` — без міграції даних, бо в БД лежить лише ключ.

## Верифікація

- `npm run build` — обов'язково після зміни `"use server"`-файлу `photos.ts`/`padel-photos.ts`
  (build-only помилка експорт-обмежень, яку не ловить tsc/vitest per стандартне правило
  репозиторію).
- `npx vitest run tests/lib/actions/photos.test.ts tests/lib/queries/photos.test.ts tests/lib/actions/padel-photos.test.ts tests/lib/queries/padel-photos.test.ts` —
  Zod-валідація, admin-гейт, best-effort cleanup, форма запитів (мокає `src/lib/r2.ts`/
  `src/lib/db.ts`, реальних R2-викликів у тестах немає).
- Повний upload-флоу (presign → PUT → confirm) перевірено вручну проти реального R2-бакета —
  працює, разом з `/gallery`, `/gallery/[id]` і `/gallery/padel/[id]`.
