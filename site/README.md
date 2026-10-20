# site

The public landing page: `index.html`, one self-contained file. No build step, no dependencies,
no network requests: the tokens from `design/tokens.css` are copied inline, the mark from
`design/mark.svg` is inline SVG, the fonts are the system's (the app's Instrument Serif, Instrument
Sans and JetBrains Mono are not loaded here), and the only JavaScript is the theme toggle.

## Serve it

Open the file directly:

```bash
xdg-open site/index.html        # Linux
open site/index.html            # macOS
```

or serve the folder with anything static:

```bash
python3 -m http.server 8080 --directory site     # http://localhost:8080
npx serve site
```

Deploying is copying `site/` to any static host; there is nothing to compile.

## What is in it

- Hero: "One team, people and agents", the mark closing its arcs once on load (the swing is under
  the one motion guard, so `prefers-reduced-motion: reduce` shows the closed ring at rest), and the
  joining line under it.
- Three sections: the session everyone can drop into; the council, a team's models deliberating
  (`docs/19_council.md`); plan first, rate, then ship.
- The editions row: Starter, Team, Enterprise, from `docs/18_editions.md`.
- A footer with the GitHub link placeholder.

Light and dark both work: the dark tokens follow the system (`prefers-color-scheme`) and the toggle
sets `data-theme` on `<html>` and remembers the choice in `localStorage`. The layout holds from
390 px to 1440 px.

## Editing

- Colour and type values are the design system's (`design/henosis/SYSTEM.md`); change them in
  `design/tokens.css` first and copy the value here, so the page and the app agree.
- The GitHub link is a placeholder: search for `href="#github"` (two places, the nav and the footer)
  and set the repository URL when it is public.
- Screenshots: from `apps/web`,
  `PW_CHROMIUM=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) node shoot.design.mjs $PWD/../../site/index.html out.png 1440 900 light full`
  (and `dark`, `390 844`).

## Hosted

On Vercel this page is the root of the one deployment that also carries the app at `/app/` and the server as a function (`scripts/vercel-build.sh`, docs/20_hosting.md); its links to the app are `/app/`.
