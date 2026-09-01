/** Mirrors getNewsPosts/getNewsPostById's include (src/lib/queries/news.ts), plus the server-computed photoUrl (see GET /api/v1/news). */
export type NewsPost = {
  id: string;
  title: string;
  body: string;
  photoKey: string | null;
  photoUrl: string | null;
  createdAt: string;
  author: { name: string | null; player: { name: string } | null };
};

/** newsPostFormSchema's shape (src/lib/validation/news.ts). */
export type NewsPostFormInput = { title: string; body: string };

/** What NewsForm actually submits - photoKey/removePhoto are read directly from the request body server-side, alongside (not part of) newsPostFormSchema - see POST/PATCH /api/v1/news. */
export type NewsPostSubmitInput = NewsPostFormInput & { photoKey?: string | null; removePhoto?: boolean };
