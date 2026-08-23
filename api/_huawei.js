const DOMAIN = (process.env.FS_DOMAIN || "https://la5.fusionsolar.huawei.com").replace(/\/$/, "");
const STATION_DN = process.env.FS_STATION_DN || "NE=35346190";

let cachedCookie = null;
let cachedAt = 0;

function resolveCookie() {
  if (cachedCookie && Date.now() - cachedAt < 30 * 60 * 1000) return cachedCookie;
  const manual = (process.env.FS_SESSION_COOKIE || "").trim();
  cachedCookie = manual || null;
  cachedAt = cachedCookie ? Date.now() : 0;
  return cachedCookie;
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function portalGet(path) {
  const cookie = resolveCookie();
  if (!cookie) throw httpError("Backend sin sesion de FusionSolar configurada", 503);
  let res;
  try {
    res = await fetch(`${DOMAIN}${path}`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Referer: `${DOMAIN}/`,
        Cookie: cookie,
      },
      redirect: "manual",
    });
  } catch {
    throw httpError("FusionSolar no responde", 502);
  }
  if (res.status === 401 || res.status === 302 || res.status === 303) {
    cachedCookie = null;
    throw httpError("Sesion de FusionSolar expirada", 502);
  }
  if (!res.ok) throw httpError(`FusionSolar HTTP ${res.status}`, 502);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw httpError("Respuesta no valida de FusionSolar", 502);
  }
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

module.exports = { DOMAIN, STATION_DN, portalGet, cors, httpError };
