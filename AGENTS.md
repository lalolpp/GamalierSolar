# AGENTS.md — Contexto del proyecto GamalierSolar

Instrucciones y estado para asistentes de código (opencode u otros). Leer antes de trabajar.

## Qué es

PWA de monitorización fotovoltaica: React 18 + TypeScript estricto + Vite + Tailwind CSS v4 + Recharts + lucide-react. Arquitectura en capas:

```
UI (views/) → store.tsx → services/ → data/DataProvider → demoProvider | huaweiProvider
```

Reglas clave: las vistas NUNCA importan `lib/sim.ts`; sin secretos en frontend; sin `any`; TypeScript estricto debe pasar (`npm run typecheck`) junto con `npm run build` antes de cada commit.

## ⭐ SEGUIR DESDE AQUÍ (nota para la próxima sesión, escrita el 23-ago-2026)

**Lo último logrado — DATOS REALES funcionando end-to-end en local:**
- **Login SSO automatizado** contra `la5.fusionsolar.huawei.com`, sin cookies manuales: `validate-user` → `on-sso-credential-ready?ticket` (NO seguir redirect a console.digipowercloud, dominio muerto) → `login/v1/redirecturl` → `cloud.html` (extraer zone-id/instance-id de la URL) → `privilege/er/v2/session`. Sesión TTL 20 min con re-login automático.
- **Paths correctos: `station/v1`** (el v3 de abajo está OBSOLETO: `station-kpi-data` v3 da 404). Todo sale de `station-detail` v1: currentPower, daily/month/year/cumulativeEnergy, realtimePower (curva), rptNrgKpi (desglose día pv/selfUse/onGrid/buy), co2, dirección.
- **Inventario completo descubierto** vía `device-list` (ver IDs más abajo).
- **Backend dual con CONTRATO ÚNICO**: `GET /api/snapshot`, `/api/inverters`, `/api/history?unit=day|month|year`:
  - `backend/api/*` = Vercel serverless (producción). Login automático integrado.
  - `server/index.mjs` = Node standalone para desarrollo local (puerto 8787; credenciales SOLO en `server/.env`, gitignored).
- `huaweiProvider.ts` consume ese contrato; cuenta inversores online reales; `.env.local` local ya apunta a localhost:8787.
- Probado: snapshot (1807 kWh hoy, desglose OK), inverters (5 conectados), history. De noche la potencia es 0/"Standby : no sunlight" y la curva viene vacía.

**Pasos a seguir, en orden:**
1. **Desplegar backend a Vercel** y configurar env vars `FS_USER`, `FS_PASS` (+ opcionales `FS_DOMAIN`, `FS_STATION_DN`). Verificar `/api/snapshot` en producción.
2. **Compilar PWA apuntando a la URL de Vercel** (`VITE_HUAWEI_ENDPOINT=https://<proyecto>.vercel.app`) y `firebase deploy --only hosting`. OJO: el endpoint se hornea en el build.
3. Cuando Delta Activos dé acceso: migrar a Northbound oficial (mismo contrato de backend, cambia el `_huawei.js`).
4. Técnicas pendientes: señales del medidor (compra/venta/red, deviceDn NE=36418914); endpoint de alarmas; histórico multi-día (endpoints de reportes); mapear SN real por inversor para nombres INV-A..E exactos.

**Estado producción:** https://gamaliersolar.web.app — tras cada cambio: `npm run build` + `firebase deploy --only hosting`.

## Estado actual (agosto 2026)

- **PWA publicada en producción: https://gamaliersolar.web.app** (Firebase Hosting, proyecto `gamaliersolar`, cuenta edo.electric@gmail.com).
- Para publicar cambios: `npm run build` y luego `firebase deploy --only hosting` (CLI instalada y logueada en este PC; en otro PC: `npm i -g firebase-tools && firebase login`).
- App funcional en modo DEMO con simulador determinista (reloj virtual ×1/×60/×600, pausa).
- Cargados datos reales de la planta en `src/domain/plant.ts`:
  - Planta **VI-0-0 Greenex** (Chile), 5 inversores de **100 kW c/u = 500 kWp**.
  - SNs reales: INV-A `ES2490037999`, INV-B `ES2480057718`, INV-C `ES2490034408`, INV-D `BN2471011691`, INV-E `ES2490037859`.
  - SmartLogger `1024A7355270`, medidor `AM001024A7355270`.
  - Moneda **CLP** (tarifa por defecto 120 CLP/kWh), CO₂ 0,4 kg/kWh.
- Logo real integrado (iconos PWA, favicon, header a 90px).
- Compartir acceso por QR en Ajustes (copiar/compartir/descargar PNG).

## Pendiente principal: conexión a datos REALES

**Roles:** *Greenex* = empresa donde está la planta fotovoltaica (propietaria del sitio/activo). *Delta Activos* = empresa externa que instaló todo (instalador/EPC) y presta el servicio de monitoreo anual pago; probablemente es el administrador del portal FusionSolar.

**Estrategia acordada (agosto 2026): ESPERAR.** El usuario conseguirá el contrato con Delta Activos para revisar qué cubre el pago anual de monitoreo y cómo negociar la cuenta Northbound antes de pedirla.

Contexto técnico ya verificado:
- IP pública del SmartLogger `186.189.73.75`: puertos 80/443/502 aceptan TCP pero NO responden datos desde internet (CGNAT/filtrado). La consola local y Modbus solo son accesibles desde la red interna de la planta.
- Vía alternativa si Delta no coopera: registro como PROPIETARIO en FusionSolar con los SNs + documentos de propiedad, o ruta local (requiere estar en red de la planta / túnel).

Cuando se obtenga la cuenta Northbound, implementar:
1. Backend pequeño que guarde usuario/systemCode y exponga `/api/live`, `/api/inverters`, `/api/history`, `/api/alarms`.
2. Implementar `src/data/huaweiProvider.ts` contra ese backend.
3. `.env.local`: `VITE_DATA_MODE=real` + `VITE_HUAWEI_ENDPOINT=<url backend>`.

Datos que entregará Delta/Huawei al crear la cuenta API (menú Sistema → Gestión de empresas → crear cuenta Northbound): usuario API, systemCode y dominio regional del portal (ej. la5.fusionsolar.huawei.com). Límite: 1 consulta/min por interfaz.

## Datos pendientes de confirmar por el usuario

- Modelos exactos de los inversores (¿SUN2000-100KTL?)
- Tarifa CLP/kWh contractual
- Nº de strings por inversor (el simulador usa 6)

## API interno del portal FusionSolar (descubierto ago 2026; corregido 23-ago-2026)

Dominio: `https://la5.fusionsolar.huawei.com` — el backend hace login SSO automático (ver sección ⭐). Endpoints VERIFICADOS funcionando:

- `GET /rest/pvms/web/station/v1/overview/station-detail?stationDn=NE%3D35346190` → TODO en uno: currentPower, dailyEnergy, monthEnergy, yearEnergy, cumulativeEnergy (1.19 GWh), inverterPower(500), realtimePower (curva), rptNrgKpi (día/mes/año/vida: pvNrg, onGridNrg, buyNrg, selfUseNrg), co2, dirección, coordenadas, gridConnectedTime.
- `GET /rest/pvms/web/device/v1/device-real-kpi?deviceDn=<dn>&signalIds=10025` → señal INDIVIDUAL por llamada (con coma falla). 10025 = potencia activa kW. De noche devuelve string "Standby : no sunlight".
- `GET /rest/neteco/web/config/device/v1/device-list?conditionParams.parentDn=NE%3D35346190&conditionParams.curPage=0&conditionParams.recordperpage=300` → inventario completo (dn, dnId, mocTypeName Inverter/SmartLogger/Power Sensor).
- `POST /rest/dp/uidm/unisso/v1/validate-user?service=...` con header `app-id: smartpvms` → login paso 1.

OBSOLETOS (dan 404 con sesión válida, NO usar): `/station/v3/overview/*` (kpi-data, station-detail, statistic, energy-flow). El flujo de login y headers zone-id/app-id/instance-id están implementados en `backend/api/_huawei.js`.

IDs clave: planta `stationDn=NE=35346190` (`dnId=13932521`, parentDn NE=33757771). Inventario COMPLETO descubierto via `GET /rest/neteco/web/config/device/v1/device-list?conditionParams.parentDn=NE%3D35346190&conditionParams.curPage=0&conditionParams.recordperpage=300` (funciona con sesión web):
- **Inversores ×5**: NE=35346194 (dnId 13932524), NE=35346195 (13932525), NE=35346196 (13932526), NE=35346198 (13932528), NE=35435360 (14970714).
- **SmartLogger**: NE=35346192 (dnId 13932522) — ojo: NO es un inversor.
- **Medidor (Power Sensor)**: NE=36418914 (dnId 19698200).
- Nota nocturna: `device-real-kpi` señal 10025 devuelve `"Standby :  no sunlight"` (string → null) cuando no hay sol; `status:1` sigue en 1.

Datos reales confirmados: 500 kW, conexión a red 2025-01-08, Mostazal (O'Higgins), lat -34.029986 lon -70.620429, tz America/Santiago, existMeter=true.

## Convenciones

- Commits en español, prefijo tipo `feat:`/`fix:`/`ui:`.
- Sin comentarios en el código salvo petición explícita.
- localStorage versionado (`gamaliersolar:v2:*`); al cambiar estructura, subir versión y mapear legacy keys en `src/lib/storage.ts`.
