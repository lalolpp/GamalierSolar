export interface PlantDevice {
  id: string;
  name: string;
  serialNumber: string;
  capacityKw: number;
}

export const PLANT_PROFILE = {
  plantName: "VI-0-0 Greenex",
  country: "Chile",
  capturedAt: "2026-08-22T00:00:00",
  location: {
    address: "Mostazal, Libertador General Bernardo O'Higgins",
    latitude: -34.029986,
    longitude: -70.620429,
    timezone: "America/Santiago",
  },
  commissioningDate: "2025-01-08",
  smartlogger: {
    name: "Logger-1024A7355270",
    serialNumber: "1024A7355270",
    publicIp: "186.189.73.75",
  },
  meter: {
    name: "Meter-AM001024A7355270",
    serialNumber: "AM001024A7355270",
    activePowerW: -248.369,
    reactivePowerVar: -144.609,
    powerFactor: -0.864,
  },
  fusionSolar: {
    domain: "https://la5.fusionsolar.huawei.com",
    stationDn: "NE=35346190",
    dnId: 13932521,
  },
  devices: [
    { id: "INV-A", name: "Inversor A", serialNumber: "ES2490037999", capacityKw: 100 },
    { id: "INV-B", name: "Inversor B", serialNumber: "ES2480057718", capacityKw: 100 },
    { id: "INV-C", name: "Inversor C", serialNumber: "ES2490034408", capacityKw: 100 },
    { id: "INV-D", name: "Inversor D", serialNumber: "BN2471011691", capacityKw: 100 },
    { id: "INV-E", name: "Inversor E", serialNumber: "ES2490037859", capacityKw: 100 },
  ] as PlantDevice[],
};

export const TOTAL_PLANTED_KW = PLANT_PROFILE.devices.reduce((s, d) => s + d.capacityKw, 0);
