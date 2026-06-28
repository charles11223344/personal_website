# Lemon 美股手记

这是一个静态个人网站，用来归档美股研究、微信公众号文章、视频脚本和市场复盘。站点保留原来的 Lemon 品牌视觉，并把它延展成美股内容站的识别系统。

## 内容结构

- 美股市场笔记：财报拆解、行业叙事、估值坐标和交易复盘。
- 每日美股数据：页面读取 `data/stocks.json`，展示 SPX、SPY、QQQ、SPCX、MU、NVDA 等观察列表。
- Lemon 品牌：继续使用 `lemon.png` 作为页眉、首屏和站点品牌图。
- 文章归档：预留给微信公众号存量文章同步，后续可按主题、标签和日期整理。
- 独立文章页：公众号文章放在 `articles/` 目录，首页文章卡片链接到对应页面。
- Vlog 脚本：把长文观点转成适合视频号、YouTube 或短视频的脚本结构。
- 天气模块：使用无密钥的 Open-Meteo 接口显示 Toronto 当前天气。
- 风险雷达：通过行情 Worker 展示 VIX、10年期美债、美元指数、油价和黄金。
- 比特币数据：保留原页面的 CoinGecko 实时价格模块，显示 BTC 和 ETH 的 CAD 报价。
- 订阅与合作：继续使用 Formspree 表单收集邮箱和留言。

## 股票数据更新

`scripts/update_stock_data.py` 会从 Yahoo Finance chart endpoint 拉取最近 5 个交易日数据，计算最新收盘价、涨跌额、涨跌幅和成交量，然后写入 `data/stocks.json`。

GitHub Actions 配置在 `.github/workflows/update-stock-data.yml`，默认工作日 23:30 UTC 自动运行一次，也可以在 GitHub Actions 页面手动触发。

手动本地更新：

```powershell
py scripts/update_stock_data.py
```

如果要调整观察列表，编辑 `scripts/update_stock_data.py` 里的 `WATCHLIST`。

## 添加公众号文章

新增文章建议放到 `articles/` 目录，然后在首页 `#articles` 区块新增或更新文章卡片。

当前已添加：

- `articles/2026-06-24-mu-pce-exam.html`
- `articles/2026-06-23-midweek-mu-earnings.html`
- `articles/2026-06-21-ai-hardware-week.html`

公众号二维码图片当前使用项目根目录的 `qrcode.jpg`。首页和文章页都会读取这个文件；如果文件不存在，会显示提示占位。

## 准实时股票刷新

`index.html` 已预留前端轮询逻辑：先加载 `data/stocks.json`，如果配置了实时接口，就会在页面打开后立即刷新一次，并每 30 秒刷新一次。

由于 GitHub Pages 是纯静态站，浏览器不能稳定地直接跨域请求 Yahoo Finance。仓库里提供了一个 Cloudflare Worker 代理示例：

- Worker 文件：`workers/yahoo-quote-proxy.js`
- 部署后会提供类似 `https://your-worker.workers.dev/` 的接口
- 然后把 `index.html` 里的 `LIVE_QUOTES_ENDPOINT` 从空字符串改成你的 Worker URL

示例：

```js
const LIVE_QUOTES_ENDPOINT = "https://your-worker.workers.dev/";
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

部署完成后，把 `index.html` 里的 `VISITOR_COUNTER_ENDPOINT` 改成你的 Worker URL：

```js
const VISITOR_COUNTER_ENDPOINT = "https://your-counter-worker.workers.dev/";
```

这个计数器不会保存 IP。页面只会在浏览器本地生成一个匿名 visitor ID，用来粗略区分访客。Cloudflare KV 不是强一致计数器，高并发场景需要换 Durable Object 或 D1。

## 部署

这个站点只有静态文件，可以直接通过 GitHub Pages 或任意静态托管服务部署。当前自定义域名配置保留在 `CNAME`。

## 下一步

公众号文章同步可以先整理成一份表格或 JSON：

- 标题
- 发布日期
- 原文链接
- 主题标签
- 摘要

之后可以把这些数据拆成独立文章页，或继续保持单页归档。
