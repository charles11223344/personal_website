# Lemon 美股手记

这是一个静态个人网站，用来归档美股研究、微信公众号文章、视频脚本和市场复盘。站点保留原来的 Lemon 品牌视觉，并把它延展成美股内容站的识别系统。

## 内容结构

- 美股市场笔记：财报拆解、行业叙事、估值坐标和交易复盘。
- 每日美股数据：页面读取 `data/stocks.json`，展示 SPX、SPY、QQQ、SPCX、MU、NVDA 等观察列表。
- Lemon 品牌：继续使用 `lemon.png` 作为页眉、首屏和站点品牌图。
- 文章归档：`archive.html` 支持全文关键词、股票、主题、月份筛选和时间排序，筛选链接可以分享；首页只展示最新十篇。
- 股票专题：`stock.html?symbol=NVDA` 汇总单一标的的历史文章、原文技术位、行情与已维护的事件日历。
- 独立文章页：公众号文章放在 `articles/` 目录，首页文章卡片链接到对应页面。
- Vlog 脚本：把长文观点转成适合视频号、YouTube 或短视频的脚本结构。
- 天气模块：使用无密钥的 Open-Meteo 接口显示 Toronto 当前天气。
- 风险雷达：通过行情 Worker 展示 VIX、10年期美债、美元指数、油价和黄金，并自动标记风险升温、美元压力、通胀风险等状态。
- 财报与宏观日历：由 `market-calendar.js` 内的 `marketCalendarEvents` 统一维护，首页和股票专题共用；不自动推测未收录的财报日期。
- 比特币数据：保留原页面的 CoinGecko 实时价格模块，显示 BTC 和 ETH 的 CAD 报价。
- 订阅与合作：继续使用 Formspree 表单收集邮箱和留言。

## 股票数据更新

`scripts/update_stock_data.py` 会从 Yahoo Finance chart endpoint 拉取最近 5 个交易日数据，计算最新收盘价、涨跌额、涨跌幅和成交量，然后写入 `data/stocks.json`。

GitHub Actions 配置在 `.github/workflows/update-stock-data.yml`，美股交易时段约每小时运行一次，并在下一个工作日上午补抓日终数据；也可以在 GitHub Actions 页面手动触发。

手动本地更新：

```powershell
py scripts/update_stock_data.py
```

如果要调整观察列表，编辑 `scripts/update_stock_data.py` 里的 `WATCHLIST`。

## 添加公众号文章

新增文章建议放到 `articles/` 目录，然后在首页 `#articles` 区块新增或更新文章卡片。

文章文件名使用 `YYYY-MM-DD-slug.html`，正文放在 `<article>` 内，保留 `<title>`、摘要和原文链接。新增后运行：

```powershell
py scripts/build_content_index.py
py -m unittest discover -s tests -p test_content_index.py
```

生成的 `data/research.json` 包含全文检索索引、股票关联、主题和明确标注的表格技术位，不修改文章正文或旧链接。主题按关键词分类；股票识别词表在 `scripts/build_content_index.py`。技术位仅提取同时有“支撑”和“压力”列的表格，不猜测叙述中的数字，并在专题页标明原文日期。

推送文章到 `main` 后，`.github/workflows/update-content-index.yml` 自动重建并提交索引；可在 Actions 手动运行。首页最新十篇卡片仍按原方式维护。索引不依赖 Worker，现有行情 Worker 无需重新部署。

浏览器测试：安装 Playwright 后运行 `node tests/research-browser.cjs`。它会启动并关闭临时静态服务器；可用 `PLAYWRIGHT_MODULE` 指定已安装的 Playwright 路径，用 `TEST_ARTIFACTS` 指定截图目录。

当前已添加：

- `articles/2026-11-16-nvda-fed-ipo-week.html`
- `articles/2026-11-08-cpi-ai-earnings-volatility.html`
- `articles/2026-11-04-midweek-ai-regulation-cashflow.html`
- `articles/2026-11-01-election-amd-jobs-week.html`
- `articles/2026-10-28-midweek-rates-ai-earnings.html`
- `articles/2026-10-25-fomc-earnings-gap-up-fade.html`
- `articles/2026-10-21-midweek-tech-earnings-volatility.html`
- `articles/2026-10-18-earnings-rebound-outlook.html`
- `articles/2026-10-14-cpi-ai-financing-selloff.html`
- `articles/2026-10-11-cpi-earnings-week.html`
- `articles/2026-10-07-midweek-bond-auction-ai.html`
- `articles/2026-10-04-ai-concentration-week.html`
- `articles/2026-09-30-midweek-pce-mu-gold.html`
- `articles/2026-09-27-pce-mu-jobs-week.html`
- `articles/2026-09-23-midweek-yields-ai-levels.html`
- `articles/2026-09-20-tech-rebound-gold-defense.html`
- `articles/2026-09-15-fed-48h-defense-guide.html`
- `articles/2026-09-13-fomc-oil-ai-valuation.html`
- `articles/2026-09-09-midweek-cpi-oil-rates.html`
- `articles/2026-09-07-cpi-oil-ai-rotation.html`
- `articles/2026-09-02-midweek-jobs-gold-ai.html`
- `articles/2026-08-30-jobs-rates-oil-ai.html`
- `articles/2026-08-26-nvda-ai-demand-financing.html`
- `articles/2026-08-23-pce-nvda-ai-capex.html`
- `articles/2026-08-19-treasury-buyback-yields-gold-ai.html`
- `articles/2026-08-16-10y-retail-earnings-oil.html`
- `articles/2026-08-12-midweek-ai-bottleneck-burry.html`
- `articles/2026-08-10-market-recap-cpi-ai-compute-finance.html`
- `articles/2026-08-09-cpi-brent-10y-ai-second-test.html`
- `articles/2026-08-05-midweek-dow-record-capex.html`
- `articles/2026-08-02-oil-cooling-jobs-rates-cashflow.html`
- `articles/2026-07-29-midweek-bloodbath-model.html`
- `articles/2026-07-26-fomc-gdp-pce-ai-cashflow.html`
- `articles/2026-07-22-google-cloud-cash-flow.html`
- `articles/2026-07-19-oil-earnings-ai-stopfall.html`
- `articles/2026-07-12-oil-inflation-ai-orders.html`
- `articles/2026-07-07-midweek-rotation.html`
- `articles/2026-07-05-weekly-script-ai-rotation.html`
- `articles/2026-06-28-ai-power-infrastructure.html`
- `articles/2026-06-24-mu-pce-exam.html`
- `articles/2026-06-23-midweek-mu-earnings.html`
- `articles/2026-06-21-ai-hardware-week.html`

公众号二维码图片当前使用项目根目录的 `qrcode.jpg`。首页和文章页都会读取这个文件；如果文件不存在，会显示提示占位。

## 准实时股票刷新

首页与股票专题均可先读取 `data/stocks.json`，然后尝试 Worker 报价；股票专题在页面可见时每 30 秒刷新，失败保留快照并标明状态，不把缺失价格显示为零。

由于 GitHub Pages 是纯静态站，浏览器不能稳定地直接跨域请求 Yahoo Finance。仓库里提供了一个 Cloudflare Worker 代理示例：

- Worker 文件：`workers/yahoo-quote-proxy.js`
- 部署后会提供类似 `https://your-worker.workers.dev/` 的接口
- 然后把 `site-config.js` 里的 `LEMON_CONFIG.quoteEndpoint` 改成你的 Worker URL

示例：

```js
const LEMON_CONFIG = Object.freeze({ quoteEndpoint: "https://your-worker.workers.dev/" });
```

这样页面会请求：

```text
https://your-worker.workers.dev/?symbols=SPX,SPY,QQQ,SPCX,MU,NVDA,AAPL,MSFT,GOOGL,AMZN,META,TSLA,AMD,AVGO,PLTR,TSM
```

## 访问统计

页脚已预留访问统计展示：总访问量和匿名访客数。默认未配置时显示“统计待配置”。

访问统计需要单独部署 `workers/visitor-counter.js`，并在 Cloudflare Worker 里绑定一个 KV namespace：

- KV binding name: `VISITOR_COUNTER`
- Worker route: `POST /hit` 会记录一次访问
- Worker route: `GET /stats` 会读取当前统计

部署完成后，把 `app.js` 里的 `VISITOR_COUNTER_ENDPOINT` 改成你的 Worker URL：

```js
const VISITOR_COUNTER_ENDPOINT = "https://your-counter-worker.workers.dev/";
```

这个计数器不会保存 IP。页面只会在浏览器本地生成一个匿名 visitor ID，用来粗略区分访客。Cloudflare KV 不是强一致计数器，高并发场景需要换 Durable Object 或 D1。

## 延迟期权活动雷达

`scripts/update_options_flow_live.py` 从 Cboe 延迟期权链读取核心关注股票的当日累计
Call/Put 成交量与未平仓量，生成 `data/options-flow.json`。GitHub Actions 在美股交易时段
约每小时更新一次。如果 Cboe 快照不可用，任务会自动运行 `scripts/update_options_flow.py`，
回退到 OCC 官方日终报告。

页面展示：

- Call 与 Put 标的名义金额估算
- Call/Put 成交量比率
- 总成交量 / 前一结算日 OI
- OI 加权 DTE 与主要到期日
- 由 Volume/OI、相对成交量、相对名义金额、Call/Put 偏斜和 DTE 合成的清濛模型评分

这不是逐笔订单流，也不能识别机构身份。Cboe 页面数据按其标注属于延迟快照，网站会
显示来源和截至时间。名义金额按 `合约量 × 延迟标的价格 × 100` 估算，不是期权权利金；
Call/Put 偏向也不等于最终看涨或看跌方向。

## 部署

这个站点只有静态文件，可以直接通过 GitHub Pages 或任意静态托管服务部署。当前自定义域名配置保留在 `CNAME`。

刷新按钮使用 Lucide 的 `refresh-cw` 图标，许可证见 `assets/LUCIDE-LICENSE`。
