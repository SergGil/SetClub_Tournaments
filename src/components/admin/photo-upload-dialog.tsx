"use client";

import { ImagePlusIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { confirmPhotoUploadAction } from "@/lib/actions/photos";
import { ALLOWED_PHOTO_CONTENT_TYPES, MAX_PHOTO_BYTES } from "@/lib/validation/photo";

type UploadItem = {
  id: string;
  file: File;
  status: "uploading" | "done" | "error";
  error?: string;
};

async function uploadOne(tournamentId: string, file: File): Promise<{ error?: string }> {
  const presignRes = await fetch("/api/photos/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tournamentId,
      fileName: file.name,
      contentType: file.type,
      contentLength: file.size,
    }),
  });
  if (!presignRes.ok) {
    const body = (await presignRes.json().catch(() => null)) as { error?: string } | null;
    return { error: body?.error ?? "Не вдалося підготувати завантаження" };
  }
  const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

  const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!putRes.ok) {
    return { error: "Не вдалося завантажити файл у сховище" };
  }

  return confirmPhotoUploadAction(tournamentId, key);
}

export function PhotoUploadDialog({ tournamentId }: { tournamentId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const notifiedRef = useRef(false);
  const router = useRouter();

  const hasErrors = items.some((item) => item.status === "error");
  const allDone = items.length > 0 && items.every((item) => item.status !== "uploading");

  // Toast is an effect (imperative call into an external system), not
  // derived state - fires once per completed batch via notifiedRef, same
  // reasoning as the toast in reset-tournament-button.tsx.
  useEffect(() => {
    if (allDone && !hasErrors && !notifiedRef.current) {
      notifiedRef.current = true;
      toast.success(items.length === 1 ? "Фото завантажено" : `Завантажено фото: ${items.length}`);
    }
  }, [allDone, hasErrors, items.length]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const allowedTypes: readonly string[] = ALLOWED_PHOTO_CONTENT_TYPES;
    const toQueue: UploadItem[] = Array.from(fileList).map((file) => {
      if (!allowedTypes.includes(file.type)) {
        return { id: crypto.randomUUID(), file, status: "error", error: "Непідтримуваний формат файлу" };
      }
      if (file.size > MAX_PHOTO_BYTES) {
        return { id: crypto.randomUUID(), file, status: "error", error: "Файл завеликий (>20 МБ)" };
      }
      return { id: crypto.randomUUID(), file, status: "uploading" };
    });

    setItems((prev) => [...prev, ...toQueue]);
    if (inputRef.current) inputRef.current.value = "";

    const toUpload = toQueue.filter((item) => item.status === "uploading");
    if (toUpload.length === 0) return;

    startTransition(async () => {
      await Promise.all(
        toUpload.map(async (item) => {
          const result = await uploadOne(tournamentId, item.file);
          setItems((prev) =>
            prev.map((existing) =>
              existing.id === item.id
                ? result.error
                  ? { ...existing, status: "error", error: result.error }
                  : { ...existing, status: "done" }
                : existing,
            ),
          );
        }),
      );
      // One refresh for the whole batch, not one per photo: each confirmed
      // photo no longer revalidates this page itself (see the comment on
      // confirmPhotoUploadAction) specifically to avoid N successive
      // mid-upload re-renders flickering behind this still-open dialog.
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setItems([]);
          notifiedRef.current = false;
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <ImagePlusIcon /> Додати фото
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Додати фото турніру</DialogTitle>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          aria-label="Файли фото"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={isPending}
          onChange={(e) => handleFiles(e.target.files)}
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-sm file:font-medium"
        />

        {items.length > 0 && (
          <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{item.file.name}</span>
                {item.status === "uploading" && (
                  <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                {item.status === "done" && <span className="shrink-0 text-xs text-muted-foreground">Готово</span>}
                {item.status === "error" && (
                  <span className="shrink-0 text-xs text-destructive">{item.error}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Закрити
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
