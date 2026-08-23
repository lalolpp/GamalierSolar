const DOMAIN = (process.env.FS_DOMAIN || "https://la5.fusionsolar.huawei.com").replace(/\/$/, "");
const STATION_DN = process.env.FS_STATION_DN || "NE=35346190";

const cache = new Map();
const CACHE_TTL_MS = 25_000;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sessionHeaders() {
  const cookie = (process.env.FS_SESSION_COOKIE || "").trim();
  if (!cookie) throw httpError("Backend sin sesion de FusionSolar configurada (FS_SESSION_COOKIE)", 503);
  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "x-non-renewal-session": "true",
    "x-timezone-offset": "-240",
    Cookie: cookie,
  };
  const roarand = (process.env.FS_ROARAND || "").trim();
  if (roarand) headers.roarand = roarand;
  return headers;
}

async function portalGet(path, { ttlMs = CACHE_TTL_MS } = {}) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.json;
  let res;
  try {
    res = await fetch(`${DOMAIN}${path}`, { headers: sessionHeaders(), redirect: "manual" });
  } catch {
    throw httpError("FusionSolar no responde", 502);
  }
  if (res.status === 401 || res.status === 302 || res.status === 303) {
    throw httpError("Sesion de FusionSolar expirada: renovar FS_SESSION_COOKIE", 502);
  }
  if (!res.ok) throw httpError(`FusionSolar HTTP ${res.status}`, 502);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw httpError("Respuesta no valida de FusionSolar", 502);
  }
  cache.set(path, { at: Date.now(), json });
  return json;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

module.exports = { DOMAIN, STATION_DN, portalGet, cors, httpError, num };
