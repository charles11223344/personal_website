<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />
  <xsl:template match="/">
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>RSS 订阅 · <xsl:value-of select="rss/channel/title" /></title>
        <style>
          :root { color-scheme: dark; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #070b14; color: #e6e9ef; font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; }
          main { max-width: 760px; margin: 0 auto; padding: 48px 20px 72px; }
          .eyebrow { color: #f5c542; font-size: 12px; letter-spacing: .2em; font-weight: 700; margin: 0 0 8px; }
          h1 { font-size: 30px; margin: 0 0 12px; }
          p { color: #a3abbb; margin: 0 0 16px; }
          .box { border: 1px solid rgba(255,255,255,.1); background: #0f1523; border-radius: 16px; padding: 20px; margin: 24px 0 40px; }
          .box h2 { font-size: 16px; margin: 0 0 10px; color: #e6e9ef; }
          code { display: block; background: #070b14; border: 1px solid rgba(245,197,66,.35); color: #f5c542; padding: 10px 12px; border-radius: 10px; word-break: break-all; font-size: 14px; user-select: all; }
          ol { margin: 14px 0 0; padding-left: 20px; color: #a3abbb; }
          a { color: #f5c542; }
          .item { padding: 18px 0; border-top: 1px solid rgba(255,255,255,.08); }
          .item a { color: #e6e9ef; text-decoration: none; font-weight: 600; font-size: 17px; }
          .item a:hover { color: #f5c542; }
          .date { color: #6f7889; font-size: 13px; font-family: ui-monospace, monospace; }
          .item p { margin: 6px 0 0; font-size: 14px; }
          .back { display: inline-block; margin-bottom: 28px; text-decoration: none; }
        </style>
      </head>
      <body>
        <main>
          <a class="back" href="/">← 返回 <xsl:value-of select="rss/channel/title" /></a>
          <p class="eyebrow">RSS FEED</p>
          <h1>订阅 <xsl:value-of select="rss/channel/title" /></h1>
          <p>这是本站的 RSS 订阅源。把下面的地址复制到 RSS 阅读器里，每次发布周末剧本或周中复盘都会自动推送给你。</p>
          <div class="box">
            <h2>订阅地址</h2>
            <code><xsl:value-of select="rss/channel/link" />feed.xml</code>
            <ol>
              <li>打开 RSS 阅读器（如 Feedly、Inoreader、NetNewsWire、Reeder）。</li>
              <li>选择「添加订阅 / Add Feed」，粘贴上面的地址。</li>
              <li>完成，新文章会自动出现在阅读器里。</li>
            </ol>
          </div>
          <p class="eyebrow">LATEST</p>
          <xsl:for-each select="rss/channel/item">
            <div class="item">
              <span class="date"><xsl:value-of select="substring(pubDate, 6, 11)" /></span><br />
              <a href="{link}"><xsl:value-of select="title" /></a>
              <p><xsl:value-of select="description" /></p>
            </div>
          </xsl:for-each>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
