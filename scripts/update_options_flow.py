from __future__ import annotations

import csv
import io
import json
import math
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STOCKS_PATH = ROOT / "data" / "stocks.json"
OUTPUT_PATH = ROOT / "data" / "options-flow.json"
OCC_BASE_URL = "https://marketdata.theocc.com"
WATCHLIST = [
    "SPX", "SPY", "QQQ", "SPCX", "MU", "NVDA", "AAPL", "MSFT",
    "GOOGL", "AMZN", "META", "TSLA", "AMD", "AVGO", "PLTR", "TSM",
]


def fetch_text(path: str, params: dict[str, str]) -> str:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{OCC_BASE_URL}/{path}?{query}",
        headers={"User-Agent": "Mozilla/5.0 Lemon-Market-Notes/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def trading_days_back(start: date, limit: int = 10):
    current = start
    checked = 0
    while checked < limit:
        if current.weekday() < 5:
            yield current
            checked += 1
        current -= timedelta(days=1)


def volume_rows(symbol: str, report_date: date) -> list[dict[str, str]]:
    text = fetch_text(
        "volume-query",
        {
            "reportDate": report_date.strftime("%Y%m%d"),
            "format": "csv",
            "volumeQueryType": "O",
            "symbolType": "U",
            "symbol": symbol,
            "reportType": "D",
            "accountType": "ALL",
            "productKind": "OSTK" if symbol != "SPX" else "OIND",
            "porc": "BOTH",
        },
    )
    if "No record(s) found" in text:
        return []
    return list(csv.DictReader(io.StringIO(text)))


def find_latest_report_date() -> date:
    today = datetime.now(timezone.utc).date()
    for candidate in trading_days_back(today):
        try:
            if volume_rows("SPY", candidate):
                return candidate
        except (urllib.error.URLError, TimeoutError):
            continue
    raise RuntimeError("No recent OCC volume report was available")


def read_spot_prices() -> dict[str, float]:
    try:
        payload = json.loads(STOCKS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    prices = {}
    for item in payload.get("symbols", []):
        try:
            close = float(item.get("close"))
        except (TypeError, ValueError):
            continue
        if math.isfinite(close) and close > 0:
            prices[str(item.get("symbol", "")).upper()] = close
    return prices


def parse_volume(symbol: str, report_date: date) -> dict:
    calls = 0
    puts = 0
    for row in volume_rows(symbol, report_date):
        try:
            quantity = int(row.get("quantity", 0))
        except (TypeError, ValueError):
            continue
        option_type = str(row.get("porc", "")).strip().upper()
        if option_type == "C":
            calls += quantity
        elif option_type == "P":
            puts += quantity
    # Account-type rows describe both sides of each cleared trade.
    return {"callVolume": round(calls / 2), "putVolume": round(puts / 2)}


def parse_open_interest(symbol: str, report_date: date) -> dict:
    text = fetch_text("series-search", {"symbolType": "U", "symbol": symbol})
    call_oi = 0
    put_oi = 0
    weighted_dte = 0
    expiry_oi: dict[str, int] = {}

    for line in text.splitlines():
        fields = line.split()
        if len(fields) < 11 or fields[6:8] != ["C", "P"]:
            continue
        try:
            expiry = date(int(fields[1]), int(fields[2]), int(fields[3]))
            row_call_oi = int(fields[8].replace(",", ""))
            row_put_oi = int(fields[9].replace(",", ""))
        except (TypeError, ValueError):
            continue
        dte = max((expiry - report_date).days, 0)
        row_oi = row_call_oi + row_put_oi
        call_oi += row_call_oi
        put_oi += row_put_oi
        weighted_dte += row_oi * dte
        expiry_key = expiry.isoformat()
        expiry_oi[expiry_key] = expiry_oi.get(expiry_key, 0) + row_oi

    total_oi = call_oi + put_oi
    dominant_expiry = max(expiry_oi, key=expiry_oi.get) if expiry_oi else None
    dominant_dte = (
        max((date.fromisoformat(dominant_expiry) - report_date).days, 0)
        if dominant_expiry
        else None
    )
    return {
        "callOpenInterest": call_oi,
        "putOpenInterest": put_oi,
        "weightedDte": round(weighted_dte / total_oi) if total_oi else None,
        "dominantExpiry": dominant_expiry,
        "dominantDte": dominant_dte,
    }


def collect_symbol(symbol: str, report_date: date, spots: dict[str, float]) -> dict:
    volume = parse_volume(symbol, report_date)
    open_interest = parse_open_interest(symbol, report_date)
    call_volume = volume["callVolume"]
    put_volume = volume["putVolume"]
    total_volume = call_volume + put_volume
    total_oi = open_interest["callOpenInterest"] + open_interest["putOpenInterest"]
    spot = spots.get(symbol)
    multiplier = spot * 100 if spot else 0

    return {
        "symbol": symbol,
        **volume,
        **open_interest,
        "totalVolume": total_volume,
        "totalOpenInterest": total_oi,
        "callPutRatio": round(call_volume / put_volume, 2) if put_volume else None,
        "volumeOi": round(total_volume / total_oi, 4) if total_oi else None,
        "spotPrice": spot,
        "callFlow": round(call_volume * multiplier),
        "putFlow": round(put_volume * multiplier),
        "estimatedNotional": round(total_volume * multiplier),
    }


def percentile_rank(values: list[float], value: float) -> float:
    if len(values) <= 1:
        return 1.0
    ordered = sorted(values)
    lower = sum(1 for item in ordered if item < value)
    equal = sum(1 for item in ordered if item == value)
    return (lower + max(equal - 1, 0) / 2) / (len(ordered) - 1)


def apply_model(rows: list[dict], report_date: date) -> tuple[list[dict], list[dict]]:
    volumes = [float(row["totalVolume"]) for row in rows]
    notionals = [float(row["estimatedNotional"]) for row in rows]
    summaries = []
    signals = []

    for row in rows:
        ratio = row["callPutRatio"]
        volume_oi = row["volumeOi"] or 0
        dte = row["weightedDte"]
        activity_score = min(volume_oi / 0.5, 1) * 40
        volume_score = percentile_rank(volumes, float(row["totalVolume"])) * 20
        notional_score = percentile_rank(notionals, float(row["estimatedNotional"])) * 15
        skew_score = 0
        if ratio is not None and ratio > 0:
            skew_score = min(abs(math.log(ratio)) / math.log(3), 1) * 15
        dte_score = 10 if dte is not None and dte <= 14 else 7 if dte is not None and dte <= 30 else 4 if dte is not None and dte <= 90 else 2
        risk_score = round(activity_score + volume_score + notional_score + skew_score + dte_score)
        unusual = risk_score >= 65 or volume_oi >= 0.5

        if ratio is None:
            direction = "Call偏强" if row["callVolume"] else "无成交"
        elif ratio >= 1.2:
            direction = "Call偏强"
        elif ratio <= 0.83:
            direction = "Put偏强"
        else:
            direction = "相对均衡"

        summary = {
            **row,
            "direction": direction,
            "riskScore": risk_score,
            "riskLevel": "high" if risk_score >= 75 else "medium" if risk_score >= 50 else "low",
            "unusual": unusual,
        }
        summaries.append(summary)
        signals.append(
            {
                "dataDate": report_date.isoformat(),
                "symbol": row["symbol"],
                "direction": direction,
                "expiry": row["dominantExpiry"],
                "daysToExpiry": row["weightedDte"],
                "dominantDte": row["dominantDte"],
                "totalSize": row["estimatedNotional"],
                "volume": row["totalVolume"],
                "openInterest": row["totalOpenInterest"],
                "volumeOi": row["volumeOi"],
                "callVolume": row["callVolume"],
                "putVolume": row["putVolume"],
                "callPutRatio": row["callPutRatio"],
                "riskScore": risk_score,
                "riskLevel": summary["riskLevel"],
                "unusual": unusual,
            }
        )

    summaries.sort(key=lambda item: item["riskScore"], reverse=True)
    signals.sort(key=lambda item: item["riskScore"], reverse=True)
    return summaries, signals


def main() -> int:
    try:
        report_date = find_latest_report_date()
    except RuntimeError as exc:
        print(exc, file=sys.stderr)
        return 1

    spots = read_spot_prices()
    rows = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(collect_symbol, symbol, report_date, spots): symbol
            for symbol in WATCHLIST
        }
        for future in as_completed(futures):
            symbol = futures[future]
            try:
                row = future.result()
            except (urllib.error.URLError, TimeoutError, ValueError) as exc:
                print(f"{symbol}: {exc}", file=sys.stderr)
                continue
            if row["totalVolume"] or row["totalOpenInterest"]:
                rows.append(row)

    if not rows:
        print("No OCC options activity could be collected.", file=sys.stderr)
        return 1

    summaries, signals = apply_model(rows, report_date)
    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataDate": report_date.isoformat(),
        "source": "OCC public end-of-day volume and open-interest reports",
        "sourceUrl": "https://www.theocc.com/market-data/market-data-reports/volume-and-open-interest/daily-volume",
        "sourceType": "official-eod",
        "isInstitutionalFlow": False,
        "methodology": {
            "flow": "Call/Put contract volume multiplied by underlying close and 100; this is underlying notional, not option premium.",
            "volumeOi": "Total daily option volume divided by previous-settlement open interest.",
            "dte": "Open-interest-weighted calendar days to expiration.",
            "riskScore": "Lemon model: Volume/OI 40%, relative volume 20%, relative notional 15%, Call/Put skew 15%, DTE 10%.",
        },
        "symbols": summaries,
        "signals": signals,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(signals)} OCC symbols for {report_date} in {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
