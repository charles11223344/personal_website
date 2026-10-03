from __future__ import annotations

import json
import math
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from update_options_flow import apply_model


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "options-flow.json"
CBOE_OPTIONS_URL = "https://cdn-api.cboe.com/api/global/delayed_quotes/options"
CBOE_PAGE_URL = "https://www.cboe.com/delayed_quotes/"
WATCHLIST = [
    "MU", "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN",
    "META", "TSLA", "AMD", "AVGO", "PLTR", "TSM",
]
OPTION_SYMBOL_PATTERN = re.compile(r"^(.+?)(\d{6})([CP])(\d{8})$")


def as_number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def fetch_chain(symbol: str) -> dict:
    request = urllib.request.Request(
        f"{CBOE_OPTIONS_URL}/{urllib.parse.quote(symbol)}.json",
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 Lemon-Market-Notes/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def eastern_timestamp(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
        try:
            parsed = parsed.replace(tzinfo=ZoneInfo("America/New_York"))
        except ZoneInfoNotFoundError:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")
    except ValueError:
        return None


def option_parts(option_symbol: str) -> tuple[date, str] | None:
    match = OPTION_SYMBOL_PATTERN.match(option_symbol)
    if not match:
        return None
    try:
        expiry = datetime.strptime(match.group(2), "%y%m%d").date()
    except ValueError:
        return None
    return expiry, match.group(3)


def collect_symbol(symbol: str) -> dict:
    payload = fetch_chain(symbol)
    data = payload.get("data") or {}
    options = data.get("options") or []
    as_of = eastern_timestamp(data.get("last_trade_time"))
    if not as_of:
        raise ValueError("Missing Cboe underlying timestamp")
    report_date = datetime.fromisoformat(as_of).date()

    call_volume = 0
    put_volume = 0
    call_oi = 0
    put_oi = 0
    weighted_dte = 0
    expiry_oi: dict[str, int] = {}

    for option in options:
        parts = option_parts(str(option.get("option") or ""))
        if not parts:
            continue
        expiry, option_type = parts
        if expiry < report_date:
            continue
        volume = max(round(as_number(option.get("volume")) or 0), 0)
        open_interest = max(round(as_number(option.get("open_interest")) or 0), 0)
        dte = (expiry - report_date).days
        expiry_key = expiry.isoformat()

        if option_type == "C":
            call_volume += volume
            call_oi += open_interest
        else:
            put_volume += volume
            put_oi += open_interest

        weighted_dte += open_interest * dte
        expiry_oi[expiry_key] = expiry_oi.get(expiry_key, 0) + open_interest

    total_volume = call_volume + put_volume
    total_oi = call_oi + put_oi
    if total_volume <= 0:
        raise ValueError("No current-session option volume")

    spot = as_number(data.get("current_price"))
    multiplier = spot * 100 if spot and spot > 0 else 0
    dominant_expiry = max(expiry_oi, key=expiry_oi.get) if expiry_oi else None
    dominant_dte = (
        (date.fromisoformat(dominant_expiry) - report_date).days
        if dominant_expiry
        else None
    )

    return {
        "symbol": symbol,
        "dataAsOf": as_of,
        "callVolume": call_volume,
        "putVolume": put_volume,
        "callOpenInterest": call_oi,
        "putOpenInterest": put_oi,
        "weightedDte": round(weighted_dte / total_oi) if total_oi else None,
        "dominantExpiry": dominant_expiry,
        "dominantDte": dominant_dte,
        "totalVolume": total_volume,
        "totalOpenInterest": total_oi,
        "callPutRatio": round(call_volume / put_volume, 2) if put_volume else None,
        "volumeOi": round(total_volume / total_oi, 4) if total_oi else None,
        "spotPrice": round(spot, 4) if spot else None,
        "callFlow": round(call_volume * multiplier),
        "putFlow": round(put_volume * multiplier),
        "estimatedNotional": round(total_volume * multiplier),
    }


def main() -> int:
    rows = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(collect_symbol, symbol): symbol for symbol in WATCHLIST}
        for future in as_completed(futures):
            symbol = futures[future]
            try:
                rows.append(future.result())
            except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
                print(f"{symbol}: {exc}", file=sys.stderr)

    if len(rows) < 4:
        print("Cboe delayed data was unavailable for most symbols.", file=sys.stderr)
        return 1

    newest_as_of = max(row["dataAsOf"] for row in rows)
    report_date = datetime.fromisoformat(newest_as_of).date()
    rows = [row for row in rows if row["dataAsOf"][:10] == report_date.isoformat()]
    if len(rows) < 4:
        print("Cboe delayed data was stale for most symbols.", file=sys.stderr)
        return 1

    summaries, signals = apply_model(rows, report_date)
    as_of_by_symbol = {row["symbol"]: row["dataAsOf"] for row in rows}
    for item in summaries:
        item["dataAsOf"] = as_of_by_symbol.get(item["symbol"])
    for item in signals:
        item["dataAsOf"] = as_of_by_symbol.get(item["symbol"])

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataDate": report_date.isoformat(),
        "dataAsOf": newest_as_of,
        "delayMinutes": 15,
        "refreshCadenceMinutes": 60,
        "source": "Cboe delayed options chain snapshot",
        "sourceUrl": CBOE_PAGE_URL,
        "sourceType": "delayed-snapshot",
        "isInstitutionalFlow": False,
        "methodology": {
            "flow": "Call/Put contract volume multiplied by the delayed underlying price and 100; this is underlying notional, not option premium.",
            "volumeOi": "Current-day cumulative option volume divided by reported open interest.",
            "dte": "Open-interest-weighted calendar days to expiration.",
            "riskScore": "Lemon model: Volume/OI 40%, relative volume 20%, relative notional 15%, Call/Put skew 15%, DTE 10%.",
        },
        "symbols": summaries,
        "signals": signals,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(signals)} Cboe delayed symbols for {newest_as_of} in {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
