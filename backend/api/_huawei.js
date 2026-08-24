const DOMAIN = (process.env.FS_DOMAIN || "https://la5.fusionsolar.huawei.com").replace(/\/$/, "");
const STATION_DN = process.env.FS_STATION_DN || "NE=35346190";
const APP_ID = process.env.FS_APP_ID || "smartpvms";

const CACHE_TTL_MS = 25_000;
const SESSION_TTL_MS = 20 * 60 * 1000;

const jar = new Map();
const cache = new Map();
let csrfToken = null;
let zoneHeaders = null;
let loggedInAt = 0;
let loginPromise = null;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function enc(s) {
  return encodeURIComponent(s);
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function rawFetch(path, { method = "GET", body, headers = {} } = {}) {
  const h = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    Referer: DOMAIN + "/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    ...(zoneHeaders ?? {}),
    ...headers,
  };
  if (jar.size) h.Cookie = cookieHeader();
  if (csrfToken) h["x-xsrf-token"] = csrfToken;
  const init = { method, headers: h, redirect: "manual" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers["content-type"] = "application/json;charset=UTF-8";
  }
  const res = await fetch(`${DOMAIN}${path}`, init);
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    const i = p.indexOf("=");
    if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
  }
  for (const [k, v] of jar) {
    if (k.toLowerCase() === "xsrf-token") csrfToken = decodeURIComponent(v);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, location: res.headers.get("location") };
}

async function establishSessionOnce() {
  const user = process.env.FS_USER;
  const pass = process.env.FS_PASS;
  if (!user || !pass) throw httpError("Backend sin credenciales de FusionSolar (FS_USER/FS_PASS)", 503);

  jar.clear();
  csrfToken = null;
  zoneHeaders = null;

  await rawFetch("/");

  const SSO_SERVICE = enc("/rest/dp/uidm/auth/v1/on-sso-credential-ready");
  const r1 = await rawFetch(`/rest/dp/uidm/unisso/v1/validate-user?service=${SSO_SERVICE}`, {
    method: "POST",
    headers: { "app-id": APP_ID },
    body: { username: user, password: pass, verifycode: "" },
  });
  const payload = r1.json?.payload ?? {};
  if (payload.exceptionId) throw httpError(`Login rechazado por FusionSolar (${payload.exceptionId})`, 502);
  if (r1.json?.code !== 0 && r1.json?.code !== "0") throw httpError("Login rechazado por FusionSolar", 502);

  const r2 = await rawFetch(payload.redirectURL);
  if (r2.location?.startsWith(DOMAIN)) await rawFetch(r2.location);

  const r3 = await rawFetch("/rest/pvms/web/login/v1/redirecturl?isFirst=false", {
    headers: { "App-Id": APP_ID, "Login-Url-Encode": "true" },
  });
  const cloudPath =
    r3.location ??
    (() => {
      try {
        const u = r3.json?.url ?? r3.json?.payload?.url;
        return u ? decodeURIComponent(u) : null;
      } catch {
        return null;
      }
    })();
  if (!cloudPath || !cloudPath.includes("/cloud.html")) throw httpError("Portal no entrego ruta de sesion", 502);

  const clean = (s) => {
    try {
      s = decodeURIComponent(s);
    } catch {}
    return s.split("#")[0];
  };
  const zoneMatch = cloudPath.match(/[?&]zone-id=([^&]+)/);
  const instanceMatch = cloudPath.match(/[?&]instance-id=([^&]+)/);
  zoneHeaders = {
    "app-id": APP_ID,
    "instance-id": instanceMatch ? clean(instanceMatch[1]) : APP_ID,
    ...(zoneMatch ? { "zone-id": clean(zoneMatch[1]) } : {}),
    "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  };

  await rawFetch(cloudPath.split("#")[0]);
  const priv = await rawFetch("/rest/dpcloud/privilege/er/v2/session");
  if (priv.json?.code !== 0) throw httpError("Sesion FusionSolar invalida tras login", 502);

  const check = await rawFetch(`/rest/pvms/web/station/v1/overview/station-detail?stationDn=${enc(STATION_DN)}`);
  if (check.status !== 200) throw httpError(`Sesion sin acceso a datos (HTTP ${check.status})`, 502);

  loggedInAt = Date.now();
}

async function ensureSession() {
  if (!loggedInAt || Date.now() - loggedInAt > SESSION_TTL_MS) {
    if (!loginPromise) {
      loginPromise = establishSessionOnce().finally(() => {
        loginPromise = null;
      });
    }
    await loginPromise;
  }
}

async function portalGet(path, { ttlMs = CACHE_TTL_MS } = {}) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.json;
  let res;
  try {
    await ensureSession();
    res = await rawFetch(path);
  } catch (e) {
    if (e.status) throw e;
    throw httpError("FusionSolar no responde", 502);
  }
  if (res.status === 401 || res.status === 302 || res.status === 303) {
    loggedInAt = 0;
    await ensureSession();
    res = await rawFetch(path);
  }
  if (res.status !== 200 || !res.json) throw httpError(`FusionSolar HTTP ${res.status}`, 502);
  cache.set(path, { at: Date.now(), json: res.json });
  return res.json;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

module.exports = { DOMAIN, STATION_DN, portalGet, cors, httpError, num, enc };
