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

- `npm run build` — обов'язково після зміни `"use server"`-файлу `photos.ts` (build-only помилка
  експорт-обмежень, яку не ловить tsc/vitest per стандартне правило репозиторію).
- `npx vitest run tests/lib/actions/photos.test.ts tests/lib/queries/photos.test.ts` — Zod-валідація,
  admin-гейт, best-effort cleanup, форма запитів (мокає `src/lib/r2.ts`/`src/lib/db.ts`, реальних
  R2-викликів у тестах немає).
- Повний upload-флоу (presign → PUT → confirm) перевірено вручну проти реального R2-бакета —
  працює, разом з `/gallery` і `/gallery/[id]`.
