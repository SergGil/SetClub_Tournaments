import Image from "next/image";
import Link from "next/link";

import { formatDateKyiv } from "@/lib/date-format";
import { excerpt } from "@/lib/text-excerpt";

/** How many of the newest posts the homepage teaser shows - the rest are one click away on /news. */
export const HOME_NEWS_COUNT = 3;

export type HomeNewsPost = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  photoUrl: string | null;
};

/**
 * "Новини клубу" on the homepage, right above "Життя клубу": the newest
 * HOME_NEWS_COUNT posts as cards (each opens /news/[id]) and a button to the
 * full list. Same dark full-bleed band as HomeStats/HomeGallery around it.
 * Hidden entirely while there are no posts, like HomeGallery with no photos.
 */
export function HomeNews({ posts }: { posts: HomeNewsPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="home-news-heading" className="bg-neutral-950 px-8 py-16 text-white sm:px-14">
      <h2
        id="home-news-heading"
        className="mb-8 text-4xl font-extrabold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Новини клубу
      </h2>

      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
        {posts.map((post) => (
          // scroll-reveal per card, same progressive-enhancement fade as
          // HomeAbout's - the content is in the HTML either way.
          <Link
            key={post.id}
            href={`/news/${post.id}`}
            className="scroll-reveal group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/25"
          >
            {post.photoUrl && (
              <div className="relative aspect-video overflow-hidden">
                <Image
                  src={post.photoUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2.5 p-5">
              <time
                dateTime={post.createdAt.toISOString()}
                className="text-xs font-semibold tracking-[0.12em] text-white/45 uppercase"
              >
                {formatDateKyiv(post.createdAt)}
              </time>
              <h3 className="text-lg leading-snug font-bold transition-colors group-hover:text-home-accent">
                {post.title}
              </h3>
              <p className="line-clamp-3 text-sm leading-relaxed text-white/65">{excerpt(post.body, 200)}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <Link
          href="/news"
          className="inline-flex rounded-full border border-white/35 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:border-home-accent hover:bg-home-accent hover:text-home-accent-ink"
        >
          Усі новини
        </Link>
      </div>
    </section>
  );
}
