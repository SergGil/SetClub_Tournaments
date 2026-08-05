"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Щось пішло не так</h1>
      <p className="text-foreground/80">
        Сталася неочікувана помилка. Спробуйте ще раз.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button onClick={() => unstable_retry()}>Спробувати ще раз</Button>
        <Button variant="outline" render={<Link href="/" />}>
          На головну
        </Button>
      </div>
    </div>
  );
}
