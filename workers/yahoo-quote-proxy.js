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
  TSM: { yahoo: "TSM", name: "Taiwan Semiconductor", kind: "stock" }
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

async function fetchYahooChart(yahooSymbol, range = "1d", interval = "1m") {
  const url = new URL(`${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);

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
  for (let index = timestamps.length - 1; index >= 0; index -= 1) {
    if (asNumber(quote.close && quote.close[index]) !== null) {
      latestIndex = index;
      break;
    }
  }
  if (latestIndex === -1) throw new Error("No latest close");

  const meta = chart.meta || {};
  const close = asNumber(quote.close[latestIndex]);
  const previousClose = asNumber(meta.chartPreviousClose);
  const change = previousClose ? close - previousClose : null;
  const changePercent = previousClose && change !== null ? (change / previousClose) * 100 : null;
  const timestamp = timestamps[latestIndex] * 1000;

  return {
    symbol,
    name: meta.longName || meta.shortName || config.name,
    kind: config.kind,
    sourceSymbol: config.yahoo,
    currency: meta.currency,
    date: new Date(timestamp).toISOString().slice(0, 10),
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
    const intraday = await fetchYahooChart(config.yahoo, "1d", "1m");
    return quoteFromChart(symbol, config, intraday, { aggregateVolume: true });
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
