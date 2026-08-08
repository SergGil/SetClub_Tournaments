import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateUTC } from "@/lib/date-format";
import { countLabel, PHOTO_FORMS } from "@/lib/pluralize";
import { getTournamentsWithPhotos } from "@/lib/queries/photos";
import { publicPhotoUrl } from "@/lib/r2";

export const metadata = { title: "Фото" };

export default async function GalleryPage() {
  const tournaments = await getTournamentsWithPhotos();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Фото</h1>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/gallery/${t.id}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <div className="relative aspect-video">
                <Image
                  src={publicPhotoUrl(t.photos[0].key)}
                  alt={t.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p>
                  {formatDateUTC(t.startDate)} – {formatDateUTC(t.endDate)}
                </p>
                <p>{countLabel(t._count.photos, PHOTO_FORMS)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {tournaments.length === 0 && (
          <p className="text-foreground/80">Ще немає фото жодного турніру.</p>
        )}
      </div>
    </div>
  );
}
