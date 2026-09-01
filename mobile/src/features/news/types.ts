/** Mirrors getNewsPosts/getNewsPostById's include (src/lib/queries/news.ts). */
export type NewsPost = {
  id: string;
  title: string;
  body: string;
  photoKey: string | null;
  createdAt: string;
  author: { name: string | null; player: { name: string } | null };
};

/** newsPostFormSchema's shape (src/lib/validation/news.ts). */
export type NewsPostFormInput = { title: string; body: string };
