const crypto = require("crypto");

const DOMAIN = (process.env.FS_DOMAIN || "https://la5.fusionsolar.huawei.com").replace(/\/$/, "");
const STATION_DN = process.env.FS_STATION_DN || "NE=35346190";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

const cache = new Map();
const CACHE_TTL_MS = 25_000;

let session = null;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function randomRoarand() {
  return crypto.randomBytes(24).toString("hex");
}

function credentials() {
  const user = (process.env.FS_USER || "").trim();
  const pass = (process.env.FS_PASS || "").trim();
  if (!user || !pass) return null;
  return {
    userName: user,
    passwordMd5: crypto.createHash("md5").update(pass).digest("hex"),
  };
}

function collectCookies(res) {
  const out = [];
  if (typeof res.headers.getSetCookie === "function") {
    for (const line of res.headers.getSetCookie()) out.push(line.split(";")[0]);
  }
  if (!out.length) {
    const raw = res.headers.get("set-cookie");
    if (raw) for (const part of raw.split(/,(?=[^ ;]+=)/)) out.push(part.trim().split(";")[0]);
  }
  return out.filter(Boolean);
}

async function doLogin() {
  const payload = credentials();
  if (!payload) throw httpError("Backend sin credenciales (FS_USER/FS_PASS)", 503);
  let res;
  try {
    res = await fetch(`${DOMAIN}/rest/pvms/web/login/v1/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "User-Agent": UA,
        roarand: randomRoarand(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw httpError("FusionSolar no responde al login", 502);
  }
  let json = {};
  try {
    json = await res.json();
  } catch {}
  const rejected =
    !res.ok ||
    json.success === false ||
    Number(json.errCode ?? 0) !== 0 ||
    Number(json.errorCode ?? 0) !== 0;
  if (rejected) {
    throw httpError(`Login FusionSolar rechazado${json.message ? `: ${json.message}` : ""}`, 502);
  }
  const cookies = collectCookies(res);
  if (!cookies.length) throw httpError("Login sin cookies de sesion", 502);
  session = { cookie: cookies.join("; "), at: Date.now() };
}

async function ensureSession() {
  if (!session && credentials()) await doLogin();
}

function baseHeaders() {
  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "User-Agent": UA,
    "X-Requested-With": "XMLHttpRequest",
    "x-non-renewal-session": "true",
    "x-timezone-offset": "-240",
    roarand: randomRoarand(),
  };
  const manualCookie = (process.env.FS_SESSION_COOKIE || "").trim();
  if (session) {
    headers.Cookie = session.cookie;
  } else if (manualCookie) {
    headers.Cookie = manualCookie;
    const roarand = (process.env.FS_ROARAND || "").trim();
    if (roarand) headers.roarand = roarand;
  } else {
    throw httpError("Backend sin sesion de FusionSolar configurada", 503);
  }
  return headers;
}

async function portalGet(path, { ttlMs = CACHE_TTL_MS } = {}) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.json;
  await ensureSession();
  let res;
  try {
    res = await fetch(`${DOMAIN}${path}`, { headers: baseHeaders(), redirect: "manual" });
  } catch {
    throw httpError("FusionSolar no responde", 502);
  }
  if (res.status === 401 || res.status === 302 || res.status === 303) {
    if (credentials()) {
      session = null;
      await doLogin();
      try {
        res = await fetch(`${DOMAIN}${path}`, { headers: baseHeaders(), redirect: "manual" });
      } catch {
        throw httpError("FusionSolar no responde tras relogin", 502);
      }
    }
  }
  if (res.status === 401 || res.status === 302 || res.status === 303) {
    throw httpError("Sesion de FusionSolar rechazada", 502);
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

module.exports = { DOMAIN, STATION_DN, portalGet, cors, httpError, num };
