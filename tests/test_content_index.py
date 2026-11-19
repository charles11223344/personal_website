import tempfile
import unittest
from pathlib import Path

from scripts.build_content_index import DocumentParser, ROOT, build_index, find_symbols, parse_article, table_levels


class ContentIndexTests(unittest.TestCase):
    def test_symbol_boundaries_and_aliases(self):
        self.assertEqual(find_symbols("NVDA上涨，美光和MU；ADVGO不是AVGOX，CPI不是C。"), ["C", "MU", "NVDA"])
        self.assertEqual(find_symbols("NVIDIA is here, GOOGL上涨，谷歌"), ["GOOGL"])

    def test_structured_levels_and_missing_cell(self):
        parser = DocumentParser()
        parser.feed('<article><table><tr><th>股票</th><th>第一支撑</th><th>第二支撑</th><th>压力</th></tr>'
                    '<tr><td><b>MU</b></td><td>750</td><td>745</td><td>765 / 796</td></tr>'
                    '<tr><td>NVDA</td><td>150</td><td>145</td><td>—</td></tr></table></article>')
        self.assertEqual(table_levels(parser.root), [
            {"symbol": "MU", "support": "750 · 745", "resistance": "765 / 796"},
            {"symbol": "NVDA", "support": "150 · 145", "resistance": None},
        ])

    def test_does_not_infer_ambiguous_levels(self):
        parser = DocumentParser()
        parser.feed('<article><p>NVDA 150 / 165</p><table><tr><th>股票</th><th>观察区间</th></tr>'
                    '<tr><td>NVDA</td><td>150 / 165</td></tr></table></article>')
        self.assertEqual(table_levels(parser.root), [])

    def test_parser_ignores_script_and_resolves_entities(self):
        parser = DocumentParser()
        parser.feed('<div>A &amp; B<br><strong>MU</strong><script>NVDA</script><style>AVGO</style></div>')
        self.assertEqual(parser.root.text(), "A & B MU")

    def test_article_metadata_and_date(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "2026-11-16-example.html"
            path.write_text('<html><head><title>示例 | Lemon 美股手记</title><meta name="description" content="摘要"></head>'
                            '<body><div class="meta"><span>作者：清濛</span><span>财报</span></div>'
                            '<article><p>MU财报与现金流</p></article></body></html>', encoding="utf-8")
            article = parse_article(path)
            self.assertEqual(article["date"], "2026-11-16")
            self.assertEqual(article["title"], "示例")
            self.assertEqual(article["tags"], ["财报"])
            self.assertEqual(article["symbols"], ["MU"])
            self.assertIn("earnings", article["topics"])

    def test_missing_article_fails_loudly(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "2026-11-16-empty.html"
            path.write_text("<html><p>Incomplete</p></html>", encoding="utf-8")
            with self.assertRaises(ValueError):
                parse_article(path)

    def test_real_index_is_complete_and_deterministic(self):
        index = build_index()
        self.assertEqual(index, build_index())
        paths = list((ROOT / "articles").glob("????-??-??-*.html"))
        self.assertEqual(index["articleCount"], len(paths))
        self.assertEqual(len({article["url"] for article in index["articles"]}), len(paths))
        self.assertEqual([article["date"] for article in index["articles"]], sorted((article["date"] for article in index["articles"]), reverse=True))
        for article in index["articles"]:
            self.assertTrue((ROOT / article["url"]).is_file())
            self.assertTrue(article["title"])
            self.assertGreaterEqual(article["readingMinutes"], 1)
        self.assertTrue(any(item["symbol"] == "SPX" for item in index["symbols"]))

    def test_ant_scenarios_are_not_historical_levels(self):
        article = parse_article(ROOT / "articles" / "2026-11-18-midweek-nvda-ant-ipo.html")
        self.assertIn("ANT", article["symbols"])
        self.assertEqual(len(article["levels"]), 6)
        self.assertFalse(any(level["symbol"] == "ANT" for level in article["levels"]))
        nvda = next(level for level in article["levels"] if level["symbol"] == "NVDA")
        self.assertEqual(nvda["support"], "148.8")
        self.assertEqual(nvda["resistance"], "155.5—160")
        self.assertEqual(article["date"], "2026-11-18")


if __name__ == "__main__":
    unittest.main()
