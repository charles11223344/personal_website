(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const page = document.body.dataset.page;
  let index;
  let symbolMap;
  let topicMap;
  let activeSymbol = "";
  let quoteVersion = 0;
  let quoteController;
  let loadingQuote = false;
  let lastQuote;
  let snapshot;
  const number = (value) => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const money = (value) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const monthLabel = (value) => value.slice(0, 4) + " 年 " + Number(value.slice(5, 7)) + " 月";
  const etToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  async function fetchJson(url, signal) {
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  function option(value, label) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  }

  function articleRows(articles, groupMonths = true) {
    let previousMonth;
    return articles.map((article) => {
      const month = article.date.slice(0, 7);
      const heading = groupMonths && month !== previousMonth ? `<h2 class="month-heading">${monthLabel(month)}</h2>` : "";
      previousMonth = month;
      return `${heading}<article class="article-row">
        <div class="article-date"><time datetime="${escape(article.date)}">${escape(article.date)}</time><br><span>${article.readingMinutes} 分钟</span></div>
        <div>${article.kind ? `<p class="article-kind">${escape(article.kind)}</p>` : ""}<h3><a href="${escape(article.url)}">${escape(article.title)}</a></h3>
          <p class="article-summary">${escape(article.description)}</p>
          <div class="article-topics">${article.topics.map((topic) => `<span>${escape(topicMap.get(topic))}</span>`).join("")}</div>
          <div class="article-symbols">${article.symbols.slice(0, 8).map((symbol) => `<a href="stock.html?symbol=${encodeURIComponent(symbol)}">${escape(symbol)}</a>`).join("")}${article.symbols.length > 8 ? `<span class="muted">+${article.symbols.length - 8}</span>` : ""}</div>
        </div></article>`;
    }).join("");
  }

  function updateUrl(params, replace = false) {
    const url = new URL(location.href);
    url.search = params.toString();
    if (url.href !== location.href) history[replace ? "replaceState" : "pushState"]({}, "", url);
  }

  function setupArchive() {
    for (const item of index.symbols) $("symbol-filter").append(option(item.symbol, `${item.symbol} (${item.articleCount})`));
    for (const item of index.topics) $("topic-filter").append(option(item.id, item.label));
    for (const month of [...new Set(index.articles.map((article) => article.date.slice(0, 7)))]) $("month-filter").append(option(month, monthLabel(month)));
    $("index-meta").textContent = `${index.articleCount} 篇文章 · 收录至 ${index.latestArticleDate}`;
    const controls = { q: $("query"), kind: $("kind-filter"), symbol: $("symbol-filter"), topic: $("topic-filter"), month: $("month-filter"), sort: $("sort-filter") };

    function render(writeUrl = false, replace = false) {
      const values = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
      const tokens = values.q.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
      const articles = index.articles.filter((article) => {
        const aliases = article.symbols.flatMap((symbol) => symbolMap.get(symbol)?.aliases || []);
        const haystack = [article.title, article.description, article.searchText, ...(article.tags || []), ...article.symbols, ...aliases].join(" ").toLocaleLowerCase();
        return tokens.every((token) => haystack.includes(token))
          && (!values.kind || article.kind === values.kind)
          && (!values.symbol || article.symbols.includes(values.symbol))
          && (!values.topic || article.topics.includes(values.topic))
          && (!values.month || article.date.startsWith(values.month));
      });
      if (values.sort === "oldest") articles.reverse();
      $("result-count").textContent = `${articles.length} / ${index.articleCount} 篇文章`;
      $("article-results").innerHTML = articles.length ? articleRows(articles) : '<div class="empty-state"><strong>没有匹配的文章</strong><p>试试其他关键词，或清除筛选。</p></div>';
      $("stock-shortcut").hidden = !values.symbol;
      $("stock-shortcut").href = "stock.html?symbol=" + encodeURIComponent(values.symbol);
      $("stock-shortcut").textContent = `${values.symbol} 股票专题`;
      document.title = (values.symbol ? values.symbol + " · " : "") + "文章归档 | Lemon 美股手记";
      if (writeUrl) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(values)) if (value && !(key === "sort" && value === "newest")) params.set(key, value);
        updateUrl(params, replace);
      }
    }

    function restore() {
      const params = new URLSearchParams(location.search);
      for (const [key, control] of Object.entries(controls)) {
        const value = params.get(key) || (key === "sort" ? "newest" : "");
        control.value = value;
        // Preserve unknown shared filters as a visible empty result, rather than silently broadening it.
        if (control.tagName === "SELECT" && control.value !== value) {
          control.append(option(value, value));
          control.value = value;
        }
      }
      render();
    }

    let inputTimer;
    $("query").addEventListener("input", () => { clearTimeout(inputTimer); inputTimer = setTimeout(() => render(true, true), 180); });
    for (const control of Object.values(controls).filter((control) => control.tagName === "SELECT")) control.addEventListener("change", () => { clearTimeout(inputTimer); render(true); });
    $("archive-filters").addEventListener("submit", (event) => { event.preventDefault(); clearTimeout(inputTimer); render(true); });
    $("archive-filters").addEventListener("reset", (event) => {
      event.preventDefault(); clearTimeout(inputTimer);
      for (const [key, control] of Object.entries(controls)) control.value = key === "sort" ? "newest" : "";
      render(true);
    });
    window.addEventListener("popstate", () => { clearTimeout(inputTimer); restore(); });
    restore();
    $("archive-content").hidden = false;
  }

  function renderEvents(symbol) {
    const upcoming = marketCalendarEvents.filter((event) => event.date >= etToday()).sort((a, b) => a.date.localeCompare(b.date));
    const earnings = upcoming.find((event) => event.type === "财报" && (event.symbol === symbol || event.tags.includes(symbol)));
    const macro = upcoming.filter((event) => event.type === "宏观").slice(0, 3);
    const events = [...(earnings ? [earnings] : []), ...macro].sort((a, b) => a.date.localeCompare(b.date));
    $("stock-events").innerHTML = (earnings ? "" : '<p class="small muted">日历暂未收录该标的的下一次财报。</p>') + events.map((event) => `<div class="event-row"><time datetime="${escape(event.date)}">${escape(event.date)} / ${escape(event.type)}</time><h3>${escape(event.title)}</h3><p>${escape(event.focus)}</p></div>`).join("") + (macro.length ? "" : '<p class="small muted">暂未收录后续宏观事件。</p>');
  }

  function renderLevels(articles, symbol) {
    // Only extract explicitly labelled table columns; never infer levels from prose or ambiguous numbers.
    const article = articles.find((entry) => entry.levels.some((level) => level.symbol === symbol));
    if (!article) {
      $("stock-levels").innerHTML = '<p class="muted">暂无可明确区分支撑与压力的原文表格记录。</p>';
      return;
    }
    const level = article.levels.find((entry) => entry.symbol === symbol);
    $("stock-levels").innerHTML = `<p class="level-source muted">原文日期 <time datetime="${article.date}">${article.date}</time></p><dl class="level-grid"><div><dt>支撑 / 原文数值</dt><dd>${escape(level.support || "未列出")}</dd></div><div><dt>压力 / 原文数值</dt><dd>${escape(level.resistance || "未列出")}</dd></div></dl><p class="level-source"><a href="${escape(article.url)}">${escape(article.title)}</a></p>`;
  }

  function validQuote(item) { return item && !item.error && number(item.close) !== null && number(item.close) > 0; }

  function showQuote(item, status) {
    if (!validQuote(item)) return false;
    lastQuote = item;
    const close = number(item.close);
    const change = number(item.change);
    const percent = number(item.changePercent);
    const currency = item.currency || "USD";
    $("quote-price").textContent = (symbolMap.get(activeSymbol)?.kind === "index" ? "" : currency === "USD" ? "$" : currency + " ") + money(close);
    $("quote-change").textContent = change === null || percent === null ? "涨跌数据暂缺" : `${change > 0 ? "+" : ""}${money(change)} (${percent > 0 ? "+" : ""}${percent.toFixed(2)}%)`;
    $("quote-change").className = change > 0 ? "positive" : change < 0 ? "negative" : "";
    const sessions = { pre: "盘前", regular: "常规交易时段", post: "盘后", closed: "最近报价" };
    $("quote-session").textContent = sessions[item.session] || "最近报价";
    const time = item.quoteTime && new Date(item.quoteTime);
    $("quote-time").textContent = time && Number.isFinite(time.getTime()) ? "报价时间 " + new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time) + " ET" : item.date ? "报价日 " + item.date : "报价时间未提供";
    $("quote-status").textContent = status;
    return true;
  }

  async function refreshQuote() {
    if (!activeSymbol || loadingQuote) return;
    const version = quoteVersion;
    const symbol = activeSymbol;
    loadingQuote = true;
    $("refresh-quote").disabled = true;
    $("quote-status").textContent = lastQuote ? "正在刷新，保留最近报价..." : "正在获取报价...";
    const controller = new AbortController();
    quoteController = controller;
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const url = new URL(LEMON_CONFIG.quoteEndpoint);
      url.searchParams.set("symbols", symbol);
      const payload = await fetchJson(url, controller.signal);
      if (version !== quoteVersion) return;
      const item = payload.symbols?.find((entry) => entry.symbol === symbol);
      if (!showQuote(item, "来源 Yahoo Finance / Worker · 可能延迟")) throw new Error("No valid quote");
    } catch {
      if (version !== quoteVersion) return;
      $("quote-status").textContent = lastQuote ? "实时接口暂不可用，保留最近报价" : "暂无可用报价，可稍后刷新";
    } finally {
      clearTimeout(timeout);
      if (version === quoteVersion) {
        loadingQuote = false;
        $("refresh-quote").disabled = false;
      }
    }
  }

  function renderStock() {
    const requested = (new URLSearchParams(location.search).get("symbol") || "NVDA").toUpperCase();
    quoteVersion += 1;
    quoteController?.abort();
    activeSymbol = "";
    loadingQuote = false;
    lastQuote = null;
    const stock = symbolMap.get(requested);
    $("stock-content").hidden = !stock;
    $("page-status").hidden = Boolean(stock);
    $("stock-picker").value = stock ? stock.symbol : "";
    if (!stock) {
      $("page-status").textContent = `暂未收录标的 ${requested.slice(0, 30)}，请选择已有股票。`;
      document.title = "股票专题 | Lemon 美股手记";
      return;
    }
    activeSymbol = stock.symbol;
    document.title = stock.symbol + " 股票专题 | Lemon 美股手记";
    $("stock-title").textContent = stock.symbol;
    $("stock-name").textContent = stock.name;
    $("stock-kind").textContent = stock.kind === "etf" ? "ETF / 研究记录" : stock.kind === "index" ? "INDEX / 研究记录" : "EQUITY / 研究记录";
    $("all-articles-link").href = "archive.html?symbol=" + encodeURIComponent(stock.symbol);
    $("featured-symbols").innerHTML = index.featuredSymbols.map((symbol) => `<a href="stock.html?symbol=${symbol}" ${symbol === stock.symbol ? 'aria-current="page"' : ""}>${symbol}</a>`).join("");
    const articles = index.articles.filter((article) => article.symbols.includes(stock.symbol));
    $("timeline-count").textContent = articles.length + " 篇文章";
    $("stock-timeline").innerHTML = articles.length ? articleRows(articles) : '<p class="empty-state">暂无相关文章。</p>';
    renderLevels(articles, stock.symbol);
    renderEvents(stock.symbol);
    $("quote-price").textContent = "--";
    $("quote-change").textContent = "--";
    $("quote-change").className = "";
    $("quote-time").textContent = "报价时间 --";
    $("quote-session").textContent = "行情";
    $("refresh-quote").disabled = false;
    const saved = snapshot?.symbols?.find((item) => item.symbol === stock.symbol);
    showQuote(saved, "每日快照 · 正在尝试刷新");
    refreshQuote();
  }

  async function setupStock() {
    $("stock-picker").replaceChildren(option("", "选择股票"), ...index.symbols.map((item) => option(item.symbol, `${item.symbol} / ${item.name}`)));
    $("stock-picker").disabled = false;
    $("stock-picker").addEventListener("change", () => {
      if (!$("stock-picker").value) return;
      updateUrl(new URLSearchParams({ symbol: $("stock-picker").value }));
      renderStock();
    });
    $("refresh-quote").addEventListener("click", refreshQuote);
    window.addEventListener("popstate", renderStock);
    renderStock();
    fetchJson("data/stocks.json", AbortSignal.timeout(7000)).then((payload) => {
      snapshot = payload;
      if (!lastQuote && activeSymbol) showQuote(snapshot.symbols?.find((item) => item.symbol === activeSymbol), loadingQuote ? "每日快照 · 正在尝试刷新" : "每日快照 · 实时接口暂不可用");
    }).catch(() => {});
    setInterval(() => { if (!document.hidden) refreshQuote(); }, 30000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderEvents(activeSymbol); refreshQuote(); } });
  }

  async function init() {
    try {
      index = await fetchJson("data/research.json", AbortSignal.timeout(10000));
      if (index.schemaVersion !== 1 || !Array.isArray(index.articles) || !Array.isArray(index.symbols)) throw new Error("Invalid index");
      symbolMap = new Map(index.symbols.map((item) => [item.symbol, item]));
      topicMap = new Map(index.topics.map((item) => [item.id, item.label]));
      $("page-status").hidden = true;
      if (page === "archive") setupArchive();
      else await setupStock();
    } catch {
      $("page-status").hidden = false;
      $("page-status").replaceChildren(document.createTextNode("文章索引暂时无法读取。"));
      const retry = document.createElement("button");
      retry.textContent = "重新加载";
      retry.addEventListener("click", () => location.reload());
      $("page-status").append(retry);
    }
  }

  init();
})();
