# AGENTS.md — Contexto del proyecto GamalierSolar

Instrucciones y estado para asistentes de código (opencode u otros). Leer antes de trabajar.

## Qué es

PWA de monitorización fotovoltaica: React 18 + TypeScript estricto + Vite + Tailwind CSS v4 + Recharts + lucide-react. Arquitectura en capas:

```
UI (views/) → store.tsx → services/ → data/DataProvider → demoProvider | huaweiProvider
```

Reglas clave: las vistas NUNCA importan `lib/sim.ts`; sin secretos en frontend; sin `any`; TypeScript estricto debe pasar (`npm run typecheck`) junto con `npm run build` antes de cada commit.

## ⭐ SEGUIR DESDE AQUÍ (nota para la próxima sesión, escrita el 22-ago-2026)

**Lo último logrado:** con la sesión web del usuario se exploró el portal FusionSolar y se descubrió su API interno (documentado más abajo). Se obtuvieron DATOS REALES en vivo de la planta: potencia actual, curva del día cada 5 min, energía día/mes/año/vida, 0 alarmas activas. Los datos confirmados ya viven en `src/domain/plant.ts` (coordenadas Mostazal, puesta en marcha 2025-01-08, stationDn NE=35346190).

**Pasos a seguir, en orden:**
1. **Esperar contrato de Delta Activos** (usuario lo está consiguiendo) para decidir si pedimos cuenta Northbound formal. La plantilla de correo/WhatsApp para pedirla se redactó en chat; volver a generarla cuando toque.
2. **Opción interina PROPUESTA pero NO aprobada:** backend que haga login web con las credenciales del usuario y consuma los endpoints internos de abajo (no oficial: puede cambiar o limitarse; no guardar esas claves sin consentimiento explícito).
3. **Cuando haya vía elegida (NB o interina):** crear backend que guarde credenciales y exponga `/api/live`, `/api/inverters`, `/api/history`, `/api/alarms` → implementar `src/data/huaweiProvider.ts` → `.env.local` con `VITE_DATA_MODE=real` + `VITE_HUAWEI_ENDPOINT`.
4. **Tareas técnicas pendientes del API interno:** mapear signalIds por tipo de equipo (10025 respondió; 10095 vacío); descubrir parámetros correctos de `running-status`; obtener los deviceDn de los 5 inversores y del medidor (entrando a la página de cada equipo en el portal, como se hizo con NE=35346192, o buscando un endpoint de listado).

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

## API interno del portal FusionSolar (descubierto ago 2026, vía sesión web del usuario)

Dominio: `https://la5.fusionsolar.huawei.com` — requiere cookie de sesión web (o backend con login). Endpoints verificados con datos reales:

- `GET /rest/pvms/web/station/v3/overview/station-kpi-data?stationDn=NE%3D35346190` → KPIs: dailyEnergy, cumulativeEnergy, inverterPower, currency(19).
- `GET .../station/v3/overview/station-detail?stationDn=...` → metadatos completos + `realtimePower` curva cada 5 min + rptNrgKpi (día/mes/año/vida: pvNrg, onGridNrg, buyNrg, selfUseNrg) + coordenadas + gridConnectedTime 2025-01-08.
- `GET .../station/v3/overview/statistic?stationDn=...` → conteo de alarmas por severidad 1-4.
- `GET .../station/v3/overview/energy-flow?stationDn=...&featureId=sellpower` → flujo energía.
- `GET /rest/pvms/web/device/v1/device-real-kpi?deviceDn=NE%3D35346192&signalIds=10025` → señal INDIVIDUAL por llamada (con coma falla). signalIds válidos aún por mapear; 10025 respondió, 10095 vacío.
- `running-status` requiere parámetros adicionales (pendiente).

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
