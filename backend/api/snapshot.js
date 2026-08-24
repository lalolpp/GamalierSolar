const { STATION_DN, portalGet, cors, httpError, num, enc } = require("./_huawei");

function parseCurve(rp) {
  const points = [];
  if (Array.isArray(rp)) {
    for (const p of rp) {
      const time = typeof p === "object" ? (p.time ?? p.x ?? null) : null;
      const value = num(typeof p === "object" ? (p.value ?? p.y ?? p.powerKw) : p);
      points.push({ time: normalizeTime(time), powerKw: value });
    }
  } else if (rp && typeof rp === "object") {
    for (const [sec, v] of Object.entries(rp)) {
      points.push({ time: normalizeTime(Number(sec)), powerKw: num(v) });
    }
  }
  return points.filter((p) => p.time).sort((a, b) => String(a.time).localeCompare(String(b.time)));
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

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo no permitido" });
  try {
    const detail = await portalGet(`/rest/pvms/web/station/v1/overview/station-detail?stationDn=${enc(STATION_DN)}`);
    const d = detail.data || {};
    const curve = parseCurve(d.realtimePower);
    const peakCurve = curve.reduce((m, p) => Math.max(m, p.powerKw), 0);
    const daily = d.rptNrgKpi?.dailyNrg || {};
    res.status(200).json({
      now: new Date().toISOString(),
      status: d.plantStatus === "connected" ? "online" : "offline",
      powerKw: num(d.currentPower),
      peakKw: Math.max(peakCurve, num(d.currentPower)),
      kwhToday: num(d.dailyEnergy),
      kwhMonth: num(d.monthEnergy),
      kwhYear: num(d.yearEnergy),
      kwhTotal: num(d.cumulativeEnergy),
      gridConnectedTime: d.gridConnectedTime || null,
      energyToday: {
        pv: num(daily.pvNrg),
        selfUse: num(daily.selfUseNrg),
        onGrid: num(daily.onGridNrg),
        buy: num(daily.buyNrg),
      },
      curve,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
