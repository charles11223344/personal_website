(function () {
  "use strict";

  // NYSE full-day holidays and 13:00 ET early closes. Extend each year.
  const HOLIDAYS = new Set([
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
    "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
    "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
  ]);
  const EARLY_CLOSES = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);
  const OPEN = 9 * 60 + 30;
  const PRE = 4 * 60;
  const AFTER_END = 20 * 60;

  const $ = (id) => document.getElementById(id);
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  });
  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  function nowInEt() {
    const p = Object.fromEntries(etParts.formatToParts(new Date()).map((part) => [part.type, part.value]));
    return {
      key: `${p.year}-${p.month}-${p.day}`, month: p.month, day: p.day,
      weekday: WEEKDAYS[p.weekday], hh: p.hour, mm: p.minute, ss: p.second,
      seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second),
    };
  }

  function addDays(key, days) {
    const d = new Date(key + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function isTradingDay(key) {
    const weekday = new Date(key + "T12:00:00Z").getUTCDay();
    return weekday !== 0 && weekday !== 6 && !HOLIDAYS.has(key);
  }

  function closeMinutes(key) {
    return EARLY_CLOSES.has(key) ? 13 * 60 : 16 * 60;
  }

  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const days = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (days) return `${days} 天 ${h} 小时 ${m} 分`;
    return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function nextOpenSeconds(et) {
    let key = et.key;
    let offset = -et.seconds;
    if (isTradingDay(key) && et.seconds < OPEN * 60) return { seconds: OPEN * 60 - et.seconds, key };
    for (let i = 1; i < 10; i += 1) {
      key = addDays(et.key, i);
      offset += 86400;
      if (isTradingDay(key)) return { seconds: offset + OPEN * 60, key };
    }
    return { seconds: 0, key };
  }

  function marketState(et) {
    const minute = et.seconds / 60;
    const trading = isTradingDay(et.key);
    const close = closeMinutes(et.key);
    if (trading && minute >= OPEN && minute < close) {
      return { state: "open", label: EARLY_CLOSES.has(et.key) ? "交易中 · 提前收盘日" : "交易中", detail: `距收盘 ${formatDuration(close * 60 - et.seconds)}` };
    }
    const next = nextOpenSeconds(et);
    const nextDay = next.key === et.key ? "今天" : WEEKDAY_ZH[new Date(next.key + "T12:00:00Z").getUTCDay()];
    const detail = `距开盘 ${formatDuration(next.seconds)} · ${nextDay} 09:30`;
    if (!trading) return { state: "closed", label: HOLIDAYS.has(et.key) ? "节假日休市" : "周末休市", detail };
    if (minute >= PRE && minute < OPEN) return { state: "pre", label: "盘前交易", detail };
    if (minute >= close && minute < AFTER_END) return { state: "after", label: "盘后交易", detail };
    return { state: "closed", label: "已收盘", detail };
  }

  function tick() {
    const et = nowInEt();
    const clock = $("et-clock");
    if (!clock) return;
    clock.textContent = `${et.hh}:${et.mm}:${et.ss}`;
    $("et-date").textContent = `纽约 · ${Number(et.month)}月${Number(et.day)}日 ${WEEKDAY_ZH[et.weekday]}`;
    const status = marketState(et);
    $("market-status").dataset.state = status.state;
    $("market-status-text").textContent = status.label;
    $("market-countdown").textContent = status.detail;
  }

  function renderQuote(quote, priceId, changeId, format, formatChange) {
    const priceEl = $(priceId);
    const changeEl = $(changeId);
    if (!priceEl || !quote || quote.error || quote.close == null) return false;
    priceEl.textContent = format(quote.close);
    const change = Number(quote.change);
    const pct = Number(quote.changePercent);
    if (Number.isFinite(change) && Number.isFinite(pct)) {
      const sign = change > 0 ? "+" : "";
      changeEl.textContent = formatChange ? formatChange(change, sign) : `${sign}${format(change)} (${sign}${pct.toFixed(2)}%)`;
      changeEl.dataset.trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
    }
    return true;
  }

  function loadQuotes() {
    const endpoint = typeof LEMON_CONFIG !== "undefined" && LEMON_CONFIG.quoteEndpoint;
    if (!endpoint) return;
    const url = new URL(endpoint, location.href);
    url.searchParams.set("symbols", "NQ=F,^TNX");
    fetch(url, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then((data) => {
        const bySymbol = new Map((data.symbols || []).map((item) => [item.symbol, item]));
        const nq = renderQuote(bySymbol.get("NQ=F"), "nq-price", "nq-change", (v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }));
        const tnx = renderQuote(bySymbol.get("^TNX"), "tnx-yield", "tnx-change", (v) => Number(v).toFixed(2) + "%", (change, sign) => `${sign}${Math.round(change * 100)} bp · 较前收盘`);
        if (!nq) $("nq-price").textContent = "暂不可用";
        if (!tnx) $("tnx-yield").textContent = "暂不可用";
      })
      .catch(() => {
        if ($("nq-price").textContent === "加载中") $("nq-price").textContent = "暂不可用";
        if ($("tnx-yield").textContent === "加载中") $("tnx-yield").textContent = "暂不可用";
      });
  }

  tick();
  setInterval(tick, 1000);
  loadQuotes();
  setInterval(() => { if (!document.hidden) loadQuotes(); }, 60000);
})();
