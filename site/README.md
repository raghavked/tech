# site

The public landing page for Henosis: one self-contained HTML file, light and dark, 390 px to 1440 px, no build step.

Serve it with any static host (`npx serve site`) or open `index.html` directly. On Vercel it is the root of the one deployment that also carries the app at `/app/` and the server as a function (`scripts/vercel-build.sh`, docs/20_hosting.md); its links to the app are `/app/`.
