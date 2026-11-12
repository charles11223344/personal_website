const { execFileSync } = require("child_process");
const fs = require("fs");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = fs.readFileSync("index.html", "utf8");

function shot(name, w, h, hideCss, budget) {
  const html = hideCss ? base.replace("</head>", "<style>" + hideCss + "</style></head>") : base;
  fs.writeFileSync(".tmp-view.html", html);
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
    "--virtual-time-budget=" + budget, "--window-size=" + w + "," + h,
    "--screenshot=D:\\personal_website\\.tmp-" + name + ".png",
    "file:///D:/personal_website/.tmp-view.html",
  ], { stdio: "ignore", timeout: 90000 });
  console.log("shot", name);
}

const only = (sel) => ".site-header,header,footer,.hero,.market-strip,main > section:not(" + sel + "){display:none !important}";
const jobs = process.argv.slice(2);
if (jobs.includes("hero")) shot("hero", 1400, 900, null, 9000);
if (jobs.includes("stocks")) shot("stocks", 1400, 1500, only("#stocks"), 9000);
if (jobs.includes("articles")) shot("articles", 1400, 1500, only("#articles"), 9000);
if (jobs.includes("btc")) shot("btc", 1400, 700, only("#bitcoin"), 9000);
if (jobs.includes("sync")) shot("sync", 1400, 900, only("#wechat-sync"), 9000);
if (jobs.includes("cal")) shot("cal", 1400, 1500, only("#event-calendar"), 9000);
if (jobs.includes("mobile")) shot("mobile", 430, 2400, only("#stocks"), 9000);
