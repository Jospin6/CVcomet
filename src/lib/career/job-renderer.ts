import "server-only";
import { existsSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { JobScrapeError } from "./job-scrape-error";

export type JobWebResource = { status: number; headers: Record<string, string>; body: string };
type ResourceLoader = (_url: string, _headers: Record<string, string>, _signal: AbortSignal) => Promise<JobWebResource>;
const RENDER_TIMEOUT = 25_000;
const MAX_REQUESTS = 80;
const MAX_TOTAL_BYTES = 12_000_000;
let activeRenders = 0;

function browserExecutable() {
  const configured = process.env.JOB_BROWSER_EXECUTABLE_PATH?.trim();
  const executable = configured || [
    chromium.executablePath(),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find(existsSync);
  if (!executable || !existsSync(executable)) throw new JobScrapeError(503, "RENDER_UNAVAILABLE", "JavaScript page extraction needs Chromium installed on the server.");
  return executable;
}

export async function renderJobPage(url: string, loadResource: ResourceLoader, signal: AbortSignal) {
  if (activeRenders >= 2) throw new JobScrapeError(503, "RENDER_BUSY", "Job page extraction is busy. Please try again shortly.");
  activeRenders++;
  let browser: Browser | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: (() => void) | undefined;
  let stopped = false;
  let documentError: JobScrapeError | undefined;
  const controller = new AbortController();
  const renderSignal = AbortSignal.any([signal, controller.signal]);
  try {
    signal.throwIfAborted();
    browser = await chromium.launch({
      executablePath: browserExecutable(), headless: true, chromiumSandbox: true, timeout: 8_000,
      // Fail closed: only intercepted requests fulfilled by the validated,
      // DNS-pinned Node loader may reach the network. No direct browser traffic.
      proxy: { server: "http://127.0.0.1:9" },
      args: ["--proxy-bypass-list=<-loopback>", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"],
    });
    stop = () => { stopped = true; controller.abort(); void browser?.close().catch(() => {}); };
    signal.addEventListener("abort", stop, { once: true });
    timer = setTimeout(stop, RENDER_TIMEOUT);
    if (signal.aborted) { stop(); signal.throwIfAborted(); }
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false, permissions: [] });
    await context.routeWebSocket("**/*", socket => socket.close());
    const page = await context.newPage();
    context.on("page", popup => { if (popup !== page) void popup.close().catch(() => {}); });
    let count = 0, bytes = 0;
    await context.route("**/*", async route => {
      const request = route.request();
      const isDocument = request.isNavigationRequest() && request.frame() === page.mainFrame();
      try {
        if (stopped || !["GET", "HEAD"].includes(request.method()) ||
          !["document", "script", "stylesheet", "xhr", "fetch"].includes(request.resourceType()) ||
          request.resourceType() === "document" && !isDocument) {
          await route.abort(); return;
        }
        if (++count > MAX_REQUESTS) throw new JobScrapeError(413, "PAGE_TOO_LARGE", "The job page requested too many resources.");
        let redirects = 0;
        for (let previous = request.redirectedFrom(); previous; previous = previous.redirectedFrom()) redirects++;
        if (redirects > 4) throw new JobScrapeError(422, "TOO_MANY_REDIRECTS", "The job URL redirected too many times.");
        const resource = await loadResource(request.url(), request.headers(), renderSignal);
        if (stopped) { await route.abort(); return; }
        bytes += Buffer.byteLength(resource.body);
        if (bytes > MAX_TOTAL_BYTES) throw new JobScrapeError(413, "PAGE_TOO_LARGE", "The job page is too large.");
        if (isDocument && (resource.status === 401 || resource.status === 403 || resource.status === 429)) {
          throw new JobScrapeError(422, "BLOCKED_OR_UNAVAILABLE", "The job website requires sign-in or blocks automated access.");
        }
        await route.fulfill({ status: resource.status, headers: resource.headers, body: resource.body });
      } catch (error) {
        if (error instanceof JobScrapeError && (isDocument || error.code === "PAGE_TOO_LARGE")) documentError = error;
        await route.abort().catch(() => {});
      }
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: RENDER_TIMEOUT });
    // Wait for useful content to settle, rather than returning the loading shell
    // or waiting indefinitely for analytics/network activity to stop.
    await page.waitForFunction(() => {
      const text = (document.querySelector<HTMLElement>("main, article") || document.body)?.innerText.trim() || "";
      const state = window as typeof window & { __cvcometJobText?: { text: string; changed: number } };
      if (text.length < 180) return false;
      if (state.__cvcometJobText?.text !== text) { state.__cvcometJobText = { text, changed: performance.now() }; return false; }
      return performance.now() - state.__cvcometJobText.changed >= 800;
    }, undefined, { timeout: 18_000, polling: 200 });
    if (documentError) throw documentError;
    const html = await page.content();
    if (Buffer.byteLength(html) > 2_500_000) throw new JobScrapeError(413, "PAGE_TOO_LARGE", "The job page is too large.");
    return { url: page.url(), html };
  } catch (error) {
    if (documentError) throw documentError;
    if (error instanceof JobScrapeError) throw error;
    if (!browser) throw new JobScrapeError(503, "RENDER_UNAVAILABLE", "The JavaScript page reader could not start. Check the server's Chromium installation.");
    if (stopped || signal.aborted || error instanceof Error && error.name === "TimeoutError") {
      throw new JobScrapeError(422, "RENDER_TIMEOUT", "The job page did not finish loading. Please try again.");
    }
    throw new JobScrapeError(422, "CONTENT_NOT_ACCESSIBLE", "This job posting is not publicly readable. It may require sign-in or block automated access.");
  } finally {
    controller.abort();
    clearTimeout(timer);
    if (stop) signal.removeEventListener("abort", stop);
    await browser?.close().catch(() => {});
    activeRenders--;
  }
}
