import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto("http://localhost:8000/", { waitUntil: "load" });
await page.waitForTimeout(3000); // Three vom CDN + GLB-Assets + Loader
await page.screenshot({ path: "/tmp/shot_menu.png" });

// Spiel starten und ein paar Wellen-Sekunden abwarten.
await page.click("#start-btn").catch(() => {});
await page.waitForTimeout(6000);
await page.screenshot({ path: "/tmp/shot_play.png" });

// Nochmal etwas später (mehr Gegner / Action).
await page.waitForTimeout(5000);
await page.screenshot({ path: "/tmp/shot_play2.png" });

console.log("ERRORS:\n" + (errors.length ? errors.slice(0, 25).join("\n") : "(keine)"));
await browser.close();
