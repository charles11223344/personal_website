from __future__ import annotations

import json
import math
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "stocks.json"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"

WATCHLIST = [
    {"symbol": "SPX", "yahoo": "^GSPC", "name": "S&P 500 Index", "kind": "index"},
    {"symbol": "SPY", "yahoo": "SPY", "name": "SPDR S&P 500 ETF", "kind": "etf"},
    {"symbol": "QQQ", "yahoo": "QQQ", "name": "Invesco QQQ ETF", "kind": "etf"},
    {"symbol": "SPCX", "yahoo": "SPCX", "name": "SPCX", "kind": "stock"},
    {"symbol": "MU", "yahoo": "MU", "name": "Micron Technology", "kind": "stock"},
    {"symbol": "NVDA", "yahoo": "NVDA", "name": "NVIDIA", "kind": "stock"},
    {"symbol": "AAPL", "yahoo": "AAPL", "name": "Apple", "kind": "stock"},
    {"symbol": "MSFT", "yahoo": "MSFT", "name": "Microsoft", "kind": "stock"},
    {"symbol": "GOOGL", "yahoo": "GOOGL", "name": "Alphabet Class A", "kind": "stock"},
    {"symbol": "AMZN", "yahoo": "AMZN", "name": "Amazon", "kind": "stock"},
    {"symbol": "META", "yahoo": "META", "name": "Meta Platforms", "kind": "stock"},
    {"symbol": "TSLA", "yahoo": "TSLA", "name": "Tesla", "kind": "stock"},
    {"symbol": "AMD", "yahoo": "AMD", "name": "Advanced Micro Devices", "kind": "stock"},
    {"symbol": "AVGO", "yahoo": "AVGO", "name": "Broadcom", "kind": "stock"},
    {"symbol": "PLTR", "yahoo": "PLTR", "name": "Palantir", "kind": "stock"},
    {"symbol": "TSM", "yahoo": "TSM", "name": "Taiwan Semiconductor", "kind": "stock"},
]


def read_existing() -> dict[str, dict]:
    if not OUTPUT_PATH.exists():
        return {}
    try:
        payload = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {
        item.get("symbol"): item
        for item in payload.get("symbols", [])
        if isinstance(item, dict) and item.get("symbol")
    }


def to_float(value) -> float | None:
    if value in (None, "", "N/D", "-"):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def to_int(value) -> int | None:
    number = to_float(value)
    return int(number) if number is not None else None


def rounded(value: float | None, digits: int = 2) -> float | None:
    return round(value, digits) if value is not None else None


def fetch_chart(yahoo_symbol: str) -> dict:
    encoded_symbol = urllib.parse.quote(yahoo_symbol, safe="")
    query = urllib.parse.urlencode({"range": "5d", "interval": "1d"})
    request = urllib.request.Request(
        f"{YAHOO_CHART_URL}/{encoded_symbol}?{query}",
        headers={"User-Agent": "Mozilla/5.0 stock-data-updater"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        text = response.read().decode("utf-8", errors="replace")
    payload = json.loads(text)

    chart = payload.get("chart", {})
    if chart.get("error"):
        description = chart["error"].get("description") or chart["error"]
        raise RuntimeError(description)
    results = chart.get("result") or []
    if not results:
        raise RuntimeError("no chart result")
    return results[0]


def rows_from_chart(chart: dict) -> list[dict]:
    timestamps = chart.get("timestamp") or []
    quote_blocks = chart.get("indicators", {}).get("quote") or []
    if not timestamps or not quote_blocks:
        return []

    quote = quote_blocks[0]
    rows = []
    for index, timestamp in enumerate(timestamps):
        close = to_float((quote.get("close") or [None])[index])
        if close is None:
            continue
        rows.append(
            {
                "timestamp": timestamp,
                "date": datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat(),
                "open": to_float((quote.get("open") or [None])[index]),
                "high": to_float((quote.get("high") or [None])[index]),
                "low": to_float((quote.get("low") or [None])[index]),
                "close": close,
                "volume": to_int((quote.get("volume") or [None])[index]),
            }
        )
    return rows


def build_quote(item: dict) -> dict:
    chart = fetch_chart(item["yahoo"])
    rows = rows_from_chart(chart)
    if not rows:
        raise RuntimeError("no price rows")

    meta = chart.get("meta", {})
    latest = rows[-1]
    previous = rows[-2] if len(rows) >= 2 else None
    close = latest["close"]
    previous_close = previous["close"] if previous else to_float(meta.get("chartPreviousClose"))
    change = close - previous_close if previous_close else None
    change_percent = (change / previous_close * 100) if change is not None and previous_close else None

    return {
        "symbol": item["symbol"],
        "name": meta.get("longName") or meta.get("shortName") or item["name"],
        "kind": item["kind"],
        "sourceSymbol": item["yahoo"],
        "currency": meta.get("currency"),
        "date": latest["date"],
        "open": rounded(latest["open"]),
        "high": rounded(latest["high"]),
        "low": rounded(latest["low"]),
        "close": rounded(close),
        "volume": latest["volume"],
        "change": rounded(change),
        "changePercent": rounded(change_percent),
    }


def main() -> int:
    existing = read_existing()
    quotes = []
    success_count = 0

    for item in WATCHLIST:
        try:
            quote = build_quote(item)
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
            quote = existing.get(item["symbol"], {**item})
            quote["error"] = f"update failed: {exc}"
            print(f"{item['symbol']}: {exc}", file=sys.stderr)
        else:
            success_count += 1
        quotes.append(quote)

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Yahoo Finance chart endpoint",
        "sourceUrl": YAHOO_CHART_URL,
        "symbols": quotes,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if success_count == 0:
        print("No stock data could be fetched.", file=sys.stderr)
        return 1

    print(f"Updated {success_count}/{len(WATCHLIST)} symbols in {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
