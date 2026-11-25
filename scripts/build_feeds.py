"""Build sitemap.xml, feed.xml and per-article social meta from data/research.json.

Run after scripts/build_content_index.py. The script is idempotent: article heads
get a marked <!-- seo:start --> ... <!-- seo:end --> block that is replaced on
each run, and article bodies are never touched.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://ccccccharles.dpdns.org"
SITE_NAME = "Lemon 美股手记"
SITE_DESC = "每周美股预测、AI 科技股复盘、支撑压力位与市场数据看板。公众号「东左耳清濛」网页归档。"
OG_IMAGE = f"{SITE_URL}/market-vlog-hero.png"
STATIC_PAGES = [("", "daily", "1.0"), ("archive.html", "daily", "0.8"), ("stock.html", "weekly", "0.6")]
SEO_BLOCK = re.compile(r"\n?\s*<!-- seo:start -->.*?<!-- seo:end -->", re.S)


def load_articles() -> list[dict]:
    data = json.loads((ROOT / "data" / "research.json").read_text(encoding="utf-8"))
    return sorted(data.get("articles", []), key=lambda a: a.get("date", ""), reverse=True)


def attr(value: str) -> str:
    return escape(value or "", quote=True)


def build_sitemap(articles: list[dict]) -> str:
    latest = articles[0]["date"] if articles else datetime.now(timezone.utc).date().isoformat()
    rows = [
        f"  <url><loc>{SITE_URL}/{path}</loc><lastmod>{latest}</lastmod><changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        for path, freq, prio in STATIC_PAGES
    ]
    rows += [
        f"  <url><loc>{SITE_URL}/{a['url']}</loc><lastmod>{a['date']}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>"
        for a in articles
    ]
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"


def rfc822(date: str) -> str:
    return format_datetime(datetime.fromisoformat(date).replace(hour=8, tzinfo=timezone.utc))


def build_feed(articles: list[dict]) -> str:
    items = []
    for a in articles[:30]:
        link = f"{SITE_URL}/{a['url']}"
        categories = "".join(f"<category>{escape(t)}</category>" for t in a.get("tags", []))
        items.append(
            "    <item>"
            f"<title>{escape(a['title'])}</title>"
            f"<link>{link}</link><guid isPermaLink=\"true\">{link}</guid>"
            f"<pubDate>{rfc822(a['date'])}</pubDate>"
            f"<description>{escape(a.get('description', ''))}</description>{categories}"
            "</item>"
        )
    build_date = rfc822(articles[0]["date"]) if articles else format_datetime(datetime.now(timezone.utc))
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n'
        f"    <title>{SITE_NAME}</title>\n    <link>{SITE_URL}/</link>\n"
        f"    <description>{escape(SITE_DESC)}</description>\n    <language>zh-CN</language>\n"
        f"    <lastBuildDate>{build_date}</lastBuildDate>\n"
        f'    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />\n'
        + "\n".join(items)
        + "\n  </channel>\n</rss>\n"
    )


def seo_block(a: dict) -> str:
    url = f"{SITE_URL}/{a['url']}"
    title = a["title"]
    desc = a.get("description", "")
    ld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "description": desc,
        "datePublished": a["date"],
        "dateModified": a["date"],
        "inLanguage": "zh-CN",
        "url": url,
        "mainEntityOfPage": url,
        "image": OG_IMAGE,
        "keywords": ", ".join(a.get("tags", []) + a.get("symbols", [])),
        "author": {"@type": "Person", "name": "Lemon 清濛 · 东左耳清濛"},
        "publisher": {"@type": "Organization", "name": SITE_NAME, "logo": {"@type": "ImageObject", "url": f"{SITE_URL}/lemon.png"}},
    }
    lines = [
        "<!-- seo:start -->",
        f'<link rel="canonical" href="{url}" />',
        '<link rel="icon" type="image/png" href="../lemon.png" />',
        f'<link rel="alternate" type="application/rss+xml" title="{SITE_NAME} RSS" href="{SITE_URL}/feed.xml" />',
        '<meta name="theme-color" content="#111318" />',
        '<meta property="og:type" content="article" />',
        f'<meta property="og:site_name" content="{SITE_NAME}" />',
        '<meta property="og:locale" content="zh_CN" />',
        f'<meta property="og:url" content="{url}" />',
        f'<meta property="og:title" content="{attr(title)}" />',
        f'<meta property="og:description" content="{attr(desc)}" />',
        f'<meta property="og:image" content="{OG_IMAGE}" />',
        f'<meta property="article:published_time" content="{a["date"]}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{attr(title)}" />',
        f'<meta name="twitter:description" content="{attr(desc)}" />',
        f'<meta name="twitter:image" content="{OG_IMAGE}" />',
        '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace("</", "<\\/") + "</script>",
        "<!-- seo:end -->",
    ]
    return "\n" + "\n".join("  " + line for line in lines)


def inject_article_meta(articles: list[dict]) -> int:
    changed = 0
    for a in articles:
        path = ROOT / a["url"]
        if not path.exists():
            continue
        html = path.read_text(encoding="utf-8")
        cleaned = SEO_BLOCK.sub("", html)
        updated = re.sub(r"(<title>.*?</title>)", lambda m: m.group(1) + seo_block(a), cleaned, count=1, flags=re.S)
        if updated != html:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    articles = load_articles()
    (ROOT / "sitemap.xml").write_text(build_sitemap(articles), encoding="utf-8")
    (ROOT / "feed.xml").write_text(build_feed(articles), encoding="utf-8")
    changed = inject_article_meta(articles)
    print(f"sitemap.xml + feed.xml: {len(articles)} articles; article heads updated: {changed}")


if __name__ == "__main__":
    main()
