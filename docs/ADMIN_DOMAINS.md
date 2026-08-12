# Домен-скоуповані адмін-права: суперадмін + Кава/Теніс/Падел

## Контекст

Клуб розширюється на три напрямки (Теніс/Кава/Падел). Поточна модель прав була плоскою
(`Role: ADMIN | MEMBER`) — тепер додано окремі скоуповані ролі: "Адмін кав'ярні", "Адмін тенісу",
"Адмін паделу", з можливістю поєднувати кілька одразу. Суперадмін (`Role.ADMIN`, як і раніше)
має повний доступ всюди незалежно від цих ролей.

Кава і Падел поки не мають контенту для адміністрування (Кава — заглушка `/coffee`, Падел — без
сторінки взагалі), тому зараз додано **тільки права доступу** (модель даних + призначення через
`/admin/users`), без нових `/admin/coffee` чи `/admin/padel` сторінок — коли з'явиться реальний
контент цих напрямків, права під нього вже готові.

## Модель даних

Новий enum `AdminDomain { TENNIS, COFFEE, PADEL }` і join-модель `UserAdminDomain` (userId, domain,
`@@unique([userId, domain])`, `onDelete: Cascade`) — користувач може мати 0+ рядків, тобто будь-яку
комбінацію напрямків. `Role.ADMIN` лишається без змін і завжди означає повний доступ незалежно від
рядків `UserAdminDomain`. `MEMBER` без жодного домену = без доступу до `/admin` взагалі (як і
раніше).

## Сесія та права

`session()` callback (`src/lib/auth.ts`) довантажує `UserAdminDomain`-рядки користувача при кожному
`auth()`-виклику (той самий патерн, що вже використовує `Nav` для `getPlayerByUserId`) і кладе їх у
`session.user.domains: AdminDomain[]`.

`src/lib/permissions.ts`:
- `isAdmin()` / `requireAdmin()` — без змін, суперадмін-only (керування ролями/доменами, повний
  журнал аудиту).
- `isDomainAdmin(domain)` / `requireDomainAdmin(domain)` — суперадмін АБО
  `session.user.domains.includes(domain)`.
- `hasAnyAdminAccess()` — суперадмін АБО хоч один домен — поріг входу в `/admin` узагалі.

## Що є TENNIS-доменом сьогодні

Увесь наявний контент адмінки — тенісний: турніри, матчі, гравці, новини, фотозавантаження. Усі
server actions у `src/lib/actions/{matches,news,photos,players,randomize-*,teams,ties,
tournaments}.ts` перевіряють `requireDomainAdmin("TENNIS")` (раніше — `requireAdmin()`), так само
CSV-експорти (`/admin/tournaments/export/**`) і presign-роути фото
(`/api/photos/presign`, `/api/news/photo-presign`). `users.ts` — виняток, лишається
`requireAdmin()` (призначення прав — суто суперадмінська дія).

**Гейтинг на рівні сторінок**, не тільки дій — інакше приховане в `AdminNav` посилання не
захищає від прямого переходу за URL:
- `/admin` (`layout.tsx`) — вхід дозволено кожному з `hasAnyAdminAccess()`.
- `/admin/tournaments`, `/admin/tournaments/new`, `/admin/tournaments/[id]`, `/admin/players`,
  `/admin/news` — кожна сторінка окремо перевіряє `isDomainAdmin("TENNIS")` і редіректить на
  `/admin`, якщо ні (не можна покластись лише на спільний layout-гейт, бо він пропускає БУДЬ-якого
  домен-адміна, навіть не тенісного).
- `/admin/users`, `/admin/audit` — окремо перевіряють `isAdmin()` (суто суперадмін) і редіректять
  на `/admin`.
- `AdminNav` і `/admin` (огляд) фільтрують список посилань/карток за `isSuperAdmin`/`domains` —
  UX-рівень (не показувати те, куди все одно не пустять), не єдиний захист.
- `src/app/tournaments/[id]/page.tsx` — публічна сторінка турніру, що показує адмін-кнопки
  (редагувати/скинути/фотозавантаження) власникам TENNIS-доступу — раніше це був
  `session.user.role === "ADMIN"`, тепер `isDomainAdmin("TENNIS")`.

## UI призначення доменів

`/admin/users` — нова колонка "Адмін-розділи" поруч з існуючим вибором ролі: для суперадмінів —
текст "Усі розділи", для інших — `UserDomainsEditor` (`src/components/admin/user-domains-editor.tsx`,
3 тогл-кнопки Кава/Теніс/Падел). Кожен клік викликає новий server action
`updateUserDomainsAction(userId, domains)` (`src/lib/actions/users.ts`, `requireAdmin()`,
транзакція delete-all-then-createMany, `logAudit` з дією `"user.domains"` — той самий патерн, що
вже є в `updateUserRoleAction`).

## Верифікація

Ручна перевірка через `/api/test-login` (E2E-логін, лише dev/test) + прямі SQL-зміни ролі/доменів
фіксованого тестового користувача між перевірками — підтверджено: суперадмін бачить і може все;
TENNIS-домен-адмін бачить і може тенісні розділи, але `/admin/users` і `/admin/audit`
редіректять його назад; COFFEE-домен-адмін заходить у `/admin` (тільки "Огляд"), але і
`/admin/tournaments` за прямим URL, і `/admin/users`/`/admin/audit` — редірект; MEMBER без жодного
домену не потрапляє в `/admin` узагалі. 1069 юніт-тестів (+ нові для
`isDomainAdmin`/`requireDomainAdmin`/`hasAnyAdminAccess` і фільтрації `AdminNav`) і `npm run build`
проходять чисто.
