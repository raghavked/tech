// Screenshot a static HTML file. Usage (from /home/user/tech/apps/web):
//   PW_CHROMIUM=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) node shoot.design.mjs <file.html> <out.png> [width] [height] [light|dark] [full]
import { chromium } from "@playwright/test";

const [file, out, w = "1440", h = "900", theme = "light", full = ""] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const p = await b.newPage({
  viewport: { width: Number(w), height: Number(h) },
  colorScheme: theme === "dark" ? "dark" : "light",
});
await p.goto(`file://${file}`);
await p.evaluate((t) => {
  document.documentElement.dataset.theme = t;
}, theme);
await p.waitForTimeout(600);
await p.screenshot({ path: out, fullPage: full === "full" });
await b.close();
console.log(out);
