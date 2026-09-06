# about

## Purpose

The public "Why Merqo" page. Under `(public)` so it inherits the route
group's own `Nav`/`SiteFooter`/`BackToTop` chrome and auth-aware session
check from `layout.tsx` — this page itself needs no session logic of its
own.

## Contents

- `page.tsx` — `AboutPage`. Renders `@merqo/ui`'s shared `AboutMerqo`
  component (`kitName="stockkit"`, so its closing line names this kit),
  the same origin-story content every kit's own `/about` page and
  merqo's own `/about` render from one source. Supplies a "See stockkit"
  CTA as `AboutMerqo`'s `children` — the component has no Button/Link
  dependency of its own.
- `page.dom.test.tsx` — covers the origin-story copy, the kit-name line,
  and the CTA link's href.

## Parent

[(public)](../README.md)
