"use client";

import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { deletePhotoAction } from "@/lib/actions/photos";

export type GalleryPhoto = { id: string; url: string; caption: string | null };

export function PhotoLightbox({ photos, canManage }: { photos: GalleryPhoto[]; canManage: boolean }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = activeIndex !== null ? photos[activeIndex] : null;

  // ArrowLeft/ArrowRight - the idiomatic lightbox interaction, expected by
  // keyboard and mouse users alike, on top of the Prev/Next buttons (which
  // were already real, focusable <Button>s but had no arrow-key shortcut).
  // Bound at the document level (only while a photo is active) rather than
  // on a specific dialog element - Base UI's focus-trap target isn't a
  // stable thing to depend on, and a document-level listener still fires
  // regardless of which element inside the dialog currently has focus (e.g.
  // the delete button).
  useEffect(() => {
    if (activeIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (activeIndex === null) return;
      if (e.key === "ArrowLeft" && activeIndex > 0) {
        e.preventDefault();
        setActiveIndex(activeIndex - 1);
      } else if (e.key === "ArrowRight" && activeIndex < photos.length - 1) {
        e.preventDefault();
        setActiveIndex(activeIndex + 1);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, photos.length]);

  function handleDelete(photoId: string) {
    startTransition(async () => {
      const result = await deletePhotoAction(photoId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Фото видалено");
        setActiveIndex(null);
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted"
          >
            <Image
              src={photo.url}
              alt={photo.caption ?? "Фото турніру"}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              className="object-cover transition-transform hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(next) => !next && setActiveIndex(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 ring-0 sm:max-w-3xl" showCloseButton={false}>
          {active && (
            <div className="relative flex flex-col gap-2">
              {/* Deliberately a plain <img>, not next/image: this is the
                  full-quality original for viewing "без втрати якості" -
                  grid thumbnails above go through next/image optimization,
                  this view intentionally bypasses it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={active.caption ?? "Фото турніру"}
                className="max-h-[80vh] w-full rounded-lg bg-black/50 object-contain"
              />

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    disabled={activeIndex === 0}
                    onClick={() => setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  >
                    <ChevronLeftIcon />
                    <span className="sr-only">Попереднє фото</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    disabled={activeIndex === photos.length - 1}
                    onClick={() =>
                      setActiveIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i))
                    }
                  >
                    <ChevronRightIcon />
                    <span className="sr-only">Наступне фото</span>
                  </Button>
                </div>
                <div className="flex gap-1">
                  {canManage && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      disabled={isPending}
                      onClick={() => handleDelete(active.id)}
                    >
                      <Trash2Icon />
                      <span className="sr-only">Видалити фото</span>
                    </Button>
                  )}
                  <Button variant="secondary" size="icon-sm" onClick={() => setActiveIndex(null)}>
                    <XIcon />
                    <span className="sr-only">Закрити</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
