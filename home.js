(function () {
  "use strict";

  const toast = document.getElementById("toast");
  let toastTimer = 0;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 2400);
  }

  const shareButton = document.getElementById("share-site");
  if (shareButton) {
    shareButton.addEventListener("click", async function () {
      const shareData = {
        title: shareButton.dataset.shareTitle || document.title,
        text: "每周美股预测与 AI 科技股复盘，推荐给你：",
        url: location.origin + location.pathname,
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
          return;
        }
        await navigator.clipboard.writeText(shareData.title + " " + shareData.url);
        showToast("链接已复制，快去分享给朋友吧");
      } catch (error) {
        if (error && error.name === "AbortError") return;
        showToast("复制失败，请手动复制地址栏链接");
      }
    });
  }

  function formatTitle(title) {
    return String(title || "")
      .replace(/^\d{8}\s*/, "")
      .replace(/--/g, "：");
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value != null) el.textContent = value;
  }

  function renderLevels(levels) {
    const list = document.getElementById("hero-feature-levels");
    if (!list || !Array.isArray(levels) || !levels.length) return;
    list.replaceChildren(
      ...levels.slice(0, 3).map(function (level) {
        const item = document.createElement("li");
        const symbol = document.createElement("strong");
        symbol.textContent = level.symbol;
        const support = document.createElement("span");
        support.textContent = "支撑 " + (level.support || "--");
        const resistance = document.createElement("span");
        resistance.textContent = "压力 " + (level.resistance || "--");
        item.append(symbol, support, resistance);
        return item;
      }),
    );
  }

  function enhanceCards(articles) {
    const byUrl = new Map(articles.map((article) => [article.url, article]));
    document.querySelectorAll("#articles .article-card").forEach(function (card) {
      const link = card.querySelector("h3 a");
      const article = link && byUrl.get(link.getAttribute("href"));
      if (!article || card.querySelector(".article-meta")) return;
      const meta = document.createElement("div");
      meta.className = "article-meta";
      if (article.readingMinutes) {
        const minutes = document.createElement("span");
        minutes.textContent = "约 " + article.readingMinutes + " 分钟";
        meta.append(minutes);
      }
      card.append(meta);
    });
  }

  fetch("data/research.json", { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      const articles = Array.isArray(data.articles) ? data.articles : [];
      setText("stat-articles", data.articleCount || articles.length);
      if (Array.isArray(data.symbols) && data.symbols.length) setText("stat-symbols", data.symbols.length);

      const latest = articles[0];
      if (latest) {
        const featureLink = document.getElementById("hero-feature-link");
        if (featureLink) {
          featureLink.href = latest.url;
          featureLink.textContent = formatTitle(latest.title);
        }
        const heroLink = document.getElementById("hero-latest-link");
        if (heroLink) heroLink.href = latest.url;
        const dateEl = document.getElementById("hero-feature-date");
        if (dateEl) {
          dateEl.dateTime = latest.date;
          dateEl.textContent = latest.date;
        }
        if (latest.readingMinutes) setText("hero-feature-meta", "约 " + latest.readingMinutes + " 分钟阅读");
        renderLevels(latest.levels);
      }
      enhanceCards(articles);
    })
    .catch(function () {
      /* The static fallback content in index.html remains visible. */
    });
})();
