const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const content = JSON.parse(fs.readFileSync(path.join(root, "data/research.json"), "utf8"));
const stocks = JSON.parse(fs.readFileSync(path.join(root, "data/stocks.json"), "utf8"));
const artifacts = process.env.TEST_ARTIFACTS || path.join(os.tmpdir(), "lemon-research-tests");
const errors = [];
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + (requested === "/" ? "/index.html" : requested));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, buffer) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" }).end(buffer);
  });
});

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ headless: true });
  try {
    async function newPage(options = {}) {
      const context = await browser.newContext({ viewport: options.viewport || { width: 1440, height: 1000 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("pageerror", (error) => { errors.push(error.message); console.error("PAGE ERROR: " + error.message); });
      await page.clock.install({ time: new Date("2026-11-16T15:30:00Z") });
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin) {
          if (url.pathname === "/data/research.json" && options.failIndex) return route.fulfill({ status: 503, body: "Unavailable" });
          if (url.pathname === "/data/stocks.json" && options.failSnapshot) return route.fulfill({ status: 503, body: "Unavailable" });
          return route.continue();
        }
        if (url.hostname === "lemon-quota-proxy.charlesdataaws.workers.dev") {
          if (options.failQuote) return route.fulfill({ status: 503, body: "Unavailable" });
          const symbol = url.searchParams.get("symbols");
          if (options.quoteDelay) await new Promise((resolve) => setTimeout(resolve, options.quoteDelay(symbol)));
          return route.fulfill({ json: { updatedAt: "2026-11-16T15:31:00Z", symbols: symbol.split(",").map((symbol) => ({ symbol, currency: "USD", close: options.nullQuote ? null : symbol === "MU" ? 755 : 160.25, change: options.nullQuote ? null : 1.25, changePercent: options.nullQuote ? null : .79, quoteTime: "2026-11-16T15:29:00Z", session: "regular" })) } });
        }
        return route.abort();
      });
      return { context, page, options };
    }

    const desktop = await newPage();
    const p = desktop.page;
    await p.goto(origin + "/archive.html");
    await p.locator(".article-row").first().waitFor();
    assert.equal(await p.locator(".article-row").count(), content.articleCount);
    assert.equal(await p.locator(".article-row h3 a").first().getAttribute("href"), content.articles[0].url);
    await p.screenshot({ path: path.join(artifacts, "archive-desktop.png"), fullPage: false });
    await p.locator("#query").fill("磷化铟");
    await p.waitForTimeout(250);
    assert.ok(await p.locator(".article-row").count() > 0);
    assert.ok(await p.locator(".article-row").count() < content.articleCount);
    assert.equal(new URL(p.url()).searchParams.get("q"), "磷化铟");
    await p.locator(".clear-button").click();
    await p.locator("#symbol-filter").selectOption("MU");
    await p.locator("#month-filter").selectOption("2026-11");
    await p.locator("#topic-filter").selectOption("macro");
    const expected = content.articles.filter((article) => article.symbols.includes("MU") && article.date.startsWith("2026-11") && article.topics.includes("macro"));
    assert.equal(await p.locator(".article-row").count(), expected.length);
    await p.locator("#sort-filter").selectOption("oldest");
    assert.equal(await p.locator(".article-row h3 a").first().getAttribute("href"), expected.at(-1).url);
    await p.reload();
    assert.equal(await p.locator("#symbol-filter").inputValue(), "MU");
    await p.locator(".article-row").first().waitFor();
    assert.equal(await p.locator(".article-row").count(), expected.length);
    await p.locator("#query").fill("does-not-exist-123");
    await p.waitForTimeout(250);
    assert.equal(await p.locator(".article-row").count(), 0);
    assert.match(await p.locator("#article-results").innerText(), /没有匹配/);
    await p.locator(".clear-button").click();
    assert.equal(await p.locator(".article-row").count(), content.articleCount);
    await p.locator("#symbol-filter").selectOption("NVDA");
    await p.goBack();
    assert.equal(await p.locator("#symbol-filter").inputValue(), "");
    await p.goForward();
    assert.equal(await p.locator("#symbol-filter").inputValue(), "NVDA");
    console.log("PASS archive search, combined filters, sort, no-results, deep links, back/forward");

    await p.goto(origin + "/stock.html?symbol=NVDA");
    await p.waitForFunction(() => document.getElementById("quote-status").textContent.includes("Worker"));
    assert.equal(await p.locator("#stock-title").innerText(), "NVDA");
    assert.equal(await p.locator("#quote-price").innerText(), "$160.25");
    assert.match(await p.locator("#quote-time").innerText(), /10:29 ET/);
    assert.match(await p.locator("#stock-levels").innerText(), /2026-11-16/);
    assert.match(await p.locator("#stock-levels").innerText(), /158.4/);
    assert.match(await p.locator("#stock-events").innerText(), /NVDA 周二盘后/);
    assert.equal(await p.locator("#stock-timeline .article-row").count(), content.articles.filter((article) => article.symbols.includes("NVDA")).length);
    await p.screenshot({ path: path.join(artifacts, "stock-desktop.png"), fullPage: false });
    await p.locator("#stock-picker").selectOption("MU");
    await p.waitForFunction(() => document.getElementById("quote-price").textContent === "$755.00");
    assert.match(await p.locator("#stock-events").innerText(), /暂未收录该标的/);
    assert.doesNotMatch(await p.locator("#stock-events").innerText(), /NVDA 周二盘后/);
    await p.locator("#stock-picker").selectOption("SPX");
    assert.match(await p.locator("#stock-timeline").innerText(), /暂无相关文章/);
    assert.match(await p.locator("#stock-levels").innerText(), /暂无可明确/);
    await p.goto(origin + "/stock.html?symbol=%3Cscript%3E");
    await p.locator("#stock-picker:not([disabled])").waitFor();
    assert.match(await p.locator("#page-status").innerText(), /暂未收录标的/);
    assert.ok(await p.locator("#stock-content").isHidden());
    await p.locator("#stock-picker").selectOption("NVDA");
    await p.locator("#stock-content").waitFor();
    console.log("PASS stock timeline, dated levels, matching earnings, missing data, unsupported symbol recovery");

    const failure = await newPage({ failQuote: true });
    await failure.page.goto(origin + "/stock.html?symbol=NVDA");
    await failure.page.waitForFunction(() => document.getElementById("quote-status").textContent.includes("暂不可用"));
    const saved = stocks.symbols.find((item) => item.symbol === "NVDA");
    assert.equal(await failure.page.locator("#quote-price").innerText(), "$" + saved.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const empty = await newPage({ nullQuote: true, failSnapshot: true });
    await empty.page.goto(origin + "/stock.html?symbol=NVDA");
    await empty.page.waitForFunction(() => document.getElementById("quote-status").textContent.includes("暂无可用"));
    assert.equal(await empty.page.locator("#quote-price").innerText(), "--");
    const retry = await newPage({ failIndex: true });
    await retry.page.goto(origin + "/archive.html");
    await retry.page.getByRole("button", { name: "重新加载" }).waitFor();
    retry.options.failIndex = false;
    await retry.page.getByRole("button", { name: "重新加载" }).click();
    await retry.page.locator(".article-row").first().waitFor();
    assert.equal(await retry.page.locator(".article-row").count(), content.articleCount);
    const race = await newPage({ quoteDelay: (symbol) => symbol === "NVDA" ? 600 : 10 });
    await race.page.goto(origin + "/stock.html?symbol=NVDA");
    await race.page.locator("#stock-picker:not([disabled])").waitFor();
    await race.page.locator("#stock-picker").selectOption("MU");
    await race.page.waitForTimeout(900);
    assert.equal(await race.page.locator("#quote-price").innerText(), "$755.00");
    console.log("PASS quote fallback, null-value rejection, index retry, stock-switch race");

    for (const width of [375, 768]) {
      const mobile = await newPage({ viewport: { width, height: 900 } });
      for (const filename of ["archive.html", "stock.html?symbol=NVDA"]) {
        await mobile.page.goto(origin + "/" + filename);
        await mobile.page.locator(filename.startsWith("archive") ? ".article-row" : "#stock-title").first().waitFor();
        assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), filename + " overflows at " + width);
        assert.equal(await mobile.page.locator(".brand img").evaluate((image) => image.complete && image.naturalWidth > 0), true);
        await mobile.page.screenshot({ path: path.join(artifacts, `${filename.startsWith("archive") ? "archive" : "stock"}-${width}.png`), fullPage: false });
      }
      await mobile.context.close();
    }
    await p.goto(origin + "/index.html");
    await p.locator("#articles .article-card").first().waitFor();
    assert.equal(await p.locator("#articles .article-card:visible").count(), 10);
    assert.equal(await p.locator('.nav-links a[href="archive.html"]').count(), 1);
    await p.locator("#stocks").scrollIntoViewIfNeeded();
    await p.locator('#stock-grid a[href="stock.html?symbol=NVDA"]').waitFor();
    assert.ok(await p.locator("#calendar-grid").count() || await p.locator(".calendar-card").count());
    assert.deepEqual(errors, []);
    console.log("PASS responsive layouts, brand assets, homepage latest-ten and stock links; no JS errors");
    console.log("Screenshots: " + artifacts);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
