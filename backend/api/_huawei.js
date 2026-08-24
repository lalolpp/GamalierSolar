const crypto = require("crypto");

const DOMAIN = (process.env.FS_DOMAIN || "https://la5.fusionsolar.huawei.com").replace(/\/$/, "");
const STATION_DN = process.env.FS_STATION_DN || "NE=35346190";
const APP_ID = process.env.FS_APP_ID || "smartpvms";
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

function enc(v) {
  return encodeURIComponent(v);
}

function credentials() {
  const user = (process.env.FS_USER || "").trim();
  const pass = (process.env.FS_PASS || "").trim();
  if (!user || !pass) return null;
  return { username: user, password: pass };
}

function absorb(res, jar) {
  const list =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);
  for (const line of list) {
    const pair = line.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function followSameDomain(url, headers, jar, maxHops = 8) {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    let res;
    try {
      res = await fetch(current, {
        headers: { Accept: "*/*", "User-Agent": UA, ...headers, Cookie: cookieHeader(jar) },
        redirect: "manual",
      });
    } catch {
      throw httpError("FusionSolar no responde durante login", 502);
    }
    absorb(res, jar);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, current);
      if (next.origin !== DOMAIN) return;
      current = next.href;
      continue;
    }
    await res.text().catch(() => "");
    return;
  }
}

async function doLogin() {
  const creds = credentials();
  if (!creds) throw httpError("Backend sin credenciales (FS_USER/FS_PASS)", 503);
  const jar = new Map();

  const validateRes = await fetch(
    `${DOMAIN}/rest/dp/uidm/unisso/v1/validate-user?service=${enc("/rest/dp/uidm/auth/v1/on-sso-credential-ready")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "User-Agent": UA,
        "App-Id": APP_ID,
        roarand: crypto.randomBytes(24).toString("hex"),
      },
      body: JSON.stringify({ username: creds.username, password: creds.password, verifycode: "" }),
      redirect: "manual",
    },
  ).catch(() => {
    throw httpError("FusionSolar no responde al validar usuario", 502);
  });
  absorb(validateRes, jar);
  const vBody = await validateRes.json().catch(() => ({}));
  if (validateRes.status !== 200 || Number(vBody.code ?? -1) !== 0) {
    const msg = vBody && vBody.message ? `: ${vBody.message}` : "";
    throw httpError(`Credenciales FusionSolar rechazadas${msg}`, 502);
  }
  const readyPath = vBody && vBody.payload && vBody.payload.redirectURL;
  if (!readyPath) throw httpError("Login sin ticket SSO", 502);

  await followSameDomain(DOMAIN + readyPath, { "App-Id": APP_ID }, jar);
  await followSameDomain(`${DOMAIN}/rest/pvms/web/login/v1/redirecturl?isFirst=false`, {
    "App-Id": APP_ID,
    "Login-Url-Encode": "true",
  }, jar);

  if (!jar.has("JSESSIONID")) throw httpError("Login no genero sesion PVMS", 502);
  session = { cookie: cookieHeader(jar), xsrf: jar.get("XSRF-TOKEN") || "", at: Date.now() };
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
    "App-Id": APP_ID,
    roarand: crypto.randomBytes(24).toString("hex"),
  };
  const manualCookie = (process.env.FS_SESSION_COOKIE || "").trim();
  if (session) {
    headers.Cookie = session.cookie;
    if (session.xsrf) headers["X-XSRF-TOKEN"] = session.xsrf;
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
    throw httpError(`Sesion de FusionSolar rechazada (upstream ${res.status})`, 502);
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

module.exports = { DOMAIN, STATION_DN, enc, portalGet, cors, httpError, num };
