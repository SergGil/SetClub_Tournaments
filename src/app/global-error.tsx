"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="uk">
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
          @media (prefers-color-scheme: dark) {
            body { background: #0a0a0a !important; color: #fafafa !important; }
            button { background: #3f7a5c !important; color: #fafafa !important; }
          }
        `}</style>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Щось пішло не так</h1>
        <p style={{ color: "#6b7280" }}>Сталася неочікувана помилка. Спробуйте ще раз.</p>
        <button
          onClick={() => unstable_retry()}
          style={{
            marginTop: "0.5rem",
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
      </body>
    </html>
  );
}
