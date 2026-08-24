# AVANCE — Bitácora del proyecto GamalierSolar

> Última actualización: 24-ago-2026. **DATOS REALES COMPLETOS EN PRODUCCIÓN.**

## Estado en una línea
Backend con AUTLOGIN propio contra FusionSolar (sin depender del navegador de nadie): snapshot, historial y los 5 inversores con potencia individual real funcionando en https://gamaliersolar-api.vercel.app.

## Logros del 23-24 ago (cronología resumida)

1. SW v3 + auto-actualizador por `version.txt` → los dispositivos ya no quedan pegados en versiones viejas.
2. Franja roja "Reintentar" eliminada del Dashboard; reintento automático silencioso cada 60 s.
3. Caché anti-vacío (`lastgood` en localStorage): si el backend cae, la app muestra los últimos datos.
4. **Hallazgo clave que cerró la vía vieja:** las sesiones web capturadas del navegador mueren en minutos cuando el backend las usa desde otra IP (WAF Huawei). Re-enviar cookies NO es viable.
5. **SOLUCIÓN DEFINITIVA INTERINA — autologin backend** (`backend/api/_huawei.js`):
   - `POST /rest/dp/uidm/unisso/v1/validate-user?service=/rest/dp/uidm/auth/v1/on-sso-credential-ready` con `{username, password, verifycode:""}` (password en claro por HTTPS, header `App-Id: smartpvms`) → devuelve ticket CAS.
   - `GET on-sso-credential-ready?ticket=...` (siguiendo redirecciones SOLO dentro de la5.fusionsolar.huawei.com).
   - `GET /rest/pvms/web/login/v1/redirecturl?isFirst=false` (headers `App-Id`, `Login-Url-Encode:true`) → establece JSESSIONID PVMS.
   - Reintento automático de login ante 302/401. Secretos: `FS_USER`, `FS_PASS` (Vercel, cifrados).
6. **Señales descubiertas por sondeo empírico (inversores SUN2000):**
   - Consulta válida: `device-real-kpi?deviceDn=NE%3Dxxx&signalIds=ID&idsite=13932521` ← el parámetro `idsite` es OBLIGATORIO para DNs del listado neteco ("dn is illegal" sin él).
   - `10024` = potencia activa kW (VERIFICADO: suma de los 5 ≈ currentPower de la estación).
   - `10025` = estado ("Grid connected", enum); `10021` = frecuencia 50 Hz; `10029/10030` = energía acumulada; `10027` = fecha último reporte.
7. `/api/inverters` ahora AUTO-DESCUBRE los inversores vía `/rest/neteco/web/config/device/v1/device-list?conditionParams.parentDn=NE%3D35346190...` (filtra `mocTypeName==="Inverter"`, usa `stationDnId` como idsite). DNs reales: A=35346194, B=35346195, C=35346196, D=35346198, E=35435360. Los DNs 35346192/98 capturados antes eran de otra planta del usuario.

## Lecciones / errores a no repetir

- CLI de Vercel: correr SIEMPRE desde `backend/` (donde vive `.vercel`), salida a archivo (`*> "$env:TEMP\x.txt"`), nunca tubería viva (se cuelga: ChildProcess.kill). Valores con `;`: stdin o `--value "..." --yes`.
- PowerShell 5.1: `$?` en falso por stderr aunque el comando haya triunfado → no encadenar deploy tras build verboso.
- Reverse-engineering del portal: descargar bundles SPA sin sesión da 403/página de error; el login bundle (`login.*.min.js`) sí es público y ahí estaba el flujo UNISSO completo.
- No adivinar endpoints a ciegas: buscar strings en el JS del portal o pedir volcado del Network tab.
- Señales: una sola señal por llamada (comas fallan); siempre incluir `idsite`.

## Pendientes técnicos

1. Medidor (compra/venta/inyección): está en el device-list (total 7 equipos, filtrar mocTypeName Meter) → mismo patrón kpi+idsite, mapear señales.
2. Alarmas: endpoint visto en capturas `/rest/pvms/fm/v1/statistic?stationDn=...`; integrar en `/api/alarms`.
3. Irradiancia/temperaturas/PR del Dashboard: derivar de potencia vs capacidad o buscar señales de estación meteorológica (si existe).
4. Confirmar modelos de inversores (¿SUN2000-100KTL?), tarifa CLP/kWh contractual, strings por inversor.
5. Rotación de contraseña: si el usuario cambia su clave del portal, actualizar secreto `FS_PASS`.
6. Considerar migrar a cuenta Northbound oficial cuando Delta Activos la dé (límite 1 req/min por interfaz; hoy el backend cachea 25 s, compatible).

## Gratuidad / costos

Firebase Hosting Spark y Vercel Hobby: uso ínfimo, sin riesgo cercano de pago. La restricción nunca fue el hosting sino las sesiones de Huawei — resuelto con autologin.
