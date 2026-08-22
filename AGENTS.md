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
- Fecha real de puesta en marcha
- Tarifa CLP/kWh contractual
- Nº de strings por inversor (el simulador usa 6)

## Convenciones

- Commits en español, prefijo tipo `feat:`/`fix:`/`ui:`.
- Sin comentarios en el código salvo petición explícita.
- localStorage versionado (`gamaliersolar:v2:*`); al cambiar estructura, subir versión y mapear legacy keys en `src/lib/storage.ts`.
