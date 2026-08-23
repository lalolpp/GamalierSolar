const { STATION_DN, portalGet, cors, httpError, num } = require("./_huawei");

function hourElapsedUtcChile(now) {
  const santiago = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return Math.max(1, santiago.getUTCHours() + santiago.getUTCMinutes() / 60);
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo no permitido" });
  const unit = String(req.query.unit || "day");
  try {
    const enc = encodeURIComponent(STATION_DN);
    const [kpi, detail] = await Promise.all([
      portalGet(`/rest/pvms/web/station/v1/overview/station-kpi-data?stationDn=${enc}`),
      portalGet(`/rest/pvms/web/station/v1/overview/station-detail?stationDn=${enc}`),
    ]);
    const k = kpi.kpiData || {};
    const d = detail.data || {};
    const rp = d.realtimePower || {};
    const powers = Object.values(rp).map((v) => num(v));
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
      const energy = num(k.dailyEnergy ?? d.dailyEnergy);
      record = {
        date: todayIso,
        energyKwh: energy,
        averageKw: Number((energy / hourElapsedUtcChile(new Date())).toFixed(2)),
        peakKw,
        pr: 0,
      };
    }
    res.status(200).json({ records: [record] });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
