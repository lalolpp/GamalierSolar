# AGENTS.md — Contexto del proyecto GamalierSolar

Instrucciones y estado para asistentes de código (opencode u otros). Leer antes de trabajar.

## Qué es

PWA de monitorización fotovoltaica: React 18 + TypeScript estricto + Vite + Tailwind CSS v4 + Recharts + lucide-react. Arquitectura en capas:

```
UI (views/) → store.tsx → services/ → data/DataProvider → demoProvider | huaweiProvider
```

Reglas clave: las vistas NUNCA importan `lib/sim.ts`; sin secretos en frontend; sin `any`; TypeScript estricto debe pasar (`npm run typecheck`) junto con `npm run build` antes de cada commit.

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

Falta que el usuario decida entre dos opciones y consiga los datos:

**Opción A — API oficial Huawei FusionSolar (Northbound/OpenAPI):**
1. Cuenta Northbound (usuario+clave de API, se solicita a Huawei/instalador citando el SmartLogger)
2. ID de planta (station code del portal FusionSolar)
3. URL regional del portal (ej: la5.fusionsolar.huawei.com)

**Opción B — SmartLogger local:** IP del equipo en la red de la planta + usuario/clave de solo lectura; requiere backend corriendo en sitio o VPN.

Implementación cuando haya credenciales:
1. Crear backend pequeño (Node/serverless en Vercel/Netlify) que guarde las claves y exponga `/api/live`, `/api/inverters`, `/api/history`, `/api/alarms`.
2. Implementar los métodos de `src/data/huaweiProvider.ts` llamando a ese backend.
3. Configurar `.env.local`: `VITE_DATA_MODE=real` + `VITE_HUAWEI_ENDPOINT=<url backend>`.

## Datos pendientes de confirmar por el usuario

- Modelos exactos de los inversores (¿SUN2000-100KTL?)
- Fecha real de puesta en marcha
- Tarifa CLP/kWh contractual
- Nº de strings por inversor (el simulador usa 6)

## Convenciones

- Commits en español, prefijo tipo `feat:`/`fix:`/`ui:`.
- Sin comentarios en el código salvo petición explícita.
- localStorage versionado (`gamaliersolar:v2:*`); al cambiar estructura, subir versión y mapear legacy keys en `src/lib/storage.ts`.
