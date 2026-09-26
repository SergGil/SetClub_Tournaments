import Image from "next/image";
import Link from "next/link";

import type { GalleryPhoto } from "@/components/photo-lightbox";
import type { GalleryTournamentCard } from "@/lib/queries/photos";
import { publicPhotoUrl } from "@/lib/r2";

// Curated HomeGalleryPhoto rows (admin-uploaded via /admin/home, see
// docs/CHANGELOG.md) take priority; the tournament-cover teaser is only a
// fallback for while none have been curated yet, so the section isn't empty
// on a fresh club with no /admin/home uploads.
export function HomeGallery({
  curatedPhotos,
  tournaments,
}: {
  curatedPhotos: GalleryPhoto[];
  tournaments: GalleryTournamentCard[];
}) {
  if (curatedPhotos.length === 0 && tournaments.length === 0) return null;

  return (
    <div className="bg-neutral-950 px-8 py-16 text-white sm:px-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-4xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          Життя клубу
        </h2>
        <Link href="/gallery" className="text-sm font-semibold text-home-accent hover:underline">
          Усі фото →
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
        {curatedPhotos.length > 0
          ? curatedPhotos.map((photo) => (
              <Link key={photo.id} href="/gallery" className="group flex flex-col gap-3">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image
                    src={photo.url}
                    alt={photo.caption ?? "Життя клубу"}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
                  />
                </div>
                {photo.caption && (
                  <div className="translate-y-1 text-[15px] font-semibold opacity-70 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    {photo.caption}
                  </div>
                )}
              </Link>
            ))
          : tournaments.map((t) => (
              <Link
                key={`${t.sport}-${t.id}`}
                href={t.sport === "TENNIS" ? `/gallery/${t.id}` : `/gallery/padel/${t.id}`}
                className="group flex flex-col gap-3"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image
                    src={publicPhotoUrl(t.coverKey)}
                    alt={t.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
                  />
                </div>
                <div className="flex translate-y-1 flex-col gap-0.5 opacity-70 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="text-[15px] font-semibold">{t.name}</div>
                  <div className="text-xs text-white/50">{t.sport === "TENNIS" ? "Теніс" : "Падел"}</div>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}
