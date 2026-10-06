The app icon is the Henosis mark from `design/favicon.svg` (`icon.svg` here is a copy).

`npm run icons` (`scripts/make-icons.mjs`, Node only) draws `icon.png`, `32x32.png`,
`128x128.png`, `128x128@2x.png`, `icon.ico` and `icon.icns` from that geometry; they are
committed so `cargo check`, `tauri dev` and `tauri build` work on a fresh clone.

`npm run icons:full` (`tauri icon`) writes the fuller platform set, including the Windows
Store and iOS sizes, over these; those extra files are ignored by git.

The tray icon is not a file: `main.rs` draws it (a monochrome sheet with a folded corner, and
a dot when something awaits you) so macOS can treat it as a template image.
