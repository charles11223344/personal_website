from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass, field
from datetime import date
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SYMBOL_NAMES = {
    "NVDA": "NVIDIA", "MU": "Micron Technology", "AMD": "Advanced Micro Devices",
    "AVGO": "Broadcom", "MRVL": "Marvell", "COHR": "Coherent", "LITE": "Lumentum",
    "NBIS": "Nebius", "SOXL": "Direxion Daily Semiconductor Bull 3X ETF",
    "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
    "META": "Meta Platforms", "TSLA": "Tesla", "PLTR": "Palantir", "TSM": "Taiwan Semiconductor",
    "SPX": "S&P 500 Index", "SPY": "SPDR S&P 500 ETF", "QQQ": "Invesco QQQ ETF",
    "SPCX": "SPCX", "SMH": "VanEck Semiconductor ETF", "SOXX": "iShares Semiconductor ETF",
    "SNDK": "Sandisk", "WDC": "Western Digital", "STX": "Seagate", "AMAT": "Applied Materials",
    "LRCX": "Lam Research", "KLAC": "KLA", "ASML": "ASML", "QCOM": "Qualcomm",
    "VRT": "Vertiv", "ETN": "Eaton", "GEV": "GE Vernova", "CEG": "Constellation Energy",
    "VST": "Vistra", "OKLO": "Oklo", "GLW": "Corning", "APH": "Amphenol", "TEL": "TE Connectivity",
    "CRDO": "Credo", "ALAB": "Astera Labs", "CRWV": "CoreWeave", "IREN": "IREN", "HUT": "Hut 8",
    "RKLB": "Rocket Lab", "ASTS": "AST SpaceMobile", "BWXT": "BWX Technologies", "CCJ": "Cameco",
    "SMR": "NuScale Power", "NNE": "NANO Nuclear Energy", "INTC": "Intel", "ARM": "Arm",
    "CSCO": "Cisco", "NOW": "ServiceNow", "NET": "Cloudflare", "PANW": "Palo Alto Networks",
    "CRM": "Salesforce", "CRWD": "CrowdStrike", "ORCL": "Oracle", "IBM": "IBM",
    "TXN": "Texas Instruments", "MPWR": "Monolithic Power Systems", "HPE": "Hewlett Packard Enterprise",
    "DELL": "Dell Technologies", "SHOP": "Shopify", "APLD": "Applied Digital",
    "XOM": "Exxon Mobil", "CVX": "Chevron", "SLB": "SLB", "XLE": "Energy Select Sector SPDR ETF",
    "GDX": "VanEck Gold Miners ETF", "GLD": "SPDR Gold Shares", "AEM": "Agnico Eagle Mines",
    "SU": "Suncor Energy", "ENB": "Enbridge", "WMT": "Walmart", "C": "Citigroup",
    "JPM": "JPMorgan Chase", "BAC": "Bank of America", "GS": "Goldman Sachs", "WFC": "Wells Fargo",
    "IWM": "iShares Russell 2000 ETF", "RSP": "Invesco S&P 500 Equal Weight ETF",
    "NXPI": "NXP Semiconductors", "ADI": "Analog Devices", "MCHP": "Microchip Technology",
    "AMKR": "Amkor Technology", "NOK": "Nokia", "AAOI": "Applied Optoelectronics",
    "NFLX": "Netflix", "WDAY": "Workday", "INTU": "Intuit", "ZM": "Zoom", "LLY": "Eli Lilly",
}
ALIASES = {
    "NVDA": ["英伟达", "英偉達"], "MU": ["美光", "Micron"], "AVGO": ["博通"],
    "MSFT": ["微软", "微軟"], "GOOGL": ["谷歌"], "AMZN": ["亚马逊", "亞馬遜"],
    "AAPL": ["苹果", "蘋果"], "TSLA": ["特斯拉"], "TSM": ["台积电", "台積電"],
}
ETFS = {"SPY", "QQQ", "SMH", "SOXX", "SOXL", "XLE", "GDX", "GLD", "IWM", "RSP"}
FEATURED = ["NVDA", "MU", "AMD", "AVGO", "MRVL", "COHR", "NBIS", "SOXL"]
TOPICS = [
    ("ai", "AI 与半导体", ["AI", "半导体", "硬件", "存储", "光通信", "HBM"]),
    ("macro", "宏观与利率", ["宏观", "利率", "非农", "CPI", "PCE", "Fed", "FOMC", "美债"]),
    ("earnings", "财报观察", ["财报", "业绩", "营收", "EPS", "指引"]),
    ("cashflow", "融资与现金流", ["融资", "现金流", "CapEx", "IPO", "资本开支"]),
    ("energy", "黄金与能源", ["黄金", "金价", "核电", "电力", "油价", "能源"]),
    ("review", "交易与复盘", ["复盘", "仓位", "杠杆", "技术位", "支撑", "压力"]),
    ("policy", "政策与选举", ["选举", "监管", "关税", "政策"]),
]
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def text(self) -> str:
        if self.tag in {"script", "style"}:
            return ""
        return compact(" ".join(child.text() if isinstance(child, Node) else child for child in self.children))

    def has_class(self, value: str) -> bool:
        return value in self.attrs.get("class", "").split()


class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def find_symbols(text: str) -> list[str]:
    return sorted(symbol for symbol in SYMBOL_NAMES if
                  re.search(rf"(?<![A-Za-z0-9]){re.escape(symbol)}(?![A-Za-z0-9])", text)
                  or any(alias in text for alias in ALIASES.get(symbol, [])))


def table_levels(article: Node) -> list[dict]:
    levels = []
    for table in (node for node in article.walk() if node.tag == "table"):
        rows = [[node.text() for node in row.children if isinstance(node, Node) and node.tag in {"td", "th"}]
                for row in table.walk() if row.tag == "tr"]
        if not rows:
            continue
        supports = [i for i, heading in enumerate(rows[0]) if "支撑" in heading]
        resistances = [i for i, heading in enumerate(rows[0]) if "压力" in heading]
        if not supports or not resistances:
            continue
        for row in rows[1:]:
            if not row:
                continue
            match = re.match(r"([A-Z][A-Z0-9.-]*)(?![A-Za-z0-9])", row[0])
            symbol = match.group(1) if match else None
            if symbol not in SYMBOL_NAMES:
                continue
            def values(indices):
                return " · ".join(row[i] for i in indices if i < len(row) and re.search(r"\d", row[i])) or None
            support, resistance = values(supports), values(resistances)
            if support or resistance:
                levels.append({"symbol": symbol, "support": support, "resistance": resistance})
    return levels


def parse_article(path: Path) -> dict:
    parser = DocumentParser()
    parser.feed(path.read_text(encoding="utf-8"))
    nodes = list(parser.root.walk())
    article = next((node for node in nodes if node.tag == "article"), None)
    if article is None:
        raise ValueError(f"Missing article element: {path.name}")
    title_node = next((node for node in nodes if node.tag == "title"), None)
    title = title_node.text().rsplit(" | ", 1)[0] if title_node else path.stem
    article_date = date.fromisoformat(path.name[:10]).isoformat()
    description = next((node.attrs.get("content", "") for node in nodes
                        if node.tag == "meta" and node.attrs.get("name") == "description"), "")
    meta = next((node for node in nodes if node.has_class("meta")), Node("div"))
    tags = [node.text() for node in meta.walk() if node.tag == "span" and not node.text().startswith("作者")]
    text = article.text()
    headline = title + " " + " ".join(tags)
    scored = []
    for key, label, words in TOPICS:
        score = sum(3 for word in words if word.casefold() in headline.casefold())
        score += sum(1 for word in words if word.casefold() in text.casefold())
        if score:
            scored.append((score, key))
    topic_ids = [key for _, key in sorted(scored, key=lambda item: -item[0])[:3]]
    chinese_count = len(re.findall(r"[\u3400-\u9fff]", text))
    word_count = len(re.findall(r"[A-Za-z0-9]+", text))
    return {
        "url": "articles/" + path.name, "date": article_date, "title": title,
        "description": compact(description) or text[:140], "tags": tags,
        "topics": topic_ids, "symbols": find_symbols(text + " " + headline),
        "readingMinutes": max(1, math.ceil(chinese_count / 450 + word_count / 220)),
        "searchText": text, "levels": table_levels(article),
    }


def build_index(root: Path = ROOT) -> dict:
    articles = [parse_article(path) for path in sorted((root / "articles").glob("????-??-??-*.html"))]
    articles.sort(key=lambda item: (item["date"], item["url"]), reverse=True)
    symbols = []
    for symbol, name in SYMBOL_NAMES.items():
        count = sum(symbol in article["symbols"] for article in articles)
        if count or symbol == "SPX":
            symbols.append({"symbol": symbol, "name": name, "articleCount": count,
                            "aliases": ALIASES.get(symbol, []),
                            "kind": "index" if symbol == "SPX" else "etf" if symbol in ETFS else "stock"})
    return {
        "schemaVersion": 1, "articleCount": len(articles),
        "latestArticleDate": articles[0]["date"] if articles else None,
        "topics": [{"id": key, "label": label} for key, label, _ in TOPICS],
        "featuredSymbols": [symbol for symbol in FEATURED if any(item["symbol"] == symbol for item in symbols)],
        "symbols": symbols, "articles": articles,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the static article and stock research index.")
    parser.add_argument("--check", action="store_true", help="Fail if the committed index is outdated.")
    args = parser.parse_args()
    output = ROOT / "data" / "research.json"
    content = json.dumps(build_index(), ensure_ascii=False, indent=2) + "\n"
    existing = output.read_text(encoding="utf-8") if output.exists() else None
    if existing != content:
        if args.check:
            print("Research index is outdated; run scripts/build_content_index.py")
            return 1
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(content, encoding="utf-8", newline="\n")
    print(f"Indexed {json.loads(content)['articleCount']} articles in {output.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
