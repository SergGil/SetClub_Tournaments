import { ConstructionIcon } from "lucide-react";

export const metadata = { title: "Рейтинг" };

export default function RatingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Рейтинг</h1>
        <p className="text-sm text-foreground/80">Індивідуальний рейтинг гравців клубу.</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <ConstructionIcon className="size-8 text-muted-foreground" />
        <p className="font-medium">Сторінка в розробці</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Ще потрібно продумати систему нарахування рейтингу — окремо для одиночних та парних
          матчів.
        </p>
      </div>
    </div>
  );
}
