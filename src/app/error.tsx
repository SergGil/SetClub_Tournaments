"use client";

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
      <Button onClick={() => unstable_retry()} className="mt-2">
        Спробувати ще раз
      </Button>
    </div>
  );
}
