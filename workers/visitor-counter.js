const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

const PAGE_VIEWS_KEY = "stats:pageViews";
const VISITORS_KEY = "stats:visitors";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function normalizeVisitorId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9._:-]{8,128}$/.test(id)) return null;
  return id;
}

async function readCount(kv, key) {
  const value = await kv.get(key);
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function writeCount(kv, key, value) {
  await kv.put(key, String(value));
  return value;
}

async function incrementCount(kv, key) {
  const next = (await readCount(kv, key)) + 1;
  return writeCount(kv, key, next);
}

async function currentStats(kv) {
  const [pageViews, visitors] = await Promise.all([
    readCount(kv, PAGE_VIEWS_KEY),
    readCount(kv, VISITORS_KEY)
  ]);
  return { pageViews, visitors };
}

async function recordHit(request, env) {
  const body = await request.json().catch(() => ({}));
  const visitorId = normalizeVisitorId(body.visitorId);
  const pageViews = await incrementCount(env.VISITOR_COUNTER, PAGE_VIEWS_KEY);

  let countedVisitor = false;
  let visitors = await readCount(env.VISITOR_COUNTER, VISITORS_KEY);

  if (visitorId) {
    const visitorKey = `visitor:${visitorId}`;
    const existingVisitor = await env.VISITOR_COUNTER.get(visitorKey);
    if (!existingVisitor) {
      await env.VISITOR_COUNTER.put(visitorKey, new Date().toISOString());
      visitors = await incrementCount(env.VISITOR_COUNTER, VISITORS_KEY);
      countedVisitor = true;
    }
  }

  return {
    pageViews,
    visitors,
    countedVisitor,
    updatedAt: new Date().toISOString()
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (!env.VISITOR_COUNTER) {
      return jsonResponse({ error: "Missing VISITOR_COUNTER KV binding" }, 500);
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/hit") {
      return jsonResponse(await recordHit(request, env));
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/stats")) {
      const stats = await currentStats(env.VISITOR_COUNTER);
      return jsonResponse({
        ...stats,
        countedVisitor: false,
        updatedAt: new Date().toISOString()
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};
