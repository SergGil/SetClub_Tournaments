# Self-hosted fonts

Loaded through `next/font/local` (src/app/layout.tsx, src/app/coffee/page.tsx) instead of
`next/font/google`, so `next build` never has to download anything: Turbopack's Google Fonts fetch
intermittently failed on CI ("next/font/google queries have exactly one entry") and failed the whole
build. See docs/CHANGELOG.md (2026-10-08).

Each file is the family's full font from the google/fonts repository, subset with fonttools
(`pyftsubset --layout-features='*' --flavor=woff2`) to Basic Latin + Latin-1 + common typographic
punctuation, plus Cyrillic (U+0400-045F, U+0490-0491, U+04B0-04B1, U+0301, U+2116) for every family
except Geist Mono (Latin only, as before). Variable fonts keep their `wght` axis.

| File | Family | Notes |
| --- | --- | --- |
| geist-latin-cyrillic.woff2 | Geist | variable, wght 100-900 |
| geist-mono-latin.woff2 | Geist Mono | variable, wght 100-900 |
| wix-madefor-display-latin-cyrillic.woff2 | Wix Madefor Display | variable, wght 400-800 |
| playfair-display-latin-cyrillic.woff2 | Playfair Display | variable, wght 400-900 |
| pt-serif-{400,700}-{normal,italic}.woff2 | PT Serif | static |

All are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org), which allows
bundling and redistribution with the app.

To add a glyph range, re-subset from the original font (don't edit these files) with the same
command and a wider `--unicodes`.
