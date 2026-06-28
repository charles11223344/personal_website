const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

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
