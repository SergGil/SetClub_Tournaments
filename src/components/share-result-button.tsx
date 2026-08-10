"use client";

import { DownloadIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
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

// Whether this browser can share a file via navigator.share - never changes
// during a page's lifetime, so a no-op subscribe (nothing to notify on) is
// correct here. Read through useSyncExternalStore rather than a
// useEffect+useState pair so the server's "unsupported" render and the
// client's first render agree without a second, cascading render (same
// hydration-safety concern as src/components/theme-toggle.tsx's
// getServerSnapshot, and required by this repo's react-hooks/set-state-in-effect
// lint rule, which flags setState-in-effect directly).
function subscribeNever() {
  return () => {};
}

function getServerCanShareFilesSnapshot() {
  return false;
}

function getCanShareFilesSnapshot(): boolean {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    // The probe file's name/content don't matter - only whether this browser
    // supports sharing files of this MIME type at all.
    return navigator.canShare({ files: [new File([], "share.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

async function fetchImageFile(imageUrl: string, fileName: string): Promise<File> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Не вдалося завантажити зображення");
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

/**
 * "Поділитися" button for a completed match or a decided tournament podium -
 * opens a dialog previewing the share-card PNG (generated server-side by
 * src/app/api/share/match/[id]/route.tsx or .../tournament/[id]/route.tsx),
 * with "Завантажити" (always available) and "Поділитися…" (Web Share API,
 * mobile browsers with file-sharing support only) actions. First download/
 * share integration in the app - no existing pattern to lean on beyond the
 * ObjectURL revoke discipline already established in
 * src/components/admin/news-photo-field.tsx (revoke right after use, not on
 * a later render, so nothing leaks even if the user never reopens the dialog).
 */
export function ShareResultButton({
  imageUrl,
  fileName,
  title,
}: {
  imageUrl: string;
  fileName: string;
  title: string;
}) {
  const [pending, setPending] = useState<"download" | "share" | null>(null);
  const canShareFiles = useSyncExternalStore(
    subscribeNever,
    getCanShareFilesSnapshot,
    getServerCanShareFilesSnapshot,
  );

  async function handleDownload() {
    setPending("download");
    try {
      const file = await fetchImageFile(imageUrl, fileName);
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Не вдалося завантажити картку");
    } finally {
      setPending(null);
    }
  }

  async function handleShare() {
    setPending("share");
    try {
      const file = await fetchImageFile(imageUrl, fileName);
      await navigator.share({ files: [file], title });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Не вдалося поділитися карткою");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Поділитися" title="Поділитися" />}
      >
        <Share2Icon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element -- server-generated PNG, not an optimizable next/image asset */}
        <img src={imageUrl} alt={title} className="w-full rounded-lg border" />
        <DialogFooter>
          <Button variant="outline" disabled={pending !== null} onClick={handleDownload}>
            {pending === "download" ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            Завантажити
          </Button>
          {canShareFiles && (
            <Button disabled={pending !== null} onClick={handleShare}>
              {pending === "share" ? <Loader2Icon className="animate-spin" /> : <Share2Icon />}
              Поділитися…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
