const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener("click", function (event) {
    const target = document.querySelector(this.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "start" });
  });
});

// ===== Scroll reveal: fade in and rise when a block enters the viewport =====
(function initScrollReveal() {
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) return;

  const selector = [
    ".section-head",
    ".market-strip-inner",
    ".stock-board",
    ".risk-radar",
    ".risk-cards-detail",
    ".flow-board",
    ".calendar-board",
    ".article-grid",
    ".sync-copy",
    ".newsletter",
    ".crypto-copy",
    ".crypto-box",
  ].join(",");

  const targets = Array.from(document.querySelectorAll(selector));
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
  );

  targets.forEach(function (el, index) {
    el.classList.add("reveal");
    el.style.setProperty("--reveal-delay", (index % 3) * 70 + "ms");
    observer.observe(el);
  });
})();

// ===== Hero: typewriter eyebrow + slow parallax background =====
(function initHero() {
  const hero = document.getElementById("home");
  if (!hero || REDUCED_MOTION) return;

  const typed = document.getElementById("typed-eyebrow");
  if (typed) {
    const fullText = typed.textContent;
    const caret = hero.querySelector(".caret");
    let index = 0;
    typed.textContent = "";
    if (caret) caret.classList.add("is-typing");
    const timer = window.setInterval(function () {
      index += 1;
      typed.textContent = fullText.slice(0, index);
      if (index >= fullText.length) {
        window.clearInterval(timer);
        if (caret) caret.classList.remove("is-typing");
      }
    }, 55);
  }

  const bg = hero.querySelector(".hero-bg");
  if (!bg) return;
  let ticking = false;
  let heroVisible = true;

  function applyParallax() {
    ticking = false;
    if (!heroVisible) return;
    const offset = Math.min(window.scrollY, hero.offsetHeight) * 0.28;
    bg.style.transform = "translate3d(0, " + offset.toFixed(1) + "px, 0)";
  }

  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(applyParallax);
    },
    { passive: true },
  );

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
    }).observe(hero);
  }
})();

const fallbackStockData = {
  updatedAt: null,
  source: "等待自动任务更新",
  symbols: [
    { symbol: "SPX", sourceSymbol: "^GSPC", name: "S&P 500 Index", kind: "index" },
    { symbol: "SPY", sourceSymbol: "SPY", name: "SPDR S&P 500 ETF", kind: "etf" },
    { symbol: "QQQ", sourceSymbol: "QQQ", name: "Invesco QQQ ETF", kind: "etf" },
    { symbol: "SPCX", sourceSymbol: "SPCX", name: "SPCX", kind: "stock" },
    { symbol: "MU", sourceSymbol: "MU", name: "Micron Technology", kind: "stock" },
    { symbol: "NVDA", sourceSymbol: "NVDA", name: "NVIDIA", kind: "stock" },
    { symbol: "AAPL", sourceSymbol: "AAPL", name: "Apple", kind: "stock" },
    { symbol: "MSFT", sourceSymbol: "MSFT", name: "Microsoft", kind: "stock" },
    { symbol: "GOOGL", sourceSymbol: "GOOGL", name: "Alphabet Class A", kind: "stock" },
    { symbol: "AMZN", sourceSymbol: "AMZN", name: "Amazon", kind: "stock" },
    { symbol: "META", sourceSymbol: "META", name: "Meta Platforms", kind: "stock" },
    { symbol: "TSLA", sourceSymbol: "TSLA", name: "Tesla", kind: "stock" },
    { symbol: "AMD", sourceSymbol: "AMD", name: "Advanced Micro Devices", kind: "stock" },
    { symbol: "AVGO", sourceSymbol: "AVGO", name: "Broadcom", kind: "stock" },
    { symbol: "PLTR", sourceSymbol: "PLTR", name: "Palantir", kind: "stock" },
    { symbol: "TSM", sourceSymbol: "TSM", name: "Taiwan Semiconductor", kind: "stock" },
  ],
};
const STOCK_REFRESH_INTERVAL_MS = 30000;
// Fill this with your deployed Cloudflare Worker URL to enable 30-second live quote refresh.
const LIVE_QUOTES_ENDPOINT = "https://lemon-quota-proxy.charlesdataaws.workers.dev/";
// Fill this with your deployed visitor counter Worker URL to show page views and visitors.
const VISITOR_COUNTER_ENDPOINT = "https://lemon-visitor-counter.charlesdataaws.workers.dev/";
const OPTIONS_FLOW_DATA_URL = "data/options-flow.json";
const stockSymbols = fallbackStockData.symbols.map(function (item) {
  return item.symbol;
});
const riskSymbols = ["VIX", "US10Y", "DXY", "WTI", "GOLD"];
const riskMeta = {
  VIX: { label: "波动率", note: "越高代表市场越紧张" },
  US10Y: { label: "利率", note: "升破关键位会压科技股估值" },
  DXY: { label: "美元", note: "走强通常压制风险资产" },
  WTI: { label: "油价", note: "上行会推高通胀预期" },
  GOLD: { label: "避险", note: "强势代表避险或通胀交易升温" },
};
const RISK_HISTORY_KEY = "lemon-risk-history-v1";
const marketCalendarEvents = [
  {
    date: "2026-11-09",
    type: "财报",
    symbol: "CEG",
    title: "CEG 盘前财报，09:00 ET 电话会",
    focus: "关注核电与数据中心长期合同、电力需求与自由现金流，检验 AI 电力需求能否转化为业绩。",
    tags: ["CEG", "AI电力", "长期合同", "现金流"],
  },
  {
    date: "2026-11-09",
    type: "观察",
    symbol: "NVDA",
    title: "NVDA 董事会独立调查进展",
    focus: "董事会已启动独立调查，目前没有结论。关注是否出现新事实，以及对 NVDA 与 AI 芯片板块情绪的影响。",
    tags: ["NVDA", "独立调查", "AI芯片", "情绪"],
  },
  {
    date: "2026-11-09",
    type: "财报",
    symbol: "RKLB",
    title: "RKLB、ASTS 盘后业绩，17:00 ET 电话会",
    focus: "两家太空概念股盘后更新业绩与业务进展，均在 17:00 ET 举行电话会，关注订单、发射与现金消耗。",
    tags: ["RKLB", "ASTS", "电话会", "业绩指引"],
  },
  {
    date: "2026-11-10",
    type: "宏观",
    symbol: "CPI",
    title: "美国 10 月 CPI，08:30 ET",
    focus: "观察整体与核心通胀对利率预期和成长股估值的影响，是本周最大的宏观关口。",
    tags: ["CPI", "通胀", "10Y", "利率"],
  },
  {
    date: "2026-11-10",
    type: "营收",
    symbol: "TSM",
    title: "TSM 公布 10 月营收",
    focus: "台北时间 13:30（美东 00:30）发布月度营收，关注 AI 需求与半导体营收动能。",
    tags: ["TSM", "月度营收", "半导体", "AI需求"],
  },
  {
    date: "2026-11-10",
    type: "财报",
    symbol: "CRWV",
    title: "CRWV 盘后财报，17:00 ET 电话会",
    focus: "本周 AI 融资链最重要的财报之一，重点看资本开支、融资成本与现金流。",
    tags: ["CRWV", "AI融资", "资本开支", "现金流"],
  },
  {
    date: "2026-11-11",
    type: "休市安排",
    symbol: "假期",
    title: "退伍军人节：美股开市，债市建议休市",
    focus: "NYSE 正常交易；SIFMA 建议美元债市全天休市。低流动性容易放大股市波动。",
    tags: ["退伍军人节", "美股开市", "债市休市", "流动性"],
  },
  {
    date: "2026-11-12",
    type: "财报",
    symbol: "NBIS",
    title: "NBIS 盘前财报，08:00 ET 电话会",
    focus: "重点看 GPU 交付量、收入兑现与融资需求，检验 AI 算力能否止跌。",
    tags: ["NBIS", "GPU交付", "收入", "融资需求"],
  },
  {
    date: "2026-11-12",
    type: "财报",
    symbol: "AMAT",
    title: "AMAT 盘后财报，16:30 ET 电话会",
    focus: "验证半导体设备与存储资本开支是否继续增加，并关注后续业绩指引。",
    tags: ["AMAT", "设备", "存储", "资本开支"],
  },
  {
    date: "2026-11-13",
    type: "宏观",
    symbol: "PPI",
    title: "美国 10 月 PPI，08:30 ET",
    focus: "结合 CPI 与 10Y 是否重新升至 4.90%–5.00%，观察利率对成长股的压制。",
    tags: ["PPI", "CPI", "10Y", "利率"],
  },
];
let liveStockTimer = null;
let riskRadarTimer = null;
let optionsFlowTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character];
  });
}

function formatNumber(value, options) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("en-US", options).format(number);
}

function formatPrice(item) {
  const close = Number(item.close);
  if (!Number.isFinite(close)) return "--";
  const formatted = formatNumber(close, {
    minimumFractionDigits: close >= 1000 ? 0 : 2,
    maximumFractionDigits: close >= 1000 ? 2 : 2,
  });
  return item.kind === "index" ? formatted : "$" + formatted;
}

function formatQuoteSession(item) {
  const sessionLabels = {
    pre: "盘前",
    regular: "盘中",
    post: "盘后",
    closed: "收盘",
  };
  return sessionLabels[item.session] || item.kind || "stock";
}

function formatPriceLabel(item) {
  const sessionLabels = {
    pre: "盘前价",
    regular: "盘中价",
    post: "盘后价",
    closed: "收盘价",
  };
  return sessionLabels[item.session] || "价格";
}

function adjustedRiskNumber(item, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return item.symbol === "US10Y" && Math.abs(number) > 20 ? number / 10 : number;
}

function formatRiskValue(item) {
  const value = adjustedRiskNumber(item, item.close);
  if (value === null) return "--";
  if (item.symbol === "US10Y") return value.toFixed(2) + "%";
  if (item.symbol === "WTI" || item.symbol === "GOLD") {
    return (
      "$" +
      formatNumber(value, {
        minimumFractionDigits: value >= 1000 ? 0 : 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRiskChange(item) {
  const change = adjustedRiskNumber(item, item.change);
  const percent = Number(item.changePercent);
  if (change === null || !Number.isFinite(percent)) return "等待更新";
  const changePrefix = change > 0 ? "+" : "";
  const percentPrefix = percent > 0 ? "+" : "";
  const unit = item.symbol === "US10Y" ? "pt" : "";
  return `${changePrefix}${change.toFixed(2)}${unit} (${percentPrefix}${percent.toFixed(2)}%)`;
}

function riskTone(item) {
  const change = adjustedRiskNumber(item, item.change);
  if (change === null || change === 0) return "flat";
  if (item.symbol === "GOLD") return change > 0 ? "supportive" : "flat";
  return change > 0 ? "warning" : "supportive";
}

function readRiskHistory() {
  try {
    return JSON.parse(window.localStorage.getItem(RISK_HISTORY_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function writeRiskHistory(history) {
  try {
    window.localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    // Local storage can be unavailable in private browsing; the radar still works without it.
  }
}

function rememberRiskHistory(symbols) {
  const history = readRiskHistory();
  symbols.forEach(function (item) {
    const value = adjustedRiskNumber(item, item.close);
    const date = item.date || (item.quoteTime ? item.quoteTime.slice(0, 10) : null);
    if (!item.symbol || !date || value === null || value <= 0) return;
    const rows = Array.isArray(history[item.symbol]) ? history[item.symbol] : [];
    const nextRows = rows.filter(function (row) {
      return row.date !== date;
    });
    nextRows.push({ date, close: value });
    nextRows.sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });
    history[item.symbol] = nextRows.slice(-5);
  });
  writeRiskHistory(history);
  return history;
}

function isConsecutiveHigher(history, symbol) {
  const rows = Array.isArray(history[symbol]) ? history[symbol] : [];
  if (rows.length < 3) return false;
  const lastRows = rows.slice(-3);
  return lastRows[0].close < lastRows[1].close && lastRows[1].close < lastRows[2].close;
}

function riskSignal(item, history) {
  const value = adjustedRiskNumber(item, item.close);
  const change = adjustedRiskNumber(item, item.change);
  const percent = Number(item.changePercent);
  if (item.error || value === null) {
    return { level: "error", title: "数据异常", note: item.error || "等待下一次刷新" };
  }

  if (item.symbol === "VIX") {
    if (value > 20) return { level: "danger", title: "风险升温", note: "VIX 高于 20，市场避险情绪抬头。" };
    if (value > 16) return { level: "warning", title: "波动抬头", note: "VIX 不算失控，但波动已经需要纳入仓位判断。" };
    return { level: "supportive", title: "波动可控", note: "VIX 低于 16，风险偏好暂时稳定。" };
  }

  if (item.symbol === "US10Y") {
    if (value > 4.5) return { level: "danger", title: "科技股估值承压", note: "10Y 高于 4.5%，成长股估值压力明显。" };
    if (value > 4.3)
      return { level: "warning", title: "利率偏紧", note: "10Y 位于偏高区域，AI 和高估值板块需要二次确认。" };
    return { level: "supportive", title: "利率压力可控", note: "10Y 暂未突破关键压力位。" };
  }

  if (item.symbol === "DXY") {
    if (isConsecutiveHigher(history, "DXY") || change > 0) {
      return { level: "warning", title: "美元压力", note: "DXY 走强，风险资产和海外收入估值会受到压制。" };
    }
    return { level: "supportive", title: "美元压力缓和", note: "DXY 没有继续上冲，流动性压力暂时下降。" };
  }

  if (item.symbol === "WTI") {
    if (Number.isFinite(percent) && percent >= 2)
      return { level: "warning", title: "通胀风险", note: "WTI 单日大涨，市场可能重新交易通胀压力。" };
    if (value >= 85) return { level: "warning", title: "油价高位", note: "油价处在高位，通胀预期需要继续跟踪。" };
    return { level: "supportive", title: "油价压力有限", note: "WTI 暂未给通胀预期造成明显压力。" };
  }

  if (item.symbol === "GOLD") {
    if (Number.isFinite(percent) && percent >= 1)
      return { level: "warning", title: "避险升温", note: "黄金明显走强，避险或通胀交易升温。" };
    if (Number.isFinite(percent) && percent <= -1)
      return { level: "supportive", title: "避险降温", note: "黄金走弱，短线避险需求下降。" };
    return { level: "flat", title: "避险中性", note: "黄金变化不大，暂时不是主导变量。" };
  }

  return { level: riskTone(item), title: "观察中", note: "宏观变量等待更多确认。" };
}

function updateRiskSummary(symbols, history) {
  const title = document.getElementById("risk-summary-title");
  const detail = document.getElementById("risk-summary-detail");
  const badge = document.getElementById("risk-summary-badge");
  if (!title || !detail || !badge) return;

  const signals = symbols.map(function (item) {
    return riskSignal(item, history);
  });
  const alerts = signals.filter(function (signal) {
    return signal.level === "danger" || signal.level === "warning";
  });

  if (alerts.length >= 3) {
    title.textContent = "综合判断：风险偏高";
    badge.textContent = alerts.length + " 个警报";
  } else if (alerts.length > 0) {
    title.textContent = "综合判断：局部压力升温";
    badge.textContent = alerts.length + " 个警报";
  } else {
    title.textContent = "综合判断：风险环境可控";
    badge.textContent = "压力有限";
  }

  detail.textContent = alerts.length
    ? alerts
        .slice(0, 3)
        .map(function (signal) {
          return signal.title;
        })
        .join(" / ")
    : "VIX、10Y、DXY、WTI、GOLD 暂未同时触发压力条件。";
}

function formatVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume) || volume <= 0) return "成交量 --";
  return (
    "成交量 " +
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(volume)
  );
}

function formatStockDate(value) {
  if (!value) return "等待首次更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Daily close history per symbol. The live quote endpoint has no history, so remember it from the snapshot.
const stockHistoryCache = new Map();

function sparklineSvg(values, direction) {
  const points = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  if (points.length < 2) return "";

  const width = 120;
  const height = 34;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map(function (value, index) {
    const x = (index / (points.length - 1)) * width;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  const area = "M0," + height + " L" + coords.join(" L") + " L" + width + "," + height + " Z";

  return (
    '<svg class="spark ' +
    direction +
    '" viewBox="0 0 ' +
    width +
    " " +
    height +
    '" preserveAspectRatio="none" role="img" aria-label="近期收盘走势">' +
    '<path class="spark-area" d="' +
    area +
    '" />' +
    '<polyline class="spark-line" points="' +
    coords.join(" ") +
    '" />' +
    "</svg>"
  );
}

function renderStocks(data, note) {
  const grid = document.getElementById("stock-grid");
  const updated = document.getElementById("stocks-updated");
  const source = document.getElementById("stocks-source");
  const liveStatus = document.getElementById("stocks-live-status");
  if (!grid) return;

  const symbols = Array.isArray(data.symbols) ? data.symbols : [];
  symbols.forEach(function (item) {
    if (item && item.symbol && Array.isArray(item.history) && item.history.length > 1) {
      stockHistoryCache.set(item.symbol, item.history);
    }
  });
  if (updated) updated.textContent = "更新时间 " + formatStockDate(data.updatedAt);
  if (source) source.textContent = note || data.source || "data/stocks.json";
  if (liveStatus && data.liveStatus) liveStatus.textContent = data.liveStatus;

  // Cache previous values for animation
  const prevValues = new Map();
  grid.querySelectorAll(".stock-card").forEach((card) => {
    const symbol = card.querySelector(".stock-symbol strong")?.textContent;
    const priceEl = card.querySelector(".stock-price");
    const changeEl = card.querySelector(".stock-change");
    if (symbol && priceEl) {
      const priceText = priceEl.textContent.replace(/[$,]/g, "");
      const price = parseFloat(priceText);
      if (Number.isFinite(price)) prevValues.set(symbol + "-price", price);
    }
    if (symbol && changeEl) {
      const changeMatch = changeEl.textContent.match(/([+-]?\d+\.?\d*)/);
      if (changeMatch) prevValues.set(symbol + "-change", parseFloat(changeMatch[1]));
    }
  });

  grid.innerHTML = symbols
    .map(function (item) {
      const change = Number(item.change);
      const percent = Number(item.changePercent);
      const hasChange = Number.isFinite(change) && Number.isFinite(percent);
      const direction = hasChange ? (change > 0 ? "up" : change < 0 ? "down" : "flat") : "flat";
      const changePrefix = hasChange && change > 0 ? "+" : "";
      const percentPrefix = hasChange && percent > 0 ? "+" : "";
      const changeText = hasChange
        ? `${changePrefix}${change.toFixed(2)} (${percentPrefix}${percent.toFixed(2)}%)`
        : "等待更新";
      const quoteDate = item.quoteTime
        ? `报价时间 ${formatStockDate(item.quoteTime)}`
        : item.date
          ? `报价日 ${escapeHtml(item.date)}`
          : "报价日 --";
      const session = formatQuoteSession(item);
      const priceLabel = formatPriceLabel(item);
      const errorClass = item.error ? " error" : "";

      const priceValue = Number(item.close);
      const priceStr = formatPrice(item);

      const history =
        Array.isArray(item.history) && item.history.length > 1 ? item.history : stockHistoryCache.get(item.symbol);
      const spark = item.error ? "" : sparklineSvg(history, direction);

      return `
              <article class="stock-card ${direction}${errorClass}" data-symbol="${escapeHtml(item.symbol)}">
                <div class="stock-symbol">
                  <strong>${escapeHtml(item.symbol)}</strong>
                  <span>${escapeHtml(session)}</span>
                </div>
                <p class="stock-name">${escapeHtml(item.name || item.symbol)}</p>
                <div class="stock-price" data-value="${Number.isFinite(priceValue) ? priceValue : ""}">${escapeHtml(priceLabel)} ${priceStr}</div>
                <div class="stock-change ${direction}" data-value="${Number.isFinite(change) ? change : ""}">${escapeHtml(changeText)}</div>
                ${spark}
                <div class="stock-meta">
                  <span>${quoteDate}</span>
                  <span>${escapeHtml(formatVolume(item.volume))}</span>
                  ${item.error ? `<span>${escapeHtml(item.error)}</span>` : ""}
                </div>
              </article>
            `;
    })
    .join("");

  // Animate value changes
  if (typeof animateValue === "function") {
    grid.querySelectorAll(".stock-card").forEach((card) => {
      const symbol = card.dataset.symbol;
      const priceEl = card.querySelector(".stock-price");
      const changeEl = card.querySelector(".stock-change");
      const newPrice = parseFloat(priceEl?.dataset.value);
      const newChange = parseFloat(changeEl?.dataset.value);

      if (priceEl && Number.isFinite(newPrice)) {
        const prevPrice = prevValues.get(symbol + "-price");
        if (Number.isFinite(prevPrice) && prevPrice !== newPrice) {
          const isIndex = priceEl.textContent.includes("SPX") || priceEl.textContent.includes("^GSPC");
          const formatter = (v) => (isIndex ? v.toFixed(2) : "$" + v.toFixed(2));
          animateValue(priceEl, prevPrice, newPrice, 500, formatter);
        }
      }
      if (changeEl && Number.isFinite(newChange)) {
        const prevChange = prevValues.get(symbol + "-change");
        if (Number.isFinite(prevChange) && prevChange !== newChange) {
          const direction = newChange > 0 ? "up" : newChange < 0 ? "down" : "flat";
          changeEl.className = `stock-change ${direction}`;
          const formatter = (v) => (v > 0 ? "+" : "") + v.toFixed(2);
          animateValue(changeEl, prevChange, newChange, 500, formatter);
        }
      }
    });
  }
}

function renderRiskRadar(data) {
  const grid = document.getElementById("risk-grid");
  const updated = document.getElementById("risk-updated");
  const source = document.getElementById("risk-source");
  if (!grid) return;

  const symbols = Array.isArray(data.symbols) ? data.symbols : [];
  if (updated) updated.textContent = "更新时间 " + formatStockDate(data.updatedAt);
  if (source) source.textContent = data.source || "Live quote endpoint";
  const riskHistory = rememberRiskHistory(symbols);
  updateRiskSummary(symbols, riskHistory);

  // Cache previous values for animation
  const prevValues = new Map();
  grid.querySelectorAll(".risk-card").forEach((card) => {
    const symbol = card.querySelector(".risk-card-top strong")?.textContent;
    const valueEl = card.querySelector(".risk-value");
    const changeEl = card.querySelector(".risk-change");
    if (symbol && valueEl) {
      const valueText = valueEl.textContent.replace(/[$,%]/g, "");
      const value = parseFloat(valueText);
      if (Number.isFinite(value)) prevValues.set(symbol + "-value", value);
    }
    if (symbol && changeEl) {
      const changeMatch = changeEl.textContent.match(/([+-]?\d+\.?\d*)/);
      if (changeMatch) prevValues.set(symbol + "-change", parseFloat(changeMatch[1]));
    }
  });

  grid.innerHTML = symbols
    .map(function (item) {
      const meta = riskMeta[item.symbol] || { label: item.kind || "Risk", note: "宏观变量" };
      const signal = riskSignal(item, riskHistory);
      const change = adjustedRiskNumber(item, item.change);
      const direction = change === null ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
      const tone = item.error ? "error" : signal.level;
      const quoteDate = item.quoteTime
        ? `报价时间 ${formatStockDate(item.quoteTime)}`
        : item.date
          ? `报价日 ${escapeHtml(item.date)}`
          : "报价日 --";

      const valueNum = adjustedRiskNumber(item, item.close);
      const valueStr = formatRiskValue(item);
      const changeStr = formatRiskChange(item);

      return `
              <article class="risk-card ${escapeHtml(tone)}" data-symbol="${escapeHtml(item.symbol)}">
                <div class="risk-card-top">
                  <strong>${escapeHtml(item.symbol)}</strong>
                  <span>${escapeHtml(meta.label)}</span>
                </div>
                <p class="risk-name">${escapeHtml(item.name || item.symbol)}</p>
                <div class="risk-value" data-value="${Number.isFinite(valueNum) ? valueNum : ""}">${escapeHtml(valueStr)}</div>
                <div class="risk-change ${direction}" data-value="${Number.isFinite(change) ? change : ""}">${escapeHtml(changeStr)}</div>
                <div class="risk-verdict">${escapeHtml(signal.title)}</div>
                <div class="risk-note">${escapeHtml(signal.note || meta.note)} · ${quoteDate}</div>
              </article>
            `;
    })
    .join("");

  // Animate value changes
  if (typeof animateValue === "function") {
    grid.querySelectorAll(".risk-card").forEach((card) => {
      const symbol = card.dataset.symbol;
      const valueEl = card.querySelector(".risk-value");
      const changeEl = card.querySelector(".risk-change");
      const newValue = parseFloat(valueEl?.dataset.value);
      const newChange = parseFloat(changeEl?.dataset.value);

      if (valueEl && Number.isFinite(newValue)) {
        const prevValue = prevValues.get(symbol + "-value");
        if (Number.isFinite(prevValue) && prevValue !== newValue) {
          const isPercent = item.symbol === "US10Y";
          const isPrice = item.symbol === "WTI" || item.symbol === "GOLD";
          const formatter = (v) => (isPercent ? v.toFixed(2) + "%" : isPrice ? "$" + v.toFixed(2) : v.toFixed(2));
          animateValue(valueEl, prevValue, newValue, 500, formatter);
        }
      }
      if (changeEl && Number.isFinite(newChange)) {
        const prevChange = prevValues.get(symbol + "-change");
        if (Number.isFinite(prevChange) && prevChange !== newChange) {
          const direction = newChange > 0 ? "up" : newChange < 0 ? "down" : "flat";
          changeEl.className = `risk-change ${direction}`;
          const isPercent = item.symbol === "US10Y";
          const unit = isPercent ? "pt" : "";
          const formatter = (v) => (v > 0 ? "+" : "") + v.toFixed(2) + unit;
          animateValue(changeEl, prevChange, newChange, 500, formatter);
        }
      }
    });
  }

  // Update radar SVG visualization
  if (typeof updateRadarVisualization === "function") {
    updateRadarVisualization(symbols);
  }
}

// ===== Radar SVG Visualization =====
const RADAR_CONFIG = {
  axes: [
    { key: "VIX", label: "VIX", max: 40, color: "var(--neon-red)", unit: "" },
    { key: "US10Y", label: "10Y", max: 5.5, color: "var(--neon-amber)", unit: "%" },
    { key: "DXY", label: "DXY", max: 115, color: "var(--neon-cyan)", unit: "" },
    { key: "WTI", label: "WTI", max: 120, color: "var(--neon-violet)", unit: "$" },
    { key: "GOLD", label: "GOLD", max: 5000, color: "var(--gold)", unit: "$" },
  ],
  center: { x: 200, y: 200 },
  maxRadius: 160,
};

// Store trail history for radar
let radarTrailHistory = [];

function updateRadarVisualization(symbols) {
  const svg = document.getElementById("radar-svg");
  const legend = document.getElementById("radar-legend");
  if (!svg || !legend) return;

  const axes = RADAR_CONFIG.axes;
  const center = RADAR_CONFIG.center;
  const maxRadius = RADAR_CONFIG.maxRadius;

  // Calculate normalized values (0-1) for each axis
  const values = axes.map((axis) => {
    const item = symbols.find((s) => s.symbol === axis.key);
    if (!item) return { ...axis, value: null, normalized: 0, rawValue: null };

    const rawValue = adjustedRiskNumber(item, item.close);
    if (rawValue === null || !Number.isFinite(rawValue)) {
      return { ...axis, value: null, normalized: 0, rawValue: null };
    }

    // Normalize to 0-1 (with some padding)
    const normalized = Math.min(1, Math.max(0, rawValue / axis.max));
    return { ...axis, value: normalized, rawValue };
  });

  // Build polygon points
  const points = values
    .map((axis, i) => {
      if (axis.value === null || axis.value === 0) return null;
      const angle = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
      const radius = axis.value * maxRadius;
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        axis,
      };
    })
    .filter(Boolean);

  // Update axes lines
  const axesGroup = document.getElementById("radar-axes");
  if (axesGroup) {
    axesGroup.innerHTML = axes
      .map((axis, i) => {
        const angle = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
        const x = center.x + maxRadius * Math.cos(angle);
        const y = center.y + maxRadius * Math.sin(angle);
        return `<line x1="${center.x}" y1="${center.y}" x2="${x}" y2="${y}" />`;
      })
      .join("");
  }

  // Update axis labels
  const labelsGroup = document.getElementById("radar-labels");
  if (labelsGroup) {
    labelsGroup.innerHTML = axes
      .map((axis, i) => {
        const angle = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
        const labelRadius = maxRadius + 24;
        const x = center.x + labelRadius * Math.cos(angle);
        const y = center.y + labelRadius * Math.sin(angle);
        return `<text x="${x}" y="${y}">${axis.label}</text>`;
      })
      .join("");
  }

  // Update data polygon
  const polygon = document.getElementById("radar-polygon");
  if (polygon && points.length >= 3) {
    const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
    polygon.setAttribute("points", pointsStr);
    polygon.style.opacity = "1";
  } else if (polygon) {
    polygon.setAttribute("points", "");
    polygon.style.opacity = "0";
  }

  // Update data points
  const pointsGroup = document.getElementById("radar-points");
  if (pointsGroup) {
    pointsGroup.innerHTML = points
      .map(
        (p) => `
                      <circle cx="${p.x}" cy="${p.y}" r="5" data-axis="${p.axis.key}" data-value="${p.axis.rawValue}" />
                      <text x="${p.x}" y="${p.y - 12}">${p.axis.rawValue !== null ? p.axis.rawValue.toFixed(p.axis.key === "US10Y" ? 2 : 0) : "—"}</text>
                    `,
      )
      .join("");
  }

  // Update trail (store last 3 readings)
  if (points.length >= 3) {
    const trailPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
    radarTrailHistory.unshift(trailPoints);
    radarTrailHistory = radarTrailHistory.slice(0, 3);

    const trailGroup = document.getElementById("radar-trail");
    if (trailGroup) {
      trailGroup.innerHTML = radarTrailHistory
        .map((trail, i) => `<polygon points="${trail}" style="opacity: ${0.06 * (i + 1)};" />`)
        .join("");
    }
  }

  // Update legend
  legend.innerHTML = values
    .map((axis) => {
      const val = axis.rawValue;
      const className = axis.key.toLowerCase();
      const displayVal =
        val !== null && Number.isFinite(val)
          ? axis.key === "US10Y"
            ? val.toFixed(2)
            : axis.key === "WTI" || axis.key === "GOLD"
              ? "$" + val.toFixed(0)
              : val.toFixed(axis.key === "VIX" ? 1 : 0)
          : "—";
      return `
                                        <div class="radar-legend-item">
                                          <span class="radar-legend-label">${axis.label}</span>
                                          <span class="radar-legend-value ${className}">${displayVal}${axis.key === "WTI" || axis.key === "GOLD" ? "" : axis.unit}</span>
                                        </div>
                                      `;
    })
    .join("");
}

// ===== Flow Radar SVG Visualization =====
const FLOW_RADAR_CONFIG = {
  axes: [
    { key: "call", label: "Call Vol", max: 12000000, color: "var(--neon-green)", unit: "" },
    { key: "put", label: "Put Vol", max: 8000000, color: "var(--neon-red)", unit: "" },
    { key: "notional", label: "Notional", max: 800000000000, color: "var(--neon-cyan)", unit: "" },
    { key: "callPutRatio", label: "C/P Ratio", max: 3, color: "var(--neon-violet)", unit: "" },
    { key: "volumeOi", label: "Vol/OI", max: 0.5, color: "var(--neon-amber)", unit: "" },
    { key: "riskScore", label: "Risk Score", max: 100, color: "var(--gold)", unit: "" },
  ],
  center: { x: 200, y: 200 },
  maxRadius: 160,
};

// Store trail history for flow radar
let flowRadarTrailHistory = [];

function updateFlowRadarVisualization(signals) {
  const svg = document.getElementById("flow-radar-svg");
  const legend = document.getElementById("flow-radar-legend");
  if (!svg || !legend) return;

  // Aggregate across all signals for the radar
  const totalCallVol = signals.reduce((sum, s) => sum + Number(s.callVolume || 0), 0);
  const totalPutVol = signals.reduce((sum, s) => sum + Number(s.putVolume || 0), 0);
  const totalNotional = signals.reduce((sum, s) => sum + Number(s.totalSize || 0), 0);
  const avgCallPutRatio =
    signals.length > 0 ? signals.reduce((sum, s) => sum + Number(s.callPutRatio || 0), 0) / signals.length : 0;
  const avgVolumeOi =
    signals.length > 0 ? signals.reduce((sum, s) => sum + Number(s.volumeOi || 0), 0) / signals.length : 0;
  const maxRiskScore = signals.length > 0 ? Math.max(...signals.map((s) => Number(s.riskScore || 0))) : 0;
  const hasUnusual = signals.some((s) => s.unusual);

  const values = FLOW_RADAR_CONFIG.axes.map((axis) => {
    let rawValue;
    switch (axis.key) {
      case "call":
        rawValue = totalCallVol;
        break;
      case "put":
        rawValue = totalPutVol;
        break;
      case "notional":
        rawValue = totalNotional;
        break;
      case "callPutRatio":
        rawValue = avgCallPutRatio;
        break;
      case "volumeOi":
        rawValue = avgVolumeOi;
        break;
      case "riskScore":
        rawValue = maxRiskScore;
        break;
      default:
        rawValue = 0;
    }

    const normalized = Math.min(1, Math.max(0, rawValue / axis.max));
    return { ...axis, value: normalized, rawValue };
  });

  // Build polygon points
  const points = values
    .map((axis, i) => {
      if (axis.value === null || axis.value === 0) return null;
      const angle = (i / values.length) * Math.PI * 2 - Math.PI / 2;
      const radius = axis.value * FLOW_RADAR_CONFIG.maxRadius;
      return {
        x: FLOW_RADAR_CONFIG.center.x + radius * Math.cos(angle),
        y: FLOW_RADAR_CONFIG.center.y + radius * Math.sin(angle),
        axis,
      };
    })
    .filter(Boolean);

  // Update axes lines
  const axesGroup = document.getElementById("flow-radar-axes");
  if (axesGroup) {
    axesGroup.innerHTML = values
      .map((axis, i) => {
        const angle = (i / values.length) * Math.PI * 2 - Math.PI / 2;
        const x = FLOW_RADAR_CONFIG.center.x + FLOW_RADAR_CONFIG.maxRadius * Math.cos(angle);
        const y = FLOW_RADAR_CONFIG.center.y + FLOW_RADAR_CONFIG.maxRadius * Math.sin(angle);
        return `<line x1="${FLOW_RADAR_CONFIG.center.x}" y1="${FLOW_RADAR_CONFIG.center.y}" x2="${x}" y2="${y}" />`;
      })
      .join("");
  }

  // Update axis labels
  const labelsGroup = document.getElementById("flow-radar-labels");
  if (labelsGroup) {
    labelsGroup.innerHTML = values
      .map((axis, i) => {
        const angle = (i / values.length) * Math.PI * 2 - Math.PI / 2;
        const labelRadius = FLOW_RADAR_CONFIG.maxRadius + 24;
        const x = FLOW_RADAR_CONFIG.center.x + labelRadius * Math.cos(angle);
        const y = FLOW_RADAR_CONFIG.center.y + labelRadius * Math.sin(angle);
        return `<text x="${x}" y="${y}">${axis.label}</text>`;
      })
      .join("");
  }

  // Update data polygon
  const polygon = document.getElementById("flow-radar-polygon");
  if (polygon && points.length >= 3) {
    const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
    polygon.setAttribute("points", pointsStr);
    polygon.style.opacity = "1";
  } else if (polygon) {
    polygon.setAttribute("points", "");
    polygon.style.opacity = "0";
  }

  // Update data points
  const pointsGroup = document.getElementById("flow-radar-points");
  if (pointsGroup) {
    pointsGroup.innerHTML = points
      .map(
        (p) => `
                                                        <circle cx="${p.x}" cy="${p.y}" r="5" data-axis="${p.axis.key}" data-value="${p.axis.rawValue}" />
                                                        <text x="${p.x}" y="${p.y - 12}">${
                                                          p.axis.rawValue !== null && Number.isFinite(p.axis.rawValue)
                                                            ? p.axis.key === "notional"
                                                              ? "$" + (p.axis.rawValue / 1e9).toFixed(1) + "B"
                                                              : p.axis.key === "callPutRatio"
                                                                ? p.axis.rawValue.toFixed(2)
                                                                : p.axis.key === "volumeOi"
                                                                  ? p.axis.rawValue.toFixed(2)
                                                                  : p.axis.key === "call" || p.axis.key === "put"
                                                                    ? (p.axis.rawValue / 1e6).toFixed(2) + "M"
                                                                    : p.axis.rawValue.toFixed(0)
                                                            : "—"
                                                        }</text>
                                                      `,
      )
      .join("");
  }

  // Update trail (store last 3 readings)
  if (points.length >= 3) {
    const trailPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
    flowRadarTrailHistory.unshift(trailPoints);
    flowRadarTrailHistory = flowRadarTrailHistory.slice(0, 3);

    const trailGroup = document.getElementById("flow-radar-trail");
    if (trailGroup) {
      trailGroup.innerHTML = flowRadarTrailHistory
        .map((trail, i) => `<polygon points="${trail}" style="opacity: ${0.06 * (i + 1)};" />`)
        .join("");
    }
  }

  // Update legend
  legend.innerHTML = values
    .map((axis) => {
      const val = axis.rawValue;
      let className = axis.key;
      let displayVal;
      if (val !== null && Number.isFinite(val)) {
        if (axis.key === "notional") {
          displayVal = "$" + (val / 1e9).toFixed(1) + "B";
        } else if (axis.key === "callPutRatio" || axis.key === "volumeOi") {
          displayVal = val.toFixed(2);
        } else if (axis.key === "call" || axis.key === "put") {
          displayVal = (val / 1e6).toFixed(2) + "M";
        } else {
          displayVal = val.toFixed(0);
        }
      } else {
        displayVal = "—";
      }
      // Special classes for color coding
      if (axis.key === "call") className = "call";
      else if (axis.key === "put") className = "put";
      else if (axis.key === "riskScore") className = "score";
      else if (axis.key === "volumeOi") className = "unusual";
      else className = "neutral";

      return `
                                                                          <div class="flow-radar-legend-item">
                                                                            <span class="flow-radar-legend-label">${axis.label}</span>
                                                                            <span class="flow-radar-legend-value ${className}">${displayVal}${axis.key === "riskScore" ? "" : axis.unit}</span>
                                                                          </div>
                                                                        `;
    })
    .join("");
}

// ===== Calendar Radar SVG Visualization =====
function updateCalendarRadarVisualization(events) {
  const svg = document.getElementById("calendar-radar-svg");
  const legend = document.getElementById("calendar-radar-legend");
  if (!svg || !legend) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get date range
  const eventDates = events.map((e) => eventDateValue(e)).filter(Boolean);
  if (!eventDates.length) return;

  const minDate = new Date(Math.min(...eventDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...eventDates.map((d) => d.getTime())));

  // Add padding (2 days before/after)
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 2);

  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000));
  const svgWidth = 800;
  const svgHeight = 320;
  const padding = { left: 80, right: 40, top: 50, bottom: 40 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Type rows configuration
  const typeRows = [
    {
      key: "宏观",
      label: "Macro",
      color: "var(--neon-red)",
      y: padding.top + plotHeight * 0.15,
      gradient: "cal-gradient-macro",
    },
    {
      key: "财报",
      label: "Earnings",
      color: "var(--neon-cyan)",
      y: padding.top + plotHeight * 0.35,
      gradient: "cal-gradient-earnings",
    },
    {
      key: "营收",
      label: "Revenue",
      color: "var(--neon-green)",
      y: padding.top + plotHeight * 0.55,
      gradient: "cal-gradient-earnings",
    },
    {
      key: "观察",
      label: "Observation",
      color: "var(--neon-violet)",
      y: padding.top + plotHeight * 0.75,
      gradient: "cal-gradient-liquidity",
    },
    {
      key: "休市安排",
      label: "Holiday",
      color: "var(--neon-violet)",
      y: padding.top + plotHeight * 0.95,
      gradient: "cal-gradient-liquidity",
    },
  ];

  // Build grid
  const gridGroup = document.getElementById("calendar-radar-grid");
  if (gridGroup) {
    let gridHtml = "";
    // Vertical lines (days)
    for (let i = 0; i <= totalDays; i++) {
      const x = padding.left + (i / totalDays) * plotWidth;
      gridHtml += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + plotHeight}" />`;
    }
    // Horizontal lines (type rows)
    typeRows.forEach((row) => {
      gridHtml += `<line x1="${padding.left}" y1="${row.y}" x2="${padding.left + plotWidth}" y2="${row.y}" />`;
    });
    gridGroup.innerHTML = gridHtml;
  }

  // Build axis (date labels)
  const axisGroup = document.getElementById("calendar-radar-axis");
  if (axisGroup) {
    let axisHtml = "";
    // Show date labels every 2 days or at least at start/end
    const step = Math.max(1, Math.ceil(totalDays / 10));
    for (let i = 0; i <= totalDays; i += step) {
      const date = new Date(minDate);
      date.setDate(minDate.getDate() + i);
      const x = padding.left + (i / totalDays) * plotWidth;
      const label = date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
      axisHtml += `<text x="${x}" y="${padding.top - 8}" text-anchor="middle">${label}</text>`;
    }
    // Today marker on axis
    const todayIdx = Math.round((today - minDate) / 86400000);
    if (todayIdx >= 0 && todayIdx <= totalDays) {
      const x = padding.left + (todayIdx / totalDays) * plotWidth;
      axisHtml += `<text x="${x}" y="${padding.top - 28}" text-anchor="middle" fill="var(--neon-green)" font-weight="900">今天</text>`;
    }
    axisGroup.innerHTML = axisHtml;
  }

  // Update today line position
  const todayLine = document.getElementById("calendar-radar-today");
  if (todayLine) {
    const todayIdx = Math.max(0, Math.min(totalDays, Math.round((today - minDate) / 86400000)));
    const x = padding.left + (todayIdx / totalDays) * plotWidth;
    todayLine.setAttribute("x1", x);
    todayLine.setAttribute("x2", x);
  }

  // Build events
  const eventsGroup = document.getElementById("calendar-radar-events");
  if (eventsGroup) {
    let eventsHtml = "";
    const slotCounts = {};
    const slotTotals = {};
    events.forEach((event) => {
      const slotKey = event.date + "|" + (event.type || "");
      slotTotals[slotKey] = (slotTotals[slotKey] || 0) + 1;
    });
    events.forEach((event, idx) => {
      const date = eventDateValue(event);
      if (!date) return;

      const dayIdx = Math.max(0, Math.min(totalDays, Math.round((date - minDate) / 86400000)));
      const slotKey = event.date + "|" + (event.type || "");
      const slotIdx = slotCounts[slotKey] || 0;
      slotCounts[slotKey] = slotIdx + 1;
      // Spread same-day, same-type markers horizontally so labels do not overlap
      const spread = (slotIdx - (slotTotals[slotKey] - 1) / 2) * 34;
      const x = padding.left + (dayIdx / totalDays) * plotWidth + spread;

      // Determine type row
      const type = event.type || "observation";
      let row = typeRows.find((r) => r.key === type);
      if (!row) row = typeRows.find((r) => r.key === "observation");

      const y = row.y;
      const radius = 8;

      // Format date for display
      const dateStr = date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });

      eventsHtml += `
                                                                          <g class="calendar-radar-event" data-type="${type}" data-title="${escapeHtml(event.title)}" data-date="${dateStr}" data-focus="${escapeHtml(event.focus)}" transform="translate(${x}, ${y})">
                                                                            <circle r="${radius}" fill="${row.color}" fill-opacity="0.3" stroke="${row.color}" stroke-width="2" />
                                                                            <circle r="4" fill="${row.color}" />
                                                                            <text x="0" y="${-radius - 6}" text-anchor="middle" font-size="8px">${escapeHtml(event.symbol || event.title.split(" ")[0])}</text>
                                                                          </g>
                                                                        `;
    });
    eventsGroup.innerHTML = eventsHtml;
  }

  // Update legend
  const typeCounts = {};
  events.forEach((e) => {
    const type = e.type || "observation";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const legendItems = typeRows
    .filter((r) => typeCounts[r.key] > 0)
    .map((row) => {
      const count = typeCounts[row.key] || 0;
      return `
                                                                        <div class="calendar-radar-legend-item ${row.key}">
                                                                          <span class="calendar-radar-legend-dot"></span>
                                                                          <span class="calendar-radar-legend-label">${row.label}</span>
                                                                          <span class="calendar-radar-legend-value">${count} 项</span>
                                                                        </div>
                                                                      `;
    })
    .join("");

  legend.innerHTML = legendItems;
}

function eventDateValue(event) {
  if (!event.date || event.date === "TBD") return null;
  const date = new Date(event.date + "T00:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventDate(event) {
  if (event.dateLabel) return event.dateLabel;
  const date = eventDateValue(event);
  if (!date) return "待确认";
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function eventState(event) {
  const date = eventDateValue(event);
  if (!date) return { className: "upcoming", label: "待确认" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(date);
  eventDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((eventDay - today) / 86400000);
  if (diffDays === 0) return { className: "today", label: "今天" };
  if (diffDays > 0) return { className: "upcoming", label: diffDays + " 天后" };
  return { className: "past", label: "已过" };
}

function eventSortRank(event) {
  const date = eventDateValue(event);
  if (!date) return 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(date);
  eventDay.setHours(0, 0, 0, 0);
  return eventDay >= today ? 0 : 2;
}

function renderMarketCalendar() {
  const grid = document.getElementById("calendar-grid");
  const status = document.getElementById("calendar-status");
  if (!grid) return;

  const events = marketCalendarEvents
    .filter(function (event) {
      return eventSortRank(event) !== 2;
    })
    .sort(function (a, b) {
      const rankDiff = eventSortRank(a) - eventSortRank(b);
      if (rankDiff !== 0) return rankDiff;
      const aDate = eventDateValue(a);
      const bDate = eventDateValue(b);
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return eventSortRank(a) === 2 ? bDate - aDate : aDate - bDate;
    });

  grid.innerHTML =
    events
      .map(function (event) {
        const state = eventState(event);
        const tags = Array.isArray(event.tags) ? event.tags : [];
        return `
              <article class="event-card ${escapeHtml(state.className)}">
                <div class="event-topline">
                  <span class="event-date">${escapeHtml(formatEventDate(event))}</span>
                  <span class="event-type">${escapeHtml(event.type)} · ${escapeHtml(state.label)}</span>
                </div>
                <h3>${escapeHtml(event.title)}</h3>
                <p>${escapeHtml(event.focus)}</p>
                <div class="event-tags">
                  ${tags
                    .map(function (tag) {
                      return `<span>${escapeHtml(tag)}</span>`;
                    })
                    .join("")}
                </div>
              </article>
            `;
      })
      .join("") || '<p class="event-card">近期事件已结束，等待下一次日历更新。</p>';

  if (status) status.textContent = "已加载 " + events.length + " 个近期重点事件 · 手动维护";

  // Update calendar radar visualization
  if (typeof updateCalendarRadarVisualization === "function") {
    updateCalendarRadarVisualization(events);
  }
}

function fetchStockSnapshot() {
  return fetch("data/stocks.json", { cache: "no-store" }).then(function (response) {
    if (!response.ok) throw new Error("Stock data unavailable");
    return response.json();
  });
}

function liveQuotesUrl() {
  if (!LIVE_QUOTES_ENDPOINT) return null;
  const url = new URL(LIVE_QUOTES_ENDPOINT, window.location.href);
  url.searchParams.set("symbols", stockSymbols.join(","));
  url.searchParams.set("_", Date.now().toString());
  return url.toString();
}

function riskRadarUrl() {
  if (!LIVE_QUOTES_ENDPOINT) return null;
  const url = new URL(LIVE_QUOTES_ENDPOINT, window.location.href);
  url.searchParams.set("symbols", riskSymbols.join(","));
  url.searchParams.set("_", Date.now().toString());
  return url.toString();
}

function fetchLiveStocks() {
  const url = liveQuotesUrl();
  if (!url) return Promise.reject(new Error("Live quote endpoint not configured"));
  return fetch(url, { cache: "no-store" }).then(function (response) {
    if (!response.ok) throw new Error("Live quote endpoint unavailable");
    return response.json();
  });
}

function setLiveStockStatus(message) {
  const liveStatus = document.getElementById("stocks-live-status");
  if (liveStatus) liveStatus.textContent = message;
}

function refreshLiveStocks() {
  return fetchLiveStocks()
    .then(function (data) {
      data.liveStatus = "实时刷新中 · 每 30 秒";
      renderStocks(data, data.source || "Live quote endpoint");
    })
    .catch(function () {
      setLiveStockStatus("实时刷新失败，保留每日快照");
    });
}

function refreshRiskRadar() {
  const url = riskRadarUrl();
  if (!url) {
    const source = document.getElementById("risk-source");
    if (source) source.textContent = "实时接口未配置";
    return;
  }

  fetch(url, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Risk data unavailable");
      return response.json();
    })
    .then(renderRiskRadar)
    .catch(function () {
      const source = document.getElementById("risk-source");
      if (source) source.textContent = "风险雷达刷新失败";
    });
}

function startRiskRadarRefresh() {
  refreshRiskRadar();
  if (riskRadarTimer) window.clearInterval(riskRadarTimer);
  riskRadarTimer = window.setInterval(refreshRiskRadar, STOCK_REFRESH_INTERVAL_MS);
}

function startLiveStockRefresh() {
  if (!LIVE_QUOTES_ENDPOINT) {
    setLiveStockStatus("实时接口未配置，当前显示每日快照");
    return;
  }
  refreshLiveStocks();
  if (liveStockTimer) window.clearInterval(liveStockTimer);
  liveStockTimer = window.setInterval(refreshLiveStocks, STOCK_REFRESH_INTERVAL_MS);
}

function formatFlowMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (number >= 1000000000000) return "$" + (number / 1000000000000).toFixed(2) + "T";
  if (number >= 1000000000) return "$" + (number / 1000000000).toFixed(2) + "B";
  if (number >= 1000000) return "$" + (number / 1000000).toFixed(2) + "M";
  if (number >= 1000) return "$" + (number / 1000).toFixed(0) + "K";
  return "$" + number.toFixed(0);
}

function flowSignalDecision(signal) {
  const direction = signal.direction || "相对均衡";
  const unusual = Boolean(signal.unusual);

  if (direction === "Call偏强" && unusual) {
    return {
      priority: 5,
      label: "优先观察",
      tone: "candidate",
      note: "Call 成交占优且活跃度异常，加入候选；仍需等待股价趋势确认。",
    };
  }
  if (direction === "Call偏强") {
    return {
      priority: 4,
      label: "Call 活跃",
      tone: "watch",
      note: "Call 成交占优，但尚未达到异常水平，先观察价格是否同步转强。",
    };
  }
  if (direction === "相对均衡" && unusual) {
    return {
      priority: 3,
      label: "波动放大",
      tone: "watch",
      note: "成交活跃但方向不明确，适合等待突破，不适合仅凭期权数据追入。",
    };
  }
  if (direction === "Put偏强") {
    return {
      priority: unusual ? 2 : 1,
      label: unusual ? "风险升高" : "Put 活跃",
      tone: "caution",
      note: unusual ? "Put 成交占优且活跃度异常，优先检查下行风险。" : "Put 成交占优，暂不列为多头候选。",
    };
  }
  return {
    priority: 0,
    label: "等待确认",
    tone: "watch",
    note: "方向和活跃度都不突出，暂时不提高观察优先级。",
  };
}

function flowActivityLabel(signal) {
  if (signal.unusual) return "异常";
  const score = Number(signal.riskScore);
  if (Number.isFinite(score) && score >= 50) return "较高";
  return "普通";
}

function renderOptionsFlow(data) {
  const status = document.getElementById("flow-status");
  const sourceNote = document.getElementById("flow-source-note");
  const kpis = document.getElementById("flow-kpis");
  const watchlist = document.getElementById("flow-watchlist");
  const signals = Array.isArray(data.signals) ? data.signals : [];
  const callCount = signals.filter(function (signal) {
    return signal.direction === "Call偏强";
  }).length;
  const putCount = signals.filter(function (signal) {
    return signal.direction === "Put偏强";
  }).length;
  const candidateCount = signals.filter(function (signal) {
    return signal.direction === "Call偏强" && signal.unusual;
  }).length;
  const callVolume = signals.reduce(function (total, signal) {
    return total + Number(signal.callVolume || 0);
  }, 0);
  const putVolume = signals.reduce(function (total, signal) {
    return total + Number(signal.putVolume || 0);
  }, 0);
  const ratio = putVolume > 0 ? (callVolume / putVolume).toFixed(2) : callVolume > 0 ? "∞" : "--";
  const isDelayedSnapshot = data.sourceType === "delayed-snapshot";

  if (status) {
    status.textContent = isDelayedSnapshot
      ? "Cboe 延迟约 " + (data.delayMinutes || 15) + " 分钟 · 截至 " + formatStockDate(data.dataAsOf || data.updatedAt)
      : "OCC 最新可用日终 · 数据日 " + (data.dataDate || "无数据");
  }
  if (sourceNote) {
    sourceNote.textContent = isDelayedSnapshot
      ? "Cboe 当日累计成交量与持仓快照；不识别主动买卖，网站约每小时更新。"
      : "OCC 官方日终统计；不识别主动买卖，当前作为延迟数据失败时的备用来源。";
  }

  if (kpis) {
    kpis.innerHTML = `
                <div class="flow-kpi"><span>优先观察</span><strong>${candidateCount}</strong></div>
                <div class="flow-kpi"><span>Call 偏强</span><strong>${callCount}</strong></div>
                <div class="flow-kpi"><span>Put 偏强</span><strong>${putCount}</strong></div>
                <div class="flow-kpi"><span>整体 Call / Put</span><strong>${escapeHtml(ratio)}</strong></div>
              `;
  }

  // Update flow radar visualization
  if (typeof updateFlowRadarVisualization === "function") {
    updateFlowRadarVisualization(signals);
  }

  if (!watchlist) return;
  if (!signals.length) {
    watchlist.innerHTML = '<div class="flow-empty">当前关注列表没有期权活动信号。</div>';
    return;
  }

  const rankedSignals = signals
    .slice()
    .sort(function (left, right) {
      const priorityDifference = flowSignalDecision(right).priority - flowSignalDecision(left).priority;
      if (priorityDifference !== 0) return priorityDifference;
      return Number(right.riskScore || 0) - Number(left.riskScore || 0);
    })
    .slice(0, 8);

  watchlist.innerHTML = rankedSignals
    .map(function (signal, index) {
      const decision = flowSignalDecision(signal);
      const volumeOi =
        signal.volumeOi === null || signal.volumeOi === undefined ? "--" : Number(signal.volumeOi).toFixed(2);
      const callPutRatio =
        signal.callPutRatio === null || signal.callPutRatio === undefined
          ? "--"
          : Number(signal.callPutRatio).toFixed(2);
      return `
          <article class="flow-signal-card">
            <div class="flow-signal-top">
              <div class="flow-signal-title">
                <span class="flow-rank">${index + 1}</span>
                <strong class="flow-symbol">${escapeHtml(signal.symbol)}</strong>
              </div>
              <span class="flow-label ${decision.tone}">${escapeHtml(decision.label)}</span>
            </div>
            <p class="flow-signal-verdict">${escapeHtml(decision.note)}</p>
            <div class="flow-signal-metrics">
              <div class="flow-signal-metric"><span>Call / Put</span><strong>${escapeHtml(callPutRatio)}</strong></div>
              <div class="flow-signal-metric"><span>成交 / 持仓</span><strong>${escapeHtml(volumeOi)}</strong></div>
              <div class="flow-signal-metric"><span>加权期限</span><strong>${escapeHtml(signal.daysToExpiry ?? "--")} 天</strong></div>
            </div>
            <span class="flow-signal-score">${escapeHtml(signal.direction || "--")} · 活跃度 ${escapeHtml(flowActivityLabel(signal))} · 活跃分 ${escapeHtml(signal.riskScore ?? "--")}/100</span>
          </article>
        `;
    })
    .join("");
}

function refreshOptionsFlow() {
  const status = document.getElementById("flow-status");
  const url = new URL(OPTIONS_FLOW_DATA_URL, window.location.href);
  url.searchParams.set("_", Date.now().toString());
  fetch(url.toString(), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Options activity unavailable");
      return response.json();
    })
    .then(function (data) {
      const supportedSource = data && (data.sourceType === "official-eod" || data.sourceType === "delayed-snapshot");
      if (!supportedSource || !Array.isArray(data.signals)) {
        throw new Error("Invalid options activity payload");
      }
      return data;
    })
    .then(renderOptionsFlow)
    .catch(function () {
      if (status) status.textContent = "期权活动数据暂时不可用";
      const watchlist = document.getElementById("flow-watchlist");
      if (watchlist) {
        watchlist.innerHTML = '<div class="flow-empty">等待自动任务生成最新期权活动数据。</div>';
      }
    });
}

function startOptionsFlowRefresh() {
  refreshOptionsFlow();
  if (optionsFlowTimer) window.clearInterval(optionsFlowTimer);
  optionsFlowTimer = window.setInterval(refreshOptionsFlow, 900000);
}

fetchStockSnapshot()
  .then(function (response) {
    response.liveStatus = LIVE_QUOTES_ENDPOINT ? "准备实时刷新" : "实时接口未配置，当前显示每日快照";
    renderStocks(response);
    startLiveStockRefresh();
  })
  .catch(function () {
    fallbackStockData.liveStatus = "本地数据未加载";
    renderStocks(fallbackStockData, "本地数据未加载，等待自动任务生成");
    startLiveStockRefresh();
  });
startRiskRadarRefresh();
startOptionsFlowRefresh();
renderMarketCalendar();

const weatherDescriptions = {
  0: "晴朗",
  1: "大致晴朗",
  2: "局部多云",
  3: "阴天",
  45: "有雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "较强毛毛雨",
  56: "冻毛毛雨",
  57: "较强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "较强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "小阵雨",
  81: "阵雨",
  82: "强阵雨",
  85: "小阵雪",
  86: "强阵雪",
  95: "雷暴",
  96: "雷暴伴小冰雹",
  99: "雷暴伴强冰雹",
};

function displayWeather(data) {
  const currentEl = document.getElementById("weather-current");
  const detailEl = document.getElementById("weather-detail");
  if (!currentEl || !detailEl || !data.current) return;

  const current = data.current;
  const temp = Math.round(current.temperature_2m);
  const desc = weatherDescriptions[current.weather_code] || "天气更新";
  const humidity = Math.round(current.relative_humidity_2m);
  const wind = Math.round(current.wind_speed_10m);

  currentEl.textContent = `${temp}°C · ${desc}`;
  detailEl.textContent = `湿度 ${humidity}% · 风速 ${wind} km/h`;
}

fetch(
  "https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=America%2FToronto",
)
  .then(function (response) {
    return response.json();
  })
  .then(function (data) {
    displayWeather(data);
  })
  .catch(function () {
    const currentEl = document.getElementById("weather-current");
    const detailEl = document.getElementById("weather-detail");
    if (currentEl) currentEl.textContent = "天气不可用";
    if (detailEl) detailEl.textContent = "稍后再试";
  });

function displayExchangeRates(data) {
  const usdCadEl = document.getElementById("usd-cad-rate");
  const usdCadDetailEl = document.getElementById("usd-cad-detail");
  const cadCnyEl = document.getElementById("cad-cny-rate");
  const cnyCadDetailEl = document.getElementById("cny-cad-detail");
  const rates = data && data.rates;
  if (!rates || !rates.CAD || !rates.CNY) throw new Error("Exchange rates unavailable");

  const usdCad = Number(rates.CAD);
  const usdCny = Number(rates.CNY);
  const cadCny = usdCny / usdCad;
  const cnyCad = usdCad / usdCny;
  const updated = data.time_last_update_utc
    ? new Date(data.time_last_update_utc).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
    : "实时汇率";

  if (usdCadEl) usdCadEl.textContent = `1 USD = ${usdCad.toFixed(4)} CAD`;
  if (usdCadDetailEl) usdCadDetailEl.textContent = `更新 ${updated}`;
  if (cadCnyEl) cadCnyEl.textContent = `1 CAD = ${cadCny.toFixed(4)} CNY`;
  if (cnyCadDetailEl) cnyCadDetailEl.textContent = `1 CNY = ${cnyCad.toFixed(4)} CAD`;
}

fetch("https://open.er-api.com/v6/latest/USD")
  .then(function (response) {
    if (!response.ok) throw new Error("Exchange rate request failed");
    return response.json();
  })
  .then(function (data) {
    displayExchangeRates(data);
  })
  .catch(function () {
    const usdCadEl = document.getElementById("usd-cad-rate");
    const usdCadDetailEl = document.getElementById("usd-cad-detail");
    const cadCnyEl = document.getElementById("cad-cny-rate");
    const cnyCadDetailEl = document.getElementById("cny-cad-detail");
    if (usdCadEl) usdCadEl.textContent = "汇率不可用";
    if (usdCadDetailEl) usdCadDetailEl.textContent = "稍后再试";
    if (cadCnyEl) cadCnyEl.textContent = "汇率不可用";
    if (cnyCadDetailEl) cnyCadDetailEl.textContent = "稍后再试";
  });

function asPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatCadCryptoPrice(value) {
  const number = asPositiveNumber(value);
  return number === null ? null : number.toLocaleString("en-CA", { maximumFractionDigits: 2 });
}

function renderCryptoPrices(bitcoinCad, ethereumCad, sourceLabel) {
  const div = document.getElementById("crypto-prices");
  if (!div) return;
  const btcPrice = formatCadCryptoPrice(bitcoinCad);
  const ethPrice = formatCadCryptoPrice(ethereumCad);
  if (!btcPrice || !ethPrice) {
    div.textContent = "Crypto prices unavailable.";
    return;
  }
  div.innerHTML = `
        <img src="https://assets.coingecko.com/coins/images/1/large/bitcoin.png" alt="BTC">
        <b>BTC</b>: $${btcPrice} CAD<br>
        <img src="https://assets.coingecko.com/coins/images/279/large/ethereum.png" alt="ETH">
        <b>ETH</b>: $${ethPrice} CAD<br>
        <small>Source: ${escapeHtml(sourceLabel)}</small>
      `;
}

function displayCrypto(data) {
  if (!data || !data.bitcoin || !data.ethereum) {
    throw new Error("CoinGecko data unavailable");
  }
  renderCryptoPrices(data.bitcoin.cad, data.ethereum.cad, "CoinGecko");
}

function displayCryptoFromQuotes(data) {
  const quotes = Array.isArray(data && data.symbols) ? data.symbols : [];
  const btc = quotes.find(function (quote) {
    return quote.symbol === "BTC-CAD" && !quote.error;
  });
  const eth = quotes.find(function (quote) {
    return quote.symbol === "ETH-CAD" && !quote.error;
  });
  if (!btc || !eth) throw new Error("Crypto quote proxy data unavailable");
  renderCryptoPrices(btc.close, eth.close, "Yahoo Finance via Worker");
}

function displayCryptoFromCoinbase(bitcoinData, ethereumData) {
  const bitcoinCad = bitcoinData && bitcoinData.data && bitcoinData.data.rates ? bitcoinData.data.rates.CAD : null;
  const ethereumCad = ethereumData && ethereumData.data && ethereumData.data.rates ? ethereumData.data.rates.CAD : null;
  if (!bitcoinCad || !ethereumCad) throw new Error("Coinbase crypto data unavailable");
  renderCryptoPrices(bitcoinCad, ethereumCad, "Coinbase");
}

function loadCoinGeckoCrypto() {
  return fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=cad", {
    cache: "no-store",
  })
    .then(function (response) {
      if (!response.ok) throw new Error("CoinGecko " + response.status);
      return response.json();
    })
    .then(function (data) {
      displayCrypto(data);
    });
}

function loadQuoteProxyCrypto() {
  const url = liveQuoteUrl(["BTC-CAD", "ETH-CAD"]);
  if (!url) return Promise.reject(new Error("Crypto quote proxy unavailable"));
  return fetch(url, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Crypto quote proxy " + response.status);
      return response.json();
    })
    .then(function (data) {
      displayCryptoFromQuotes(data);
    });
}

function loadCoinbaseCrypto() {
  return Promise.all([
    fetch("https://api.coinbase.com/v2/exchange-rates?currency=BTC", { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Coinbase BTC " + response.status);
      return response.json();
    }),
    fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH", { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Coinbase ETH " + response.status);
      return response.json();
    }),
  ]).then(function (results) {
    displayCryptoFromCoinbase(results[0], results[1]);
  });
}

loadCoinGeckoCrypto()
  .catch(loadCoinbaseCrypto)
  .catch(loadQuoteProxyCrypto)
  .catch(function () {
    const div = document.getElementById("crypto-prices");
    if (div) div.textContent = "Crypto prices unavailable.";
  });

function visitorCounterUrl(path) {
  if (!VISITOR_COUNTER_ENDPOINT) return null;
  return new URL(path, VISITOR_COUNTER_ENDPOINT).toString();
}

function visitorId() {
  const key = "lemonVisitorId";
  try {
    let id = window.localStorage.getItem(key);
    if (!id) {
      id =
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
      window.localStorage.setItem(key, id);
    }
    return id;
  } catch (error) {
    return "session-" + Math.random().toString(16).slice(2);
  }
}

function setVisitorCounterStatus(message) {
  const status = document.getElementById("visitor-counter-status");
  if (status) status.textContent = message;
}

function renderVisitorStats(data) {
  const pageViews = document.getElementById("page-view-count");
  const visitors = document.getElementById("visitor-count");
  if (pageViews) pageViews.textContent = formatNumber(data.pageViews, { maximumFractionDigits: 0 });
  if (visitors) visitors.textContent = formatNumber(data.visitors, { maximumFractionDigits: 0 });
  setVisitorCounterStatus(data.countedVisitor ? "新访客" : "已统计");
}

function recordVisit() {
  const url = visitorCounterUrl("/hit");
  if (!url) {
    setVisitorCounterStatus("统计待配置");
    return;
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitorId: visitorId(),
      path: window.location.pathname,
    }),
  })
    .then(function (response) {
      if (!response.ok) throw new Error("Visitor counter unavailable");
      return response.json();
    })
    .then(renderVisitorStats)
    .catch(function () {
      setVisitorCounterStatus("统计不可用");
    });
}

recordVisit();

// ===== Background FX: glowing particle field with gentle mouse follow =====
(function initBgFx() {
  const canvas = document.getElementById("bg-fx");
  if (!canvas || REDUCED_MOTION) return;

  const ctx = canvas.getContext("2d");
  const COLORS = ["#00f3ff", "#39ff14", "#ffb000", "#bc9cff"];
  const CONNECT_DIST = 150;
  const MOUSE_RADIUS = 210;
  const MAX_SPEED = 1.1;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const mouse = { x: -9999, y: -9999, active: false };
  const sprites = {};
  let w = 0;
  let h = 0;
  let particles = [];
  let frameId = 0;
  let running = false;

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  // Pre-render one soft glow sprite per color so each frame only needs drawImage.
  function glowSprite(color) {
    if (sprites[color]) return sprites[color];
    const size = 64;
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const g = sprite.getContext("2d");
    const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, hexToRgba(color, 1));
    gradient.addColorStop(0.22, hexToRgba(color, 0.6));
    gradient.addColorStop(0.55, hexToRgba(color, 0.16));
    gradient.addColorStop(1, hexToRgba(color, 0));
    g.fillStyle = gradient;
    g.fillRect(0, 0, size, size);
    sprites[color] = sprite;
    return sprite;
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticle() {
    const vx = (Math.random() - 0.5) * 0.36;
    const vy = (Math.random() - 0.5) * 0.36;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: vx,
      vy: vy,
      baseVx: vx,
      baseVy: vy,
      r: Math.random() * 2.2 + 1.3,
      color: color,
      sprite: glowSprite(color),
      alpha: Math.random() * 0.45 + 0.4,
      twinkle: Math.random() * Math.PI * 2,
    };
  }

  function initParticles() {
    const count = Math.min(110, Math.max(34, Math.floor((w * h) / 15000)));
    particles = [];
    for (let i = 0; i < count; i++) particles.push(createParticle());
  }

  function update() {
    for (const p of particles) {
      if (mouse.active) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < MOUSE_RADIUS) {
          // Drift gently toward the pointer, but back off when very close so they never clump.
          const strength = (1 - dist / MOUSE_RADIUS) * 0.035 * (dist < 45 ? -1.5 : 1);
          p.vx += (dx / dist) * strength;
          p.vy += (dy / dist) * strength;
        }
      }

      // Ease back toward each particle's own slow drift.
      p.vx += (p.baseVx - p.vx) * 0.012;
      p.vy += (p.baseVy - p.vy) * 0.012;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > MAX_SPEED) {
        p.vx = (p.vx / speed) * MAX_SPEED;
        p.vy = (p.vy / speed) * MAX_SPEED;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.twinkle += 0.02;

      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 0.6;
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          ctx.strokeStyle = "rgba(0,243,255," + ((1 - dist / CONNECT_DIST) * 0.18).toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    if (mouse.active) {
      for (const p of particles) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS * 0.8) {
          ctx.strokeStyle = "rgba(188,156,255," + ((1 - dist / (MOUSE_RADIUS * 0.8)) * 0.3).toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      const size = p.r * 7;
      ctx.globalAlpha = p.alpha * (0.78 + 0.22 * Math.sin(p.twinkle));
      ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    frameId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    frameId = window.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    window.cancelAnimationFrame(frameId);
  }

  window.addEventListener(
    "pointermove",
    function (event) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.active = true;
    },
    { passive: true },
  );
  window.addEventListener("pointerup", function (event) {
    if (event.pointerType === "touch") mouse.active = false;
  });
  document.addEventListener("mouseleave", function () {
    mouse.active = false;
  });

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      resize();
      initParticles();
    }, 150);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  resize();
  initParticles();
  start();
})();

// ===== Animation Utilities =====
function animateValue(el, from, to, duration = 600, formatter = (v) => v) {
  if (!el || !Number.isFinite(from) || !Number.isFinite(to)) return;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = from + (to - from) * eased;
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatter(to);
  }
  requestAnimationFrame(tick);
}
