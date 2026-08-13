import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoLightbox } from "@/components/photo-lightbox";
import { deletePadelPhotoAction } from "@/lib/actions/padel-photos";
import { formatDateUTC } from "@/lib/date-format";
import { isDomainAdmin } from "@/lib/permissions";
import { getPhotosByPadelTournament } from "@/lib/queries/padel-photos";
import { getPadelTournamentById } from "@/lib/queries/padel-tournaments";

/** Padel twin of gallery/[id]/page.tsx. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getPadelTournamentById(id);
  return { title: tournament ? `Фото — ${tournament.name}` : "Фото" };
}

export default async function PadelTournamentGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tournament, photos, canManage] = await Promise.all([
    getPadelTournamentById(id),
    getPhotosByPadelTournament(id),
    isDomainAdmin("PADEL"),
  ]);
  if (!tournament) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/gallery" className="text-sm text-foreground/80 hover:text-foreground">
        ← Усі фото
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
          <p className="mt-1 text-sm text-foreground/80">
            {formatDateUTC(tournament.startDate)} – {formatDateUTC(tournament.endDate)}
          </p>
        </div>
        <Link
          href={`/padel/tournaments/${tournament.id}`}
          className="text-sm text-foreground/80 hover:text-foreground"
        >
          Перейти до турніру →
        </Link>
      </div>

      {photos.length > 0 ? (
        <PhotoLightbox photos={photos} canManage={canManage} deleteAction={deletePadelPhotoAction} />
      ) : (
        <p className="text-foreground/80">У цього турніру ще немає фото.</p>
      )}
    </div>
  );
}
