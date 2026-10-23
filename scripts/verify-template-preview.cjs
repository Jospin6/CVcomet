// Renders the real gallery and preview in Chromium without accounts, AI or database writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("esbuild");
const { chromium } = require("playwright");
const postcss = require("postcss");
const root = path.resolve(__dirname, "..");

async function main() {
  const bundle = await build({
    absWorkingDir: root, bundle: true, write: false, format: "iife", platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' }, loader: { ".css": "empty" },
    stdin: { resolveDir: root, loader: "tsx", contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import i18n from 'i18next';
      import { initReactI18next } from 'react-i18next';
      import { TemplateGallery } from './src/components/templates/template-gallery';
      import { TemplatePreview } from './src/components/templates/template-preview';
      import { templateCatalog } from './src/lib/template-catalog';
      i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: { shell: { close: 'Close' } } } } });
      const root = createRoot(document.getElementById('root'));
      window.catalog = templateCatalog;
      window.showTemplate = id => root.render(<div style={{width:900}}><TemplatePreview key={id} template={templateCatalog.find(t => t.id === id)} large /></div>);
      root.render(<TemplateGallery />);
    ` },
    plugins: [{ name: "local-router", setup(b) {
      b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const useRouter = () => ({ push: url => { window.lastNavigation = url; } });" }));
    } }],
  });
  const globalFile = path.join(root, "src/app/globals.css");
  const css = await postcss([require("@tailwindcss/postcss")()]).process(fs.readFileSync(globalFile, "utf8"), { from: globalFile });
  const documentCss = ["src/components/resumes/resume-editor.css", "src/components/templates/template-preview.css"].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: '<html><body style="margin:0;padding:24px"><div id="root"></div></body></html>' }));
    await page.goto("http://template-preview.local");
    await page.addStyleTag({ content: css.css + "\n" + documentCss });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.locator('[data-field="contact.name"]').first().filter({ hasText: "John Doe" }).waitFor();
    await page.getByRole("button", { name: /Executive Classic 1/ }).click();
    const modal = page.getByRole("dialog");
    await modal.waitFor();
    assert.ok((await modal.boundingBox()).width > 1100, "Modal must use desktop width");
    assert.ok((await modal.locator("[data-resume-page]").first().boundingBox()).width > 700, "Document is readable at desktop scale");
    assert.ok((await modal.innerText()).includes("John Doe"));
    await modal.getByRole("button", { name: "100%", exact: true }).click();
    assert.ok(Math.abs((await modal.locator("[data-resume-page]").first().boundingBox()).width - 794) < 2);
    const output = path.join(root, "docs/resume-editor/template-previews");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "cv-modal.png") });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Cover letters 30/ }).click();
    await page.getByRole("button", { name: /Executive Classic Letter/ }).click();
    assert.equal(await modal.locator(".template-letter-body i, .template-letter-document i").count(), 0);
    assert.ok((await modal.innerText()).includes("Thank you for considering my application"));
    assert.ok((await modal.innerText()).includes("Yours sincerely,"));
    await page.screenshot({ path: path.join(output, "letter-modal.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await modal.getByRole("button", { name: "Fit", exact: true }).click();
    await page.waitForTimeout(150);
    assert.ok((await modal.boundingBox()).width <= 390);
    assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Mobile modal has no horizontal overflow");
    await modal.getByRole("button", { name: "100%", exact: true }).click();
    assert.ok(await modal.locator(".template-preview-viewport").evaluate(el => el.scrollWidth > el.clientWidth), "Mobile full-size preview scrolls within its viewport");
    await page.screenshot({ path: path.join(output, "mobile-letter.png") });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const catalog = await page.evaluate(() => window.catalog.map(t => ({ id: t.id, type: t.type })));
    for (const template of catalog) {
      await page.evaluate(id => window.showTemplate(id), template.id);
      await page.waitForFunction(() => document.querySelector(".template-document-preview.is-large"));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const result = await page.locator(".template-preview-document").evaluate(el => {
        const pages = [...el.querySelectorAll("[data-resume-page]")];
        return {
          text: (pages.length ? pages.map(p => p.innerText).join(" ") : el.innerText),
          clipped: pages.some(p => {
            const bottom = Math.max(...[...p.querySelectorAll(".resume-paper-main,.resume-paper-side")].map(c => c.getBoundingClientRect().bottom));
            return bottom > p.querySelector("footer").getBoundingClientRect().top;
          }),
          horizontal: [...el.querySelectorAll("[data-resume-page],.template-letter-document")].some(p => p.scrollWidth > p.clientWidth + 1),
        };
      });
      assert.ok(result.text.includes("John Doe"), template.id);
      assert.ok(result.text.length > 1500, "Full sample content: " + template.id);
      assert.equal(result.clipped, false, "No overlap with footer: " + template.id);
      assert.equal(result.horizontal, false, "No text overflowing page: " + template.id);
      if (template.type === "CV") for (const section of ["Education", "Skills", "Certifications", "Languages"]) assert.ok(result.text.includes(section), template.id + " " + section);
    }
    assert.deepEqual(errors, []);
    console.log(`Verified ${catalog.length} complete previews, desktop modal, zoom, mobile scrolling and no runtime errors. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
