import type { GalleryPhoto } from "@/components/photo-lightbox";
import { prisma } from "@/lib/db";
import { publicPhotoUrl } from "@/lib/r2";

/** Curated homepage "Життя клубу" photos, newest first - see HomeGalleryPhoto in schema.prisma. */
export async function getHomeGalleryPhotos(): Promise<GalleryPhoto[]> {
  const photos = await prisma.homeGalleryPhoto.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, key: true, caption: true },
  });

  return photos.map((photo) => ({
    id: photo.id,
    url: publicPhotoUrl(photo.key),
    caption: photo.caption,
  }));
}
