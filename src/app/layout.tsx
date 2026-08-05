import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { Nav } from "@/components/nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Toaster } from "@/components/ui/sonner";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  appleWebApp: {
    title: SITE_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // A single static value left the status bar/PWA splash green regardless of
  // theme - #0a0a0a matches globals.css's dark `--background` (and what
  // global-error.tsx already hardcodes for the same reason), so a dark-OS
  // visitor's chrome no longer clashes with the near-black page underneath.
  // This tracks OS preference, not the in-page manual toggle (setclub:theme
  // in localStorage) - the browser evaluates this meta tag on its own before
  // any app JS runs, so it can't follow a stored, JS-only preference.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3f7a5c" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="bg-photo-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem('setclub:bg-photo')==='1')document.documentElement.classList.add('bg-photo')}catch(e){}`}
        </Script>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem('setclub:theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`}
        </Script>
        <PullToRefresh />
        <Nav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t py-6 text-center text-sm text-foreground">
          {SITE_NAME} © {new Date().getFullYear()}
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
