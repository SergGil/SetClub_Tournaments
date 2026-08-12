# Домен-скоуповані адмін-права: суперадмін + Кава/Теніс/Падел

## Контекст

Клуб розширюється на три напрямки (Теніс/Кава/Падел). Поточна модель прав пройшла дві ітерації:

1. **Перша:** плоский `Role: ADMIN | MEMBER`, де `ADMIN` одразу означав повний суперадмінський
   доступ, а домени (`UserAdminDomain`) додавались поверх звичайного `MEMBER`.
2. **Друга, поточна (за прямим проханням користувача):** справжня трирівнева роль —
   **`SUPERADMIN`** (повний доступ всюди, завжди), **`ADMIN`** (проміжний рівень, сам собою нічого
   не дає — стає корисним лише разом із хоч одним призначеним доменом), **`MEMBER`** (звичайний
   учасник, без жодного адмін-доступу). Домени (`UserAdminDomain`) тепер **мають значення лише для
   `ADMIN`** — щоб реально керувати чимось, спершу підвищуєте людину з `MEMBER` до `ADMIN`, потім
   призначаєте їй один або кілька доменів (Кава/Теніс/Падел, можна поєднувати).

Кава і Падел поки не мають контенту для адміністрування (Кава — заглушка `/coffee`, Падел — без
сторінки взагалі), тому зараз є **тільки права доступу** (модель даних + призначення через
`/admin/users`), без нових `/admin/coffee` чи `/admin/padel` сторінок.

## Модель даних

`enum Role { SUPERADMIN ADMIN MEMBER }` (`prisma/schema.prisma`) + `enum AdminDomain { TENNIS
COFFEE PADEL }` і join-модель `UserAdminDomain` (userId, domain, `@@unique([userId, domain])`,
`onDelete: Cascade`) — `ADMIN`-користувач може мати 0+ рядків, тобто будь-яку комбінацію напрямків.
`isDomainAdmin`/`hasAnyAdminAccess` перевіряють `role === "ADMIN"` ПЕРЕД тим, як дивитись на
домени — рядки `UserAdminDomain` нічого не дають, поки роль не `ADMIN`. Понад це,
`updateUserRoleAction` (`src/lib/actions/users.ts`) явно **видаляє** всі `UserAdminDomain`-рядки
користувача, коли його понижують до `MEMBER` — не просто ігнорує їх: без цього стара доменна
прив'язка мовчки "оживала" б, якщо колись у майбутньому цю саму людину знову підвищать до `ADMIN`
з абсолютно іншого приводу, і той, хто підвищує, міг і не підозрювати, що вона раніше мала
TENNIS/COFFEE/PADEL. Відкликаний скоуп має лишатись відкликаним, поки хтось свідомо не призначить
його знову.

**Дата-міграція при переході на трирівневу модель** (одноразова, вже застосована):
```sql
UPDATE users SET role = 'SUPERADMIN' WHERE role = 'ADMIN';
UPDATE users SET role = 'ADMIN' WHERE role = 'MEMBER'
  AND id IN (SELECT DISTINCT "userId" FROM user_admin_domains);
```

## Сесія та права

`session()` callback (`src/lib/auth.ts`) довантажує `UserAdminDomain`-рядки користувача при кожному
`auth()`-виклику (той самий патерн, що вже використовує `Nav` для `getPlayerByUserId`) і кладе їх у
`session.user.domains: AdminDomain[]`.

`src/lib/permissions.ts` (назви `isAdmin`/`requireAdmin` лишились історичними, але тепер означають
СУПЕРАДМІНА конкретно, не просто "будь-якого адміна"):
- `isAdmin()` / `requireAdmin()` — `role === "SUPERADMIN"`. Керування ролями/доменами
  (`/admin/users`) і повний журнал (`/admin/audit`) лишаються суто суперадмінськими.
- `isDomainAdmin(domain)` / `requireDomainAdmin(domain)` — суперадмін АБО
  (`role === "ADMIN"` І `session.user.domains.includes(domain)`).
- `hasAnyAdminAccess()` — суперадмін АБО (`role === "ADMIN"` І хоч один домен) — поріг входу в
  `/admin` узагалі. `ADMIN` без жодного домену не проходить — бачить `/admin` так само, як звичайний
  `MEMBER` (редірект на `/`).
- `getAdminScope(session)` — синхронний хелпер, що зводить сесію до `{ isSuperAdmin, domains }`
  (домени порожні для будь-кого, крім `ADMIN`). Використовується в трьох місцях, яким потрібна
  саме ця пара значень (`AdminLayout`, `/admin`-огляд, `Nav`) — щоб їхня логіка не розходилась
  одна з одною при майбутніх змінах.

## Що є TENNIS-доменом сьогодні

Увесь наявний контент адмінки — тенісний: турніри, матчі, гравці, новини, фотозавантаження,
галерея турніру. Усі server actions у `src/lib/actions/{matches,news,photos,players,randomize-*,
teams,ties,tournaments}.ts` перевіряють `requireDomainAdmin("TENNIS")`, так само CSV-експорти
(`/admin/tournaments/export/**`) і presign-роути фото (`/api/photos/presign`,
`/api/news/photo-presign`). `users.ts` — виняток, лишається `requireAdmin()` (призначення прав —
суто суперадмінська дія).

**Гейтинг на рівні сторінок**, не тільки дій — інакше приховане в `AdminNav` посилання не захищає
від прямого переходу за URL:
- `/admin` (`layout.tsx`) — вхід дозволено кожному з `hasAnyAdminAccess()`.
- `/admin/tournaments`, `/admin/tournaments/new`, `/admin/tournaments/[id]`, `/admin/players`,
  `/admin/news` — кожна сторінка окремо перевіряє `isDomainAdmin("TENNIS")` і редіректить на
  `/admin`, якщо ні (не можна покладатись лише на спільний layout-гейт — він пропускає БУДЬ-якого
  домен-адміна, навіть не тенісного).
- `/admin/users`, `/admin/audit` — окремо перевіряють `isAdmin()` (суто суперадмін) і редіректять
  на `/admin`.
- `AdminNav` і `/admin` (огляд) фільтрують список посилань/карток за `isSuperAdmin`/`domains` —
  UX-рівень (не показувати те, куди все одно не пустять), не єдиний захист.
- `src/app/tournaments/[id]/page.tsx` і `src/app/gallery/[id]/page.tsx` — публічні сторінки, що
  показують адмін-кнопки (редагувати/скинути/фотозавантаження) власникам TENNIS-доступу через
  `isDomainAdmin("TENNIS")`.
- `src/components/nav.tsx` — пункт "Адмін-панель" і бейдж біля імені показуються за
  `hasAnyAdminAccess()`-еквівалентною логікою (суперадмін АБО `ADMIN` з хоч одним доменом), не за
  голою роллю — інакше домен-адмін без цього пункту меню не мав би як дістатись `/admin` узагалі.

## UI призначення прав

`/admin/users`:
- **Роль** (`UserRoleSelect`) — тепер трирівневий select `Суперадмін` / `Адмін` / `Учасник`.
  Підвищення до `SUPERADMIN` вимагає підтвердження (діалог із явним попередженням про повний
  доступ); `MEMBER ⇄ ADMIN` в обидва боки — без підтвердження, бо сам собою `ADMIN` без домену
  нічого не дає.
- **Адмін-розділи** (нова колонка) — для `SUPERADMIN` показує текст "Усі розділи", для `MEMBER` —
  прочерк (нема чого призначати, поки не підвищений до `ADMIN`), для `ADMIN` —
  `UserDomainsEditor` (`src/components/admin/user-domains-editor.tsx`): якщо доменів ще 0 —
  згорнуто в кнопку "Призначити розділ" (щоб порожні тогли не виглядали як "усім щось уже
  запропоновано"), клік розгортає 3 тогли Кава/Теніс/Падел. Кожен клік викликає server action
  `updateUserDomainsAction(userId, domains)` (`src/lib/actions/users.ts`, `requireAdmin()`,
  транзакція delete-all-then-createMany, `logAudit` з дією `"user.domains"`).

## Верифікація

Сторінки (`src/app/**/page.tsx`) у цьому проєкті не мають юніт-тестів взагалі (немає `tests/app/`)
— авторизаційні редіректи перевіряються через `e2e/admin-flows.spec.ts` (Playwright,
`/api/test-login`). Той роут тепер приймає опційні `role`/`domains` у тілі запиту (за замовчуванням
— `SUPERADMIN` без доменів, як і раніше) саме для того, щоб e2e-тести могли перемикати сесію
тестового користувача на вужчі рівні без прямого доступу до БД зі спека-файлу:
- **SUPERADMIN** (дефолт) — бачить і може все (`/admin/users`, `/admin/audit`,
  `/admin/tournaments`, повне меню `AdminNav`).
- **ADMIN + домен TENNIS** — `AdminNav` показує лише "Огляд/Гравці/Турніри/Новини"; `/admin/users`
  і `/admin/audit` редіректять на `/admin`; `/admin/tournaments` доступний; пункт "Адмін-панель" є
  в головному меню сайту.
- **ADMIN без жодного домену** — жодного доступу: `/admin` редіректить на `/`, пункту
  "Адмін-панель" у меню немає взагалі (як і в звичайного `MEMBER`).

Усі три сценарії — тепер реальні тести в `e2e/admin-flows.spec.ts`, не лише разова ручна
перевірка. (Дев-сервер після `npx prisma generate` для нового enum-значення треба перезапустити —
інакше Node-процес тримає в пам'яті старий Prisma Client і падає з `PrismaClientValidationError`.)

1094 юніт-тестів (+ `getAdminScope`, `isDomainAdmin`/`requireDomainAdmin`/`hasAnyAdminAccess`,
`UserRoleSelect`, `UserDomainsEditor`, `Nav`, `updateUserDomainsAction` включно з очищенням
доменів при пониженні) і `npm run build` проходять чисто.
