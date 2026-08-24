# GamalierSolar — Crónica completa y estado del proyecto

> Documento maestro de referencia. Última actualización: 24-ago-2026.
> Complementa a AGENTS.md (instrucciones técnicas para asistentes de código).

---

## 1. Qué es y cómo funciona HOY

**GamalierSolar** es una PWA (app instalable en celular/PC sin tienda) para monitorizar la planta fotovoltaica **VI-0-0 Greenex** (Mostazal, Chile): 5 inversores Huawei de 100 kW = **500 kWp**, conectada a red desde el 2025-01-08.

```
Celular/PC ──► PWA React (https://gamaliersolar.web.app, Firebase Hosting)
                    │  fetch cada 60 s
                    ▼
              Backend Vercel (https://gamaliersolar-api.vercel.app)
                    │  se LOGUEA SOLO contra FusionSolar (UNISSO)
                    ▼
              https://la5.fusionsolar.huawei.com (portal web de Huawei)
```

- Modo REAL activo (`VITE_DATA_MODE=real` en `.env.local`).
- Si el backend cae, la app muestra los últimos datos guardados en el teléfono (caché `lastgood`) — nunca queda vacía.
- Las actualizaciones de la app se propagan solas a todos los dispositivos (auto-actualizador por `version.txt`).
- Endpoints del backend: `/api/snapshot` (KPIs estación + curva día), `/api/inverters` (5 inversores auto-descubiertos con kW individual), `/api/history` (día/mes/año).

## 2. Todo lo que se hizo (por fases)

### Fase 1 — App base (agosto 2026, sesiones previas)
- PWA completa: React 18 + TypeScript estricto + Vite + Tailwind v4 + Recharts.
- Modo DEMO con simulador determinista (reloj virtual ×1/×60/×600, pausa) para funcionar sin datos.
- Datos reales de la planta cargados en `src/domain/plant.ts`: SNs de los 5 inversores, SmartLogger `1024A7355270`, medidor, coordenadas Mostazal, moneda CLP (tarifa 120 CLP/kWh), CO₂ 0,4 kg/kWh.
- Logo real integrado (iconos PWA, favicon, header).
- Compartir acceso por QR en Ajustes (copiar/compartir/descargar PNG).
- Publicación: Firebase Hosting (`firebase deploy --only hosting`).

### Fase 2 — Descubrimiento del API interno de FusionSolar
- Con la sesión web del usuario se exploró el portal y se mapearon endpoints reales (documentados en AGENTS.md): KPIs de estación, detalle con curva cada 5 min, estadísticas de alarmas, flujo de energía.
- Confirmación de datos reales: 500 kW instalados, tz America/Santiago, medidor presente.

### Fase 3 — Primera conexión (vía cookies del navegador, luego abandonada)
- Backend en Vercel que reutilizaba la cookie de sesión del navegador del dueño.
- Funcionaba… hasta descubrir que **Huawei ata cada sesión a la IP**: cuando el servidor (EE.UU.) usaba la sesión creada en Chile, el WAF la invalidaba globalmente en minutos. Se comprobó dos veces con sesiones frescas.
- Consecuencia: esa vía era insostenible (pedir cookies una y otra vez).

### Fase 4 — Solución definitiva interina (23-24 ago 2026) ⭐
1. **Service Worker v3**: HTML siempre por red (`network-first`) + `skipWaiting` → los teléfonos dejaron de quedarse pegados en la versión DEMO cacheada.
2. **Auto-actualizador permanente**: cada build escribe `public/version.txt` (hook `prebuild`, script `scripts/write-version.mjs`) y un script en `index.html` recarga con cache-buster cuando detecta versión nueva. Ningún dispositivo viejo vuelve a quedar obsoleto.
3. **Franja roja "Reintentar" eliminada** del Dashboard: solo aparece aviso si no hay NINGÚN dato; los errores se reintentan solos en segundo plano cada 60 s.
4. **Caché anti-vacío** en `src/store.tsx`: toda carga exitosa se persiste y se hidrata al arrancar.
5. **Autologin del backend** (ingeniería inversa del bundle `login.*.min.js` del propio portal):
   - `POST /rest/dp/uidm/unisso/v1/validate-user?service=/rest/dp/uidm/auth/v1/on-sso-credential-ready`
     cuerpo `{username, password, verifycode:""}` (HTTPS), header `App-Id: smartpvms` → devuelve **ticket CAS**.
   - `GET on-sso-credential-ready?ticket=...` siguiendo redirecciones solo dentro de la5.fusionsolar.huawei.com.
   - `GET /rest/pvms/web/login/v1/redirecturl?isFirst=false` → establece la sesión PVMS (JSESSIONID).
   - Reintento automático ante 302/401. Credenciales como secretos cifrados de Vercel: `FS_USER`, `FS_PASS`.
6. **Parámetro `idsite` descubierto**: las consultas de señales por dispositivo exigen `&idsite=<stationDnId>` (lo entrega el listado de equipos); sin él: "dn is illegal".
7. **Señal de potencia identificada y verificada**: `10024` = kW activos por inversor. Verificación empírica: suma de los 5 (34,2 kW) ≈ potencia reportada por la estación en el mismo minuto (43,2 kW, desfase de muestreo ~5 min).
8. **Auto-descubrimiento de equipos**: `/rest/neteco/web/config/device/v1/device-list?conditionParams.parentDn=NE%3D35346190...` filtra `mocTypeName==="Inverter"` → DNs reales A=35346194, B=35346195, C=35346196, D=35346198, E=35435360. (Los DNs 35346192/98 capturados antes pertenecían a otra planta de la cuenta.)
9. **Estado final verificado en producción**: `/api/snapshot` 200 con curva real; `/api/inverters` 200 con los 5 inversores y kW individuales; `/api/history` 200 (ej.: día con 412 kWh, pico 167 kW).

## 3. Lecciones aprendidas (no repetir)

- CLI de Vercel: correr SIEMPRE desde `backend/` (donde vive `.vercel`); salida a archivo (`*> "$env:TEMP\x.txt"`); nunca tubería viva (se cuelga con ChildProcess.kill). Valores con `;`: stdin o `--value "..." --yes`.
- PowerShell 5.1: `$?` da falso si hubo stderr aunque el comando triunfara → no encadenar deploy tras build verboso.
- Cookies de sesión web de Huawei: atadas a IP; morirán si otro origen/IP las usa. No insistir por esa vía.
- `document.cookie` no muestra cookies HttpOnly (JSESSIONID/dp-session).
- Bundles SPA del portal tras login dan 403 sin sesión; el bundle de LOGIN es público y ahí está el flujo UNISSO.
- Señales: UNA señal por llamada (las comas fallan); incluir SIEMPRE `idsite`.
- No adivinar endpoints: buscar strings en el JS del portal o pedir volcado del Network tab.

## 4. Pendientes técnicas (siguientes pasos naturales)

1. **Medidor** (compra/venta/inyección): ya está en el device-list (7 equipos en total; filtrar `mocTypeName==="Meter"`) → mismo patrón kpi+idsite y mapear sus señales.
2. **Alarmas**: endpoint visto `/rest/pvms/fm/v1/statistic?stationDn=...`; conectar a `/api/alarms`.
3. **Irradiancia / temperaturas / PR** del Dashboard: derivar o buscar sensores disponibles.
4. Confirmar modelos exactos de inversores (¿SUN2000-100KTL?), tarifa CLP/kWh contractual, nº de strings.
5. **Si el usuario cambia su contraseña del portal**: actualizar secreto `FS_PASS` en Vercel (el backend dejará de loguearse hasta entonces).
6. Cuando Delta Activos entregue la cuenta **Northbound** oficial (1 req/min por interfaz): migrar el backend a esa API — el cacheo actual de 25 s ya es compatible.

## 5. Costos / gratuidad

- Firebase Hosting Spark y Vercel Hobby: uso ínfimo, sin riesgo cercano de pago.
- La restricción histórica nunca fue el hosting sino la política de sesiones de Huawei — resuelta con autologin.
