"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="uk">
      <head>
        {/*
          Same anti-flash script as layout.tsx - global-error replaces the
          whole <html> (this file's job), which also throws away the `dark`
          class that script normally sets before paint. Without it, the CSS
          below would have to guess the theme from prefers-color-scheme, but
          the rest of the app never does that (see theme-toggle.tsx: only an
          explicit stored choice ever sets `dark`, OS preference is never
          consulted) - so a user who picked dark on a light-OS device (or
          vice versa) would land on a crash screen in the wrong theme, right
          when the UI most needs to be legible.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('setclub:theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#0a0a0a",
        }}
      >
        <style>{`
          html.dark body { background: #0a0a0a !important; color: #fafafa !important; }
          html.dark button { background: #3f7a5c !important; color: #fafafa !important; }
        `}</style>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Щось пішло не так</h1>
        {/* #52525b, not the lighter #6b7280 used elsewhere for muted text - on white this
            is the one screen where ~7.8:1 contrast matters more than matching the app's usual
            (lighter, ~3.2:1) muted-text tone. Dark mode is unaffected: the `html.dark body`
            rule below already overrides this to #fafafa via `!important`. */}
        <p style={{ color: "#52525b" }}>Сталася неочікувана помилка. Спробуйте ще раз.</p>
        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => unstable_retry()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#3f7a5c",
              color: "#ffffff",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Спробувати ще раз
          </button>
          {/*
            Plain <a>, not next/link's Link: this file replaces the whole
            <html> outside the normal App Router tree, so Link's router
            context isn't available here. `color: inherit` + underline
            (rather than a solid button) means it needs no dark-mode CSS
            override of its own - it already tracks the `html.dark body`
            color rule above.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link needs App Router context, unavailable in this replaced-<html> boundary */}
          <a
            href="/"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid currentColor",
              color: "inherit",
              fontSize: "0.875rem",
              textDecoration: "none",
            }}
          >
            На головну
          </a>
        </div>
      </body>
    </html>
  );
}
