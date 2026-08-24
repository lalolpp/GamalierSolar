const { STATION_DN, portalGet, cors, httpError, num, enc } = require("./_huawei");

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

async function discoverInverters() {
  const q = `conditionParams.parentDn=${enc(STATION_DN)}&conditionParams.curPage=0&conditionParams.recordperpage=300`;
  const j = await portalGet(`/rest/neteco/web/config/device/v1/device-list?${q}`, { ttlMs: 6 * 60 * 60 * 1000 });
  const devices = Array.isArray(j.data) ? j.data : [];
  const inverters = devices
    .filter((d) => d.mocTypeName === "Inverter")
    .sort((a, b) => Number(String(a.dn).replace(/\D/g, "")) - Number(String(b.dn).replace(/\D/g, "")))
    .map((d, i) => ({ dn: d.dn, name: `INV-${LETTERS[i] ?? i + 1}` }));
  const idsite = (() => {
    for (const d of devices) if (d.stationDnId) return String(d.stationDnId);
    return "";
  })();
  return { inverters, idsite };
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo no permitido" });
  try {
    const { inverters, idsite } = await discoverInverters();
    if (!inverters.length) return res.status(200).json({ inverters: [] });
    const results = await Promise.all(
      inverters.map(async ({ dn, name }) => {
        try {
          const j = await portalGet(
            `/rest/pvms/web/device/v1/device-real-kpi?deviceDn=${enc(dn)}&signalIds=10024${idsite ? `&idsite=${enc(idsite)}` : ""}`,
            { ttlMs: 30_000 },
          );
          const raw = j.data?.signals?.["10024"]?.realValue;
          return { dn, name, powerKw: num(raw), statusCode: j.data?.status ?? null };
        } catch {
          return { dn, name, powerKw: 0, statusCode: null };
        }
      }),
    );
    res.status(200).json({ inverters: results });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
