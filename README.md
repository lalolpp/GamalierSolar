# GamalierSolar

Monitorización de planta fotovoltaica como PWA: dashboard en tiempo real, historial con exportación CSV, dispositivos, alarmas y ajustes. Incluye un **simulador local determinista** (modo demo) y una arquitectura preparada para conectar una **API real de planta (Huawei FusionSolar)** en el futuro.

> **Nota importante:** actualmente **no existe conexión real** con Huawei FusionSolar. El modo real está preparado mediante una interfaz/adaptador, pero mientras no haya backend ni credenciales la aplicación funciona exclusivamente con el simulador.

## Stack

- React 18 + TypeScript estricto + Vite
- Tailwind CSS v4
- Recharts + lucide-react
- `qrcode-generator` (MIT, ~12 kB): genera el QR de "Compartir acceso"; se eligió librería en lugar de implementar el codificador a mano por fiabilidad
- Sin dependencias extra para PWA (manifest + service worker propios)

## Arquitectura

```
UI (views/)  →  store.tsx  →  services/  →  data/DataProvider  →  demoProvider | huaweiProvider
```

```
src/
├── components/       # ui.tsx (primitivas) y charts.tsx (Recharts)
├── views/            # Dashboard, History, Devices, Alarms, Settings
├── domain/           # types.ts (modelos de dominio) y defaults.ts
├── data/             # DataProvider.ts, demoProvider.ts, huaweiProvider.ts, index.ts
├── services/         # telemetry, history (+CSV), devices, alarms
├── lib/              # sim.ts (simulador puro), storage.ts, format.ts, validation.ts, config.ts
├── store.tsx         # estado global, reloj virtual, toasts, persistencia
└── main.tsx / App.tsx / index.css
```

Reglas clave:

- Las vistas **nunca** importan `lib/sim.ts`; todo pasa por `DataProvider`.
- El proveedor real no finge estar conectado: sin configuración muestra *"Proveedor real no configurado"*.
- Persistencia versionada en `localStorage` (`gamaliersolar:v1:*`) con migración desde claves antiguas.
- Los secretos nunca van al frontend; la integración real será `Frontend → backend/serverless → Huawei API`.

## Modo demo

El simulador genera datos deterministas:

- Curva solar con estacionalidad y nubosidad.
- Rendimiento individual por inversor y por string.
- Reloj virtual con velocidades ×1, ×60, ×600 y pausa.
- Histórico diario/mensual/anual y alarmas generadas dinámicamente.

## Modo real (futuro — Huawei FusionSolar)

`src/data/huaweiProvider.ts` contiene el esqueleto del adaptador. Para implementarlo:

1. Despliega un backend/serverless que hable con la API Northbound de FusionSolar (usuario y secreto solo en el servidor).
2. Expón endpoints tipo `/live`, `/inverters`, `/history`, `/alarms`.
3. Implementa los métodos de `DataProvider` llamando a ese backend.
4. Configura `VITE_HUAWEI_ENDPOINT=https://tu-backend/...` (URL pública del backend, nunca secretos).
5. Arranca con `VITE_DATA_MODE=real`.

## Variables de entorno

Copia `.env.example` a `.env.local`:

| Variable | Valores | Descripción |
|---|---|---|
| `VITE_DATA_MODE` | `demo` (por defecto), `real` | Origen de datos |
| `VITE_APP_VERSION` | p. ej. `1.1.0` | Versión mostrada en Diagnóstico |
| `VITE_HUAWEI_ENDPOINT` | URL | Endpoint público del backend intermedio (solo necesario en modo real) |

## Instalación y ejecución

```bash
npm install
npm run dev        # desarrollo
npm run typecheck  # comprobación de tipos
npm run build      # typecheck + build de producción
npm run preview    # sirve dist/
npm run check      # typecheck + build
```

## PWA

Manifest, iconos y service worker incluidos en `public/`. Al desplegar sobre HTTPS la app es instalable en Android (display standalone). Los iconos actuales son **placeholders** generados; sustitúyelos por el branding definitivo manteniendo nombres y tamaños.

## Exportación CSV

El historial exporta con BOM UTF-8, separador `;` y encabezados claros, compatible con Excel en español: `gamaliersolar_historial_YYYY-MM-DD.csv`.

## Acceso desde móvil / Compartir por QR

En **Ajustes → Compartir acceso** se genera un código QR con la URL de la aplicación:

1. Ejecuta `npm run dev -- --host` (o accede ya con la IP del PC).
2. Sustituye `localhost` en el campo de enlace por la IP local del equipo (p. ej. `http://192.168.1.50:5173`).
3. Escanea el QR desde el móvil (misma red Wi-Fi), comparte el enlace o descarga el QR como PNG.

Para acceder desde fuera de tu red, despliega la app en un hosting estático (Vercel, Netlify…) con `npm run build`.

## Pendiente para producción

- Implementar backend seguro y completar `huaweiProvider`.
- Sustituir iconos placeholder por branding final.
- Definir estrategia de caché offline avanzada si se requiere.
