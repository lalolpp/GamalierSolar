const { portalGet, cors, httpError, num } = require("./_huawei");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo no permitido" });
  try {
    const dns = (process.env.FS_DEVICE_DNS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!dns.length) return res.status(200).json({ inverters: [] });
    const results = await Promise.all(
      dns.map(async (dn) => {
        try {
          const j = await portalGet(
            `/rest/pvms/web/device/v1/device-real-kpi?deviceDn=${encodeURIComponent(dn)}&signalIds=10025`,
            { ttlMs: 30_000 },
          );
          return {
            dn,
            powerKw: num(j.data?.signals?.["10025"]?.value),
            statusCode: j.data?.status ?? null,
          };
        } catch {
          return { dn, powerKw: 0, statusCode: null };
        }
      }),
    );
    res.status(200).json({ inverters: results });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
