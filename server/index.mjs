import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvFile();

const BASE = (process.env.FS_BASE ?? "https://la5.fusionsolar.huawei.com").replace(/\/$/, "");
const USER = process.env.FS_USER ?? "";
const PASS = process.env.FS_PASS ?? "";
const STATION_DN = process.env.FS_STATION_DN ?? "NE=35346190";
const APP_ID = process.env.FS_APP_ID ?? "smartpvms";
const PORT = Number(process.env.PORT ?? 8787);
const SESSION_TTL_MS = 20 * 60 * 1000;
const DEBUG = process.env.DEBUG === "1";

const jar = new Map();
const cache = new Map();
let csrfToken = null;
let zoneHeaders = null;
let loggedInAt = 0;

function enc(s) {
  return encodeURIComponent(s);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, { method = "GET", body, headers = {} } = {}) {
  const h = {
    accept: "application/json, text/plain, */*",
    referer: BASE + "/",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    ...(zoneHeaders ?? {}),
    ...headers,
  };
  if (jar.size) h.cookie = cookieHeader();
  if (csrfToken) h["x-xsrf-token"] = csrfToken;
  const init = { method, headers: h, redirect: "manual" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers["content-type"] = "application/json;charset=UTF-8";
  }
  const res = await fetch(BASE + path, init);
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
  if (DEBUG) console.log(`[dbg] ${method} ${path.slice(0, 90)} -> ${res.status}`);
  return { status: res.status, json, text, location: res.headers.get("location") };
}

async function establishSessionOnce() {
  if (!USER || !PASS) throw new Error("Faltan FS_USER/FS_PASS en server/.env");
  jar.clear();
  csrfToken = null;
  zoneHeaders = null;
  cache.clear();

  await req("/");

  const SSO_SERVICE = enc("/rest/dp/uidm/auth/v1/on-sso-credential-ready");
  const r1 = await req(`/rest/dp/uidm/unisso/v1/validate-user?service=${SSO_SERVICE}`, {
    method: "POST",
    headers: { "app-id": APP_ID },
    body: { username: USER, password: PASS, verifycode: "" },
  });
  const payload = r1.json?.payload ?? {};
  if (payload.exceptionId) throw new Error(`Login rechazado (${payload.exceptionId})`);
  if (r1.json?.code !== 0 && r1.json?.code !== "0") throw new Error(`validate-user fallo`);

  const r2 = await req(payload.redirectURL);
  if (r2.location?.startsWith(BASE)) await req(r2.location);

  const r3 = await req("/rest/pvms/web/login/v1/redirecturl?isFirst=false", {
    headers: { "App-Id": APP_ID, "Login-Url-Encode": "true" },
  });
  const cloudPath = r3.location;
  if (!cloudPath || !cloudPath.includes("/cloud.html")) throw new Error("Portal no entrego ruta de sesion");

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

  await req(cloudPath.split("#")[0]);
  const priv = await req("/rest/dpcloud/privilege/er/v2/session");
  if (priv.json?.code !== 0) throw new Error("Sesion invalida tras login");

  const check = await req(`/rest/pvms/web/station/v1/overview/station-detail?stationDn=${enc(STATION_DN)}`);
  if (check.status !== 200) throw new Error(`Sesion sin acceso a datos (HTTP ${check.status})`);

  loggedInAt = Date.now();
  console.log("[login] sesion establecida con datos reales OK");
}

async function establishSession() {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await establishSessionOnce();
      return;
    } catch (e) {
      lastErr = e;
      console.error(`[login] intento ${attempt} fallo: ${e.message} ${e.cause?.code ?? ""}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function ensureSession(fn) {
  try {
    if (!loggedInAt || Date.now() - loggedInAt > SESSION_TTL_MS) await establishSession();
    return await fn();
  } catch (e) {
    loggedInAt = 0;
    if (/HTTP 30[123]|sin acceso|expir|sesion/i.test(String(e.message))) {
      await establishSession();
      return await fn();
    }
    throw e;
  }
}

async function cachedGet(path, ttlMs) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.json;
  let res = await req(path);
  if ((res.status === 401 || res.status === 302 || res.status === 303) && loggedInAt) {
    loggedInAt = 0;
    await establishSession();
    res = await req(path);
  }
  if (res.status !== 200 || !res.json) throw new Error(`FusionSolar HTTP ${res.status}`);
  cache.set(path, { at: Date.now(), json: res.json });
  return res.json;
}

function normalizeTime(t) {
  if (t == null || t === "") return null;
  if (typeof t === "number" || /^\d+$/.test(String(t))) {
    const n = Number(t);
    if (n > 1e12) return new Date(n).toISOString();
    if (n > 1e9) return new Date(n * 1000).toISOString();
    return new Date(n).toISOString().slice(11, 16);
  }
  return String(t);
}

function parseCurve(rp) {
  const points = [];
  if (Array.isArray(rp)) {
    for (const p of rp) {
      const time = typeof p === "object" ? (p.time ?? p.x ?? null) : null;
      points.push({ time: normalizeTime(time), powerKw: num(typeof p === "object" ? (p.value ?? p.y ?? p.powerKw) : p) });
    }
  } else if (rp && typeof rp === "object") {
    for (const [sec, v] of Object.entries(rp)) {
      points.push({ time: normalizeTime(Number(sec)), powerKw: num(v) });
    }
  }
  return points.filter((p) => p.time).sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function parseCurvePowers(rp) {
  if (Array.isArray(rp)) return rp.map((p) => num(typeof p === "object" ? (p.value ?? p.y ?? p.powerKw) : p));
  if (rp && typeof rp === "object") return Object.values(rp).map((v) => num(v));
  return [];
}

const DETAIL_PATH = `/rest/pvms/web/station/v1/overview/station-detail?stationDn=${enc(STATION_DN)}`;

async function apiSnapshot() {
  return ensureSession(async () => {
    const detail = await cachedGet(DETAIL_PATH, 25_000);
    const d = detail.data ?? {};
    const curve = parseCurve(d.realtimePower);
    const peakCurve = curve.reduce((m, p) => Math.max(m, p.powerKw), 0);
    const daily = d.rptNrgKpi?.dailyNrg ?? {};
    return {
      now: new Date().toISOString(),
      status: d.plantStatus === "connected" ? "online" : "offline",
      powerKw: num(d.currentPower),
      peakKw: Math.max(peakCurve, num(d.currentPower)),
      kwhToday: num(d.dailyEnergy),
      kwhMonth: num(d.monthEnergy),
      kwhYear: num(d.yearEnergy),
      kwhTotal: num(d.cumulativeEnergy),
      gridConnectedTime: d.gridConnectedTime ?? null,
      energyToday: {
        pv: num(daily.pvNrg),
        selfUse: num(daily.selfUseNrg),
        onGrid: num(daily.onGridNrg),
        buy: num(daily.buyNrg),
      },
      curve,
    };
  });
}

function hourElapsedSantiago(now) {
  const santiago = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return Math.max(1, santiago.getUTCHours() + santiago.getUTCMinutes() / 60);
}

async function apiHistory(unitRaw) {
  return ensureSession(async () => {
    const unit = ["day", "month", "year"].includes(unitRaw) ? unitRaw : "day";
    const detail = await cachedGet(DETAIL_PATH, 25_000);
    const d = detail.data ?? {};
    const powers = parseCurvePowers(d.realtimePower);
    const peakKw = powers.length ? Math.max(...powers) : 0;
    let record;
    if (unit === "month") {
      const now = new Date();
      const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const energy = num(d.monthEnergy);
      record = { date: ym, energyKwh: energy, averageKw: Number((energy / 24 / 30).toFixed(2)), peakKw: 0, pr: 0 };
    } else if (unit === "year") {
      const y = String(new Date().getUTCFullYear());
      const energy = num(d.yearEnergy);
      record = { date: y, energyKwh: energy, averageKw: Number((energy / 24 / 365).toFixed(2)), peakKw: 0, pr: 0 };
    } else {
      const todayIso = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
      const energy = num(d.dailyEnergy);
      record = {
        date: todayIso,
        energyKwh: energy,
        averageKw: Number((energy / hourElapsedSantiago(new Date())).toFixed(2)),
        peakKw,
        pr: 0,
      };
    }
    return { records: [record] };
  });
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

async function discoverInverters() {
  const q = `conditionParams.parentDn=${enc(STATION_DN)}&conditionParams.curPage=0&conditionParams.recordperpage=300`;
  const j = await cachedGet(`/rest/neteco/web/config/device/v1/device-list?${q}`, 6 * 60 * 60 * 1000);
  const devices = Array.isArray(j.data) ? j.data : [];
  return devices
    .filter((x) => x.mocTypeName === "Inverter")
    .sort((a, b) => Number(String(a.dn).replace(/\D/g, "")) - Number(String(b.dn).replace(/\D/g, "")))
    .map((x, i) => ({ dn: x.dn, name: `INV-${LETTERS[i] ?? i + 1}` }));
}

async function apiInverters() {
  return ensureSession(async () => {
    const inverters = await discoverInverters();
    const results = [];
    for (const { dn, name } of inverters) {
      try {
        const j = await cachedGet(
          `/rest/pvms/web/device/v1/device-real-kpi?deviceDn=${enc(dn)}&signalIds=10025`,
          30_000,
        );
        results.push({
          dn,
          name,
          powerKw: num(j.data?.signals?.["10025"]?.value),
          statusCode: j.data?.status ?? null,
        });
      } catch {
        results.push({ dn, name, powerKw: 0, statusCode: null });
      }
    }
    return { inverters: results };
  });
}

const server = http.createServer(async (rq, rs) => {
  const url = new URL(rq.url, `http://localhost:${PORT}`);
  const origin = rq.headers.origin ?? "*";
  const send = (code, obj) => {
    rs.writeHead(code, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    rs.end(JSON.stringify(obj, null, 2));
  };
  if (rq.method === "OPTIONS") {
    rs.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    });
    return rs.end();
  }
  try {
    if (url.pathname === "/api/health")
      return send(200, {
        ok: true,
        user: USER ? USER.replace(/@.*/, "@***") : null,
        sessionAgeMs: loggedInAt ? Date.now() - loggedInAt : null,
      });
    if (url.pathname === "/api/debug/login") {
      await establishSession();
      return send(200, { ok: true });
    }
    if (url.pathname === "/api/snapshot") return send(200, await apiSnapshot());
    if (url.pathname === "/api/inverters") return send(200, await apiInverters());
    if (url.pathname === "/api/history")
      return send(200, await apiHistory(String(url.searchParams.get("unit") ?? "day")));
    if (url.pathname === "/api/debug/raw") {
      const what = url.searchParams.get("what") ?? "detail";
      return send(200, await ensureSession(async () => cachedGet(what === "devices" ? `/rest/neteco/web/config/device/v1/device-list?conditionParams.parentDn=${enc(STATION_DN)}&conditionParams.curPage=0&conditionParams.recordperpage=300` : DETAIL_PATH, 0)));
    }
    send(404, { error: "ruta desconocida", rutas: ["/api/health", "/api/snapshot", "/api/inverters", "/api/history?unit=", "/api/debug/raw"] });
  } catch (e) {
    console.error("[err]", e.message, e.cause?.code ?? "");
    send(502, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`GamalierSolar backend (interino) escuchando en http://localhost:${PORT}`);
});
