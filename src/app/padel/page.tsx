import { HardHat } from "lucide-react";

export const metadata = { title: "Падел" };

// Немає публічного посилання на /padel будь-де на сайті (триплспліт-панель
// на головній - навмисно без <Link>, див. triple-split.tsx) - секція під
// розробкою, доступ до nav-пункту/тумблера фону обмежений isSuperAdmin/
// isDomainAdmin("PADEL") у nav.tsx. Пряме відвідування URL показує той самий
// плейсхолдер незалежно від прав - контенту, який справді потребував би
// приховування, тут поки немає.
export default function PadelPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <HardHat className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold tracking-tight">Падел</h1>
      <p className="max-w-md text-foreground/80">
        Секція клубу для падел-тенісу вже готується — корти, тренери й розклад з&apos;являться тут
        після відкриття.
      </p>
    </div>
  );
}
