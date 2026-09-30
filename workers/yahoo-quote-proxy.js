const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const OPTIONS_FLOW_URL = "https://xscsywydsoaawgahwxwo.supabase.co/rest/v1/options_signals";
const OPTIONS_FLOW_KEY = "sb_publishable_DGIJfma-y1wKCTtFzG2NWA_QtbbBotV";

const WATCHLIST = {
  SPX: { yahoo: "^GSPC", name: "S&P 500 Index", kind: "index" },
  SPY: { yahoo: "SPY", name: "SPDR S&P 500 ETF", kind: "etf" },
  QQQ: { yahoo: "QQQ", name: "Invesco QQQ ETF", kind: "etf" },
  SPCX: { yahoo: "SPCX", name: "SPCX", kind: "stock" },
  MU: { yahoo: "MU", name: "Micron Technology", kind: "stock" },
  NVDA: { yahoo: "NVDA", name: "NVIDIA", kind: "stock" },
  AAPL: { yahoo: "AAPL", name: "Apple", kind: "stock" },
  MSFT: { yahoo: "MSFT", name: "Microsoft", kind: "stock" },
  GOOGL: { yahoo: "GOOGL", name: "Alphabet Class A", kind: "stock" },
  AMZN: { yahoo: "AMZN", name: "Amazon", kind: "stock" },
  META: { yahoo: "META", name: "Meta Platforms", kind: "stock" },
  TSLA: { yahoo: "TSLA", name: "Tesla", kind: "stock" },
  AMD: { yahoo: "AMD", name: "Advanced Micro Devices", kind: "stock" },
  AVGO: { yahoo: "AVGO", name: "Broadcom", kind: "stock" },
  PLTR: { yahoo: "PLTR", name: "Palantir", kind: "stock" },
  TSM: { yahoo: "TSM", name: "Taiwan Semiconductor", kind: "stock" },
  VIX: { yahoo: "^VIX", name: "CBOE Volatility Index", kind: "risk" },
  US10Y: { yahoo: "^TNX", name: "US 10Y Treasury Yield", kind: "yield" },
  DXY: { yahoo: "DX-Y.NYB", name: "US Dollar Index", kind: "currency" },
  WTI: { yahoo: "CL=F", name: "WTI Crude Oil Futures", kind: "commodity" },
  GOLD: { yahoo: "GC=F", name: "Gold Futures", kind: "commodity" }
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=20"
};

const OPTIONS_FLOW_SYMBOLS = new Set([
  "SPX", "SPY", "QQQ", "SPCX", "MU", "NVDA", "AAPL", "MSFT", "GOOGL",
  "AMZN", "META", "TSLA", "AMD", "AVGO", "PLTR", "TSM"
]);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rounded(value) {
  return value === null ? null : Math.round(value * 100) / 100;
}

function usableClose(value, config) {
  const close = asNumber(value);
  if (close === null) return false;
  return config.allowZeroClose ? close >= 0 : close > 0;
}

function tradingSessionFromTimestamp(meta, timestamp) {
  const periods = meta.currentTradingPeriod || {};
  const seconds = Math.floor(timestamp / 1000);
  const order = [
    ["pre", "pre"],
    ["regular", "regular"],
    ["post", "post"]
  ];

  for (const [key, label] of order) {
    const period = periods[key];
    if (period && seconds >= period.start && seconds < period.end) return label;
  }

  return "closed";
}

function previousCloseForChange(meta, session) {
  const regularMarketPrice = asNumber(meta.regularMarketPrice);
  const previousClose = asNumber(meta.chartPreviousClose);
  if (session === "post" && regularMarketPrice !== null) return regularMarketPrice;
  return previousClose;
}

function volumeFromQuote(quote, latestIndex, meta, options = {}) {
  const latestVolume = asNumber(quote.volume && quote.volume[latestIndex]);
  const regularMarketVolume = asNumber(meta.regularMarketVolume);

  if (options.aggregateVolume) {
    const totalVolume = (quote.volume || []).reduce((total, value) => {
      const volume = asNumber(value);
      return total + (volume || 0);
    }, 0);
    if (totalVolume > 0) return totalVolume;
  }

  if (regularMarketVolume && regularMarketVolume > 0) return regularMarketVolume;
  return latestVolume;
}

function compactSymbols(value) {
  return String(value || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .filter((symbol, index, array) => array.indexOf(symbol) === index)
    .slice(0, 30);
}

function compactFlowSymbols(value) {
  return compactSymbols(value).filter((symbol) => OPTIONS_FLOW_SYMBOLS.has(symbol));
}

function flowRiskScore(signal) {
  const amount = Math.max(0, asNumber(signal.total_size) || 0);
  const volume = Math.max(0, asNumber(signal.volume) || 0);
  const openInterest = Math.max(0, asNumber(signal.open_interest) || 0);
  const iv = Math.max(0, asNumber(signal.iv) || 0);
  const dte = Math.max(0, asNumber(signal.days_to_expiry) || 0);
  const volumeOi = openInterest > 0 ? volume / openInterest : volume > 0 ? 5 : 0;
  const amountPoints = Math.min(30, Math.log10(amount / 100000 + 1) * 20);
  const volumeOiPoints = Math.min(30, volumeOi * 10);
  const dtePoints = dte <= 7 ? 20 : dte <= 30 ? 15 : dte <= 90 ? 8 : 3;
  const ivPoints = Math.min(20, iv / 5);
  return Math.round(Math.min(100, amountPoints + volumeOiPoints + dtePoints + ivPoints));
}

function normalizeFlowSignal(signal) {
  const volume = Math.max(0, asNumber(signal.volume) || 0);
  const openInterest = Math.max(0, asNumber(signal.open_interest) || 0);
  const totalSize = Math.max(0, asNumber(signal.total_size) || 0);
  const volumeOi = openInterest > 0 ? volume / openInterest : null;
  const riskScore = flowRiskScore(signal);
  return {
    id: signal.discord_message_id,
    receivedAt: signal.received_at,
    symbol: String(signal.ticker || "").toUpperCase(),
    side: signal.side,
    direction: signal.direction,
    spotPrice: asNumber(signal.spot_price),
    strike: asNumber(signal.strike),
    expiry: signal.expiry,
    daysToExpiry: asNumber(signal.days_to_expiry),
    totalSize,
    volume,
    openInterest,
    volumeOi: volumeOi === null ? null : rounded(volumeOi),
    avgPrice: asNumber(signal.avg_price),
    iv: asNumber(signal.iv),
    delta: asNumber(signal.delta),
    score: asNumber(signal.score),
    starRating: asNumber(signal.star_rating),
    riskScore,
    riskLevel: riskScore >= 75 ? "high" : riskScore >= 50 ? "medium" : "low",
    unusual: totalSize >= 1000000 || (volumeOi !== null && volumeOi >= 2)
  };
}

function aggregateFlowSignals(signals, symbols) {
  return symbols.map((symbol) => {
    const rows = signals.filter((signal) => signal.symbol === symbol);
    const callFlow = rows.filter((signal) => signal.side === "Call").reduce((total, signal) => total + signal.totalSize, 0);
    const putFlow = rows.filter((signal) => signal.side === "Put").reduce((total, signal) => total + signal.totalSize, 0);
    const bullishFlow = rows.filter((signal) => signal.direction === "Bullish").reduce((total, signal) => total + signal.totalSize, 0);
    const bearishFlow = rows.filter((signal) => signal.direction === "Bearish").reduce((total, signal) => total + signal.totalSize, 0);
    const averageRisk = rows.length
      ? Math.round(rows.reduce((total, signal) => total + signal.riskScore, 0) / rows.length)
      : null;
    return {
      symbol,
      signalCount: rows.length,
      callFlow,
      putFlow,
      callPutRatio: putFlow > 0 ? rounded(callFlow / putFlow) : callFlow > 0 ? null : 0,
      bullishFlow,
      bearishFlow,
      unusualCount: rows.filter((signal) => signal.unusual).length,
      averageRisk
    };
  });
}

async function buildOptionsFlowResponse(url) {
  const requested = compactFlowSymbols(url.searchParams.get("symbols"));
  const symbols = requested.length ? requested : Array.from(OPTIONS_FLOW_SYMBOLS);
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit")) || 100));
  const sourceUrl = new URL(OPTIONS_FLOW_URL);
  sourceUrl.searchParams.set(
    "select",
    "discord_message_id,received_at,ticker,side,direction,spot_price,strike,expiry,days_to_expiry,total_size,volume,open_interest,avg_price,iv,delta,score,star_rating"
  );
  sourceUrl.searchParams.set("ticker", `in.(${symbols.join(",")})`);
  sourceUrl.searchParams.set("order", "received_at.desc");
  sourceUrl.searchParams.set("limit", String(limit));

  const response = await fetch(sourceUrl.toString(), {
    headers: { apikey: OPTIONS_FLOW_KEY, Authorization: `Bearer ${OPTIONS_FLOW_KEY}` },
    cf: { cacheTtl: 30, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`Options flow source ${response.status}`);

  const rows = await response.json();
  const signals = (Array.isArray(rows) ? rows : [])
    .map(normalizeFlowSignal)
    .filter((signal) => symbols.includes(signal.symbol));
  const latestAt = signals.length ? signals[0].receivedAt : null;
  return {
    updatedAt: new Date().toISOString(),
    latestSignalAt: latestAt,
    source: "Third-party Supabase options flow prototype",
    sourcePage: "https://fenzheng.up.railway.app/radar",
    simulated: true,
    stale: latestAt ? Date.now() - Date.parse(latestAt) > 15 * 60 * 1000 : true,
    symbols: aggregateFlowSignals(signals, symbols),
    signals
  };
}

async function fetchYahooChart(yahooSymbol, range = "1d", interval = "1m", options = {}) {
  const url = new URL(`${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  if (options.includePrePost) url.searchParams.set("includePrePost", "true");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 quote-proxy" },
    cf: { cacheTtl: 20, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`Yahoo ${response.status}`);

  const payload = await response.json();
  const chart = payload.chart || {};
  if (chart.error) throw new Error(chart.error.description || "Yahoo chart error");
  const result = chart.result && chart.result[0];
  if (!result) throw new Error("No Yahoo chart result");
  return result;
}

function quoteFromChart(symbol, config, chart, options = {}) {
  const timestamps = chart.timestamp || [];
  const quote = chart.indicators && chart.indicators.quote && chart.indicators.quote[0];
  if (!timestamps.length || !quote) throw new Error("No quote rows");

  let latestIndex = -1;
  let latestFiniteIndex = -1;
  for (let index = timestamps.length - 1; index >= 0; index -= 1) {
    const close = asNumber(quote.close && quote.close[index]);
    if (latestFiniteIndex === -1 && close !== null) latestFiniteIndex = index;
    if (usableClose(close, config)) {
      latestIndex = index;
      break;
    }
  }
  if (latestIndex === -1) latestIndex = latestFiniteIndex;
  if (latestIndex === -1) throw new Error("No latest close");

  const meta = chart.meta || {};
  let close = asNumber(quote.close[latestIndex]);
  let timestamp = timestamps[latestIndex] * 1000;
  const regularMarketPrice = asNumber(meta.regularMarketPrice);
  const regularMarketTime = asNumber(meta.regularMarketTime);
  if (!usableClose(close, config) && regularMarketPrice !== null && regularMarketPrice > 0) {
    close = regularMarketPrice;
    if (regularMarketTime !== null) timestamp = regularMarketTime * 1000;
  }
  const session = options.includePrePost ? tradingSessionFromTimestamp(meta, timestamp) : "regular";
  const previousClose = previousCloseForChange(meta, session);
  const change = previousClose ? close - previousClose : null;
  const changePercent = previousClose && change !== null ? (change / previousClose) * 100 : null;

  return {
    symbol,
    name: meta.longName || meta.shortName || config.name,
    kind: config.kind,
    sourceSymbol: config.yahoo,
    currency: meta.currency,
    date: new Date(timestamp).toISOString().slice(0, 10),
    quoteTime: new Date(timestamp).toISOString(),
    session,
    marketState: meta.marketState || null,
    hasPrePostMarketData: Boolean(meta.hasPrePostMarketData),
    open: rounded(asNumber(quote.open && quote.open[latestIndex])),
    high: rounded(asNumber(quote.high && quote.high[latestIndex])),
    low: rounded(asNumber(quote.low && quote.low[latestIndex])),
    close: rounded(close),
    volume: volumeFromQuote(quote, latestIndex, meta, options),
    change: rounded(change),
    changePercent: rounded(changePercent)
  };
}

async function buildQuote(symbol) {
  const config = WATCHLIST[symbol] || { yahoo: symbol, name: symbol, kind: "stock" };
  try {
    const intraday = await fetchYahooChart(config.yahoo, "1d", "1m", { includePrePost: true });
    return quoteFromChart(symbol, config, intraday, { aggregateVolume: true, includePrePost: true });
  } catch (intradayError) {
    const daily = await fetchYahooChart(config.yahoo, "5d", "1d");
    return quoteFromChart(symbol, config, daily);
  }
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    if (url.pathname === "/options-flow") {
      try {
        return jsonResponse(await buildOptionsFlowResponse(url));
      } catch (error) {
        return jsonResponse({
          error: error && error.message ? error.message : "Options flow unavailable",
          simulated: true
        }, 502);
      }
    }
    const symbols = compactSymbols(url.searchParams.get("symbols")) || [];
    const requestedSymbols = symbols.length ? symbols : Object.keys(WATCHLIST);

    const settled = await Promise.allSettled(requestedSymbols.map(buildQuote));
    const quotes = settled.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      const symbol = requestedSymbols[index];
      const config = WATCHLIST[symbol] || { yahoo: symbol, name: symbol, kind: "stock" };
      return {
        symbol,
        name: config.name,
        kind: config.kind,
        sourceSymbol: config.yahoo,
        error: result.reason && result.reason.message ? result.reason.message : "quote failed"
      };
    });

    return jsonResponse({
      updatedAt: new Date().toISOString(),
      source: "Yahoo Finance chart endpoint via Cloudflare Worker",
      sourceUrl: YAHOO_CHART_URL,
      refreshSeconds: 30,
      symbols: quotes
    });
  }
};
