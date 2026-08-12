import { Coffee } from "lucide-react";

export const metadata = { title: "Кав'ярня" };

export default function CoffeePage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Coffee className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold tracking-tight">Кав&apos;ярня</h1>
      <p className="max-w-md text-foreground/80">
        Затишна кав&apos;ярня клубу вже готується — меню, новини й фото з&apos;являться тут
        найближчим часом.
      </p>
    </div>
  );
}
