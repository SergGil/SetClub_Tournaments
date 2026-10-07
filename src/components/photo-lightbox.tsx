"use client";

import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon, XIcon } from "lucide-react";
import Image, { getImageProps } from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type GalleryPhoto = { id: string; url: string; caption: string | null };

/** What the lightbox image is actually laid out at (DialogContent's max-w-3xl = 768px) - drives the `sizes` hint so the browser picks a ~1000-2000px variant, not the multi-MB original. */
const LIGHTBOX_SIZES = "(max-width: 768px) 100vw, 768px";

/**
 * Lightbox photo: the optimized (resized + re-encoded) variant, not the raw
 * R2 original. Phone originals are 3-8 MB each and r2.dev sends no
 * Cache-Control, so opening a photo meant downloading the whole file on every
 * view - the "very slow photos" complaint. The optimized variant is ~0.2-0.5 MB
 * and CDN-cached; the full original stays one click away ("Оригінал" link).
 * Keyed by photo id by the caller so `loaded` resets on every navigation.
 */
function LightboxImage({ photo }: { photo: GalleryPhoto }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative">
      {!loaded && <div className="absolute inset-0 min-h-48 animate-pulse rounded-lg bg-muted/60" aria-hidden />}
      {/* width/height 0 + auto sizing: the documented pattern for an
          optimized remote image of unknown dimensions - the browser lays it
          out by its natural aspect ratio, max-h/object-contain cap it. */}
      <Image
        src={photo.url}
        alt={photo.caption ?? "Фото турніру"}
        width={0}
        height={0}
        sizes={LIGHTBOX_SIZES}
        // max-h-[70vh], not 80vh: DialogContent's own cap is max-h-[85vh]
        // with overflow-y-auto - a portrait photo at 80vh left only ~5vh of
        // headroom for the control row below it (nav/delete/close buttons +
        // gap), not consistently enough on every viewport height. That made
        // the *whole* dialog (image and controls together) scrollable,
        // showing a real but unwanted scrollbar and pushing the close button
        // toward/past the fold. 70vh leaves comfortable margin so the
        // control row always fits without scrolling.
        className="h-auto max-h-[70vh] w-full rounded-lg bg-black/50 object-contain"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

export function PhotoLightbox({
  photos,
  canManage,
  deleteAction,
}: {
  photos: GalleryPhoto[];
  canManage: boolean;
  /** Sport-specific delete Server Action - deletePhotoAction for Tennis, deletePadelPhotoAction for Padel. */
  deleteAction: (photoId: string) => Promise<{ error?: string }>;
}) {
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

  // Warm the browser cache with the neighbouring photos' optimized variants
  // so Prev/Next feels instant. getImageProps yields the exact srcSet/src
  // next/image would render, so the browser fetches the same URL it will
  // later need (not a different size, which would be wasted bandwidth).
  useEffect(() => {
    if (activeIndex === null) return;
    for (const neighbour of [photos[activeIndex - 1], photos[activeIndex + 1]]) {
      if (!neighbour) continue;
      const { props } = getImageProps({
        src: neighbour.url,
        alt: "",
        width: 0,
        height: 0,
        sizes: LIGHTBOX_SIZES,
      });
      const preloader = new window.Image();
      preloader.sizes = LIGHTBOX_SIZES;
      if (props.srcSet) preloader.srcset = props.srcSet;
      preloader.src = props.src;
    }
  }, [activeIndex, photos]);

  function handleDelete(photoId: string) {
    startTransition(async () => {
      const result = await deleteAction(photoId);
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
              // First two rows (2 columns on phones) are above the fold:
              // next/image's default lazy loading delayed the page's largest
              // paint (Next flags it as the LCP in dev). The rest stay lazy.
              loading={index < 4 ? "eager" : "lazy"}
              className="object-cover transition-transform hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(next) => !next && setActiveIndex(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 ring-0 sm:max-w-3xl" showCloseButton={false}>
          {active && (
            <div className="relative flex flex-col gap-2">
              <LightboxImage key={active.id} photo={active} />

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="size-11"
                    disabled={activeIndex === 0}
                    onClick={() => setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  >
                    <ChevronLeftIcon />
                    <span className="sr-only">Попереднє фото</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="size-11"
                    disabled={activeIndex === photos.length - 1}
                    onClick={() =>
                      setActiveIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i))
                    }
                  >
                    <ChevronRightIcon />
                    <span className="sr-only">Наступне фото</span>
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
                  >
                    Оригінал ↗
                  </a>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={<Button variant="destructive" size="icon" className="size-11" disabled={isPending} />}
                      >
                        <Trash2Icon />
                        <span className="sr-only">Видалити фото</span>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Видалити фото?</AlertDialogTitle>
                          <AlertDialogDescription>Цю дію не можна скасувати.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Скасувати</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => handleDelete(active.id)}
                          >
                            {isPending ? "Видалення…" : "Видалити"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button variant="secondary" size="icon" className="size-11" onClick={() => setActiveIndex(null)}>
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
