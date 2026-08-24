# AVANCE — Bitácora del proyecto GamalierSolar

> Última actualización: 23-ago-2026 (sesión con muchos hallazgos). Complementa a AGENTS.md.

## Estado de hoy en una línea
App publicada en modo REAL con auto-actualización y caché anti-vacío; el bloqueo es Huawei: la sesión web muere cuando el backend (EE.UU.) la usa desde otra IP.

## Qué pasó hoy (cronología)

1. **Service Worker v3 desplegado** (`public/sw.js`): HTML network-first + `skipWaiting` + `clients.claim`. Motivo: los celulares quedaban pegados en la versión DEMO cacheada.
2. **Auto-actualizador permanente**: `npm run build` ahora escribe `public/version.txt` (`scripts/write-version.mjs`, hook `prebuild`) y `index.html` tiene un script que recarga con cache-buster si detecta versión distinta. Los dispositivos viejos se refrescan solos.
3. **Franja roja "Reintentar" eliminada del Dashboard** (`src/views/Dashboard.tsx`): solo se muestra aviso si NO hay ningún dato; el reintento automático sigue cada 60 s en segundo plano.
4. **Caché anti-vacío** (`src/store.tsx`): cada carga exitosa se guarda en localStorage (`lastgood`) y al arrancar la app hidrata desde ahí. Si el backend cae, se ven los últimos datos, nunca vacío.
5. **Backend Vercel**: secretos `FS_SESSION_COOKIE`, `FS_ROARAND`, `FS_DEVICE_DNS` cargados; `/api/inverters` responde estructura correcta.
6. **Descubrimiento clave (bloqueante)**: las cookies de sesión web de FusionSolar quedan atadas a la IP/origen. Flujo observado 2 veces: sesión capturada del navegador (Chile) funciona un rato → primera llamada desde Vercel (EE.UU.) dispara al WAF → sesión invalidada GLOBALMENTE en minutos (302 al login también desde Chile). Conclusión: re-enviar cookies del navegador NO es viable como solución estable.

## Lecciones / errores a no repetir

- CLI de Vercel: correr SIEMPRE desde `backend/` (donde vive `.vercel`), redirigir salida a archivo (`*> "$env:TEMP\x.txt"`), nunca por tubería en vivo (se cuelga). Para valores con `;` usar stdin (`Write-Output $val | vercel env add ...`) o `--value "..." --yes`.
- PowerShell 5.1: `$?` se pone en falso si hay stderr aunque el comando haya triunfado → no encadenar deploys con `if ($?)` después de builds verbosos.
- `document.cookie` NO muestra cookies HttpOnly (JSESSIONID/dp-session) → pedir "Copy as cURL" o copiar cabeceras Cookie+roarand a mano.
- Señal de potencia por inversor: `device-real-kpi?deviceDn=...&signalIds=10025` (individual, sin comas). `10095` responde vacío.
- No adivinar endpoints: todo lo inventado cae al HTML de la SPA. Obtener URLs reales del Network tab o con el colector de performance.

## Bloqueado / decisión pendiente del usuario

**Elegir vía para datos estables:**
- **Opción A (recomendada, interina):** backend se loguea solo contra FusionSolar con usuario/clave guardados como secretos (sesión creada DESDE Vercel = misma IP = estable). Requiere consentimiento explícito para guardar credenciales + enviarlas.
- **Opción B:** esperar cuenta Northbound oficial con Delta Activos (1 req/min por interfaz, sin hacks).

## Pendientes técnicos

1. Login automático en backend (Opción A) o Northbound (Opción B).
2. DNs reales de los 5 inversores + medidor de la planta NE=35346190 (los capturados 35346192/98 son probablemente de OTRA planta: reportan 0 kW con status standby mientras la planta genera ~290 kW). Método: colector JS en Console mientras se navega a Dispositivos → cada inversor.
3. Mapear señales del medidor (compra/venta/inyección) y alarmas (`fm/v1/statistic` visto en capturas).
4. Confirmar modelos de inversores (¿SUN2000-100KTL?), tarifa CLP/kWh contractual, strings por inversor.
5. `updatedAt` llega vacío en `/api/snapshot` (campo cosmético).

## Gratuidad / costos (pregunta recurrente)

- Firebase Hosting Spark (gratis) y Vercel Hobby (gratis): uso actual ínfimo (funciones ligeras, tráfico mínimo). Sin riesgo cercano de pagar.
- La restricción real NUNCA fue el hosting: es la política de sesiones de Huawei.
