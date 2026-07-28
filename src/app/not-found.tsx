import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Сторінку не знайдено</h1>
      <p className="text-muted-foreground">
        Можливо, її видалили або посилання застаріло.
      </p>
      <Button render={<Link href="/" />} className="mt-2">
        На головну
      </Button>
    </div>
  );
}
