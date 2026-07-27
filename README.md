# Set Club 🎾

Сайт місцевого тенісного клубу: турніри 1×1 / 2×2 / змішаного формату, результати матчів і
загальний рейтинг учасників за всю історію клубу.

Продакшн: https://set-club.vercel.app

## Стек

- [Next.js](https://nextjs.org) 16 (App Router) + TypeScript
- [Auth.js](https://authjs.dev) (Google OAuth), ролі `ADMIN` / `MEMBER`
- [Prisma](https://www.prisma.io) ORM + PostgreSQL ([Neon](https://neon.tech))
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com) (Base UI)
- [Vitest](https://vitest.dev) (юніт-тести) + [Playwright](https://playwright.dev) (e2e)

Детальний опис моделі даних та архітектурних рішень — у [docs/PLAN.md](docs/PLAN.md).

## Розробка

1. Скопіюй `.env.example` у `.env` і заповни значення (Neon `DATABASE_URL`, Google OAuth
   credentials, `AUTH_SECRET`, `ADMIN_EMAILS`).
2. Встанови залежності та застосуй міграції:

   ```bash
   npm install
   npm run db:migrate
   ```

3. Запусти сервер розробки:

   ```bash
   npm run dev
   ```

   Відкрий [http://localhost:3000](http://localhost:3000).

## Корисні команди

```bash
npm run dev          # dev-сервер
npm run build         # продакшн-білд
npm run lint           # ESLint
npm run test            # юніт-тести (Vitest)
npm run test:e2e         # e2e-тести (Playwright, потребує запущений dev-сервер)
npm run db:migrate        # застосувати нову Prisma-міграцію
npm run db:studio          # Prisma Studio — переглянути дані в браузері
```

## Ролі

- **ADMIN** — створює турніри, гравців (включно з "заглушками" без Google-акаунту для
  історичних результатів), матчі та вносить рахунок. Призначається автоматично при першому
  вході через Google, якщо email є у `ADMIN_EMAILS`; далі ролі інших користувачів змінюються в
  `/admin/users`.
- **MEMBER** — усі інші зареєстровані користувачі, лише перегляд.

## Деплой

Хоститься на [Vercel](https://vercel.com) з базою на [Neon](https://neon.tech). Env-змінні
задаються в налаштуваннях Vercel-проєкту (не в `.env` — той не завантажується при деплої, див.
`.vercelignore`). Після зміни продакшн-домену онови Authorized redirect URI в
[Google Cloud Console](https://console.cloud.google.com/apis/credentials):
`https://<домен>/api/auth/callback/google`.
