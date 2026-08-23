const { STATION_DN, portalGet, cors, httpError, num } = require("./_huawei");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo no permitido" });
  try {
    const enc = encodeURIComponent(STATION_DN);
    const [kpi, detail] = await Promise.all([
      portalGet(`/rest/pvms/web/station/v1/overview/station-kpi-data?stationDn=${enc}`),
      portalGet(`/rest/pvms/web/station/v1/overview/station-detail?stationDn=${enc}`),
    ]);
    const k = kpi.kpiData || {};
    const d = detail.data || {};
    const rp = d.realtimePower || {};
    const curve = Object.entries(rp)
      .map(([sec, v]) => ({ time: new Date(num(sec) * 1000).toISOString(), powerKw: num(v) }))
      .sort((a, b) => a.time.localeCompare(b.time));
    const peakCurve = curve.reduce((m, p) => Math.max(m, p.powerKw), 0);
    res.status(200).json({
      now: new Date().toISOString(),
      status: d.plantStatus === "connected" ? "online" : "offline",
      powerKw: num(d.currentPower),
      peakKw: Math.max(peakCurve, num(d.currentPower)),
      kwhToday: num(k.dailyEnergy ?? d.dailyEnergy),
      kwhMonth: num(d.monthEnergy),
      kwhYear: num(d.yearEnergy),
      kwhTotal: num(k.cumulativeEnergy ?? d.cumulativeEnergy),
      gridConnectedTime: d.gridConnectedTime || null,
      energyToday: {
        pv: num(d.rptNrgKpi?.dailyNrg?.pvNrg),
        selfUse: num(d.rptNrgKpi?.dailyNrg?.selfUseNrg),
        onGrid: num(d.rptNrgKpi?.dailyNrg?.onGridNrg),
        buy: num(d.rptNrgKpi?.dailyNrg?.buyNrg),
      },
      curve,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
