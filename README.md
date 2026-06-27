# Mesh Network Venezuela

Herramienta **offline-first** para paramédicos y brigadas de rescate en **La Guaira**. Registra personas, infraestructura dañada y familias sin vivienda con GPS, persiste en SQLite y transmite por **SMS manual** (`MNv2`) cuando hay señal GSM.

- **App de campo:** APK Android v1.2.0 (`com.vic_arx.meshnetworkvenezuela`)
- **Hub integración:** [meshnetwork-venezuela.vercel.app/api/hub](https://meshnetwork-venezuela.vercel.app/api/hub) (otras apps; requiere Vercel KV)
- **Demo web:** [meshnetwork-venezuela.vercel.app](https://meshnetwork-venezuela.vercel.app) (no sustituye el APK)
- **Repo:** [github.com/dynastymarketinga/MeshnetworkVenezuela](https://github.com/dynastymarketinga/MeshnetworkVenezuela)

---

## Capacidades APK (sin internet)

| Función | Tecnología |
|---------|------------|
| Registro táctico + triaje | SQLite WAL + GPS obligatorio |
| Tipos de registro | Persona atrapada, infraestructura, sin vivienda |
| Enlace entre brigadas | SMS `MNv2\|1/3\|…` (compatible MNv1) |
| Fusión | `INSERT OR IGNORE` / `REPLACE` si timestamp mayor |
| UI | Editorial brutalista claro: papel `#F5F0E8`, tinta `#1C1C1C`, acento azul `#4A8FC7` |

---

## Hub centralizado (Vercel KV)

Para **otros desarrolladores** que quieran evitar bases fragmentadas:

| Endpoint | Uso |
|----------|-----|
| `GET /api/hub?action=consultar` | Consultar duplicados antes de guardar |
| `POST /api/hub?action=registrar` | Registrar `ReporteEmergencia` |

Documentación completa: **`HUB_INTEGRACION_DESARROLLADORES.md`**

Variables Vercel: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, opcional `HUB_API_KEY`.

---

## Compilar APK

```powershell
npm install
npx eas-cli build --platform android --profile preview --non-interactive
```

Instalación: **`INSTALACION_APK_CAMPO.md`** · Campo: **`PRUEBA_RESCATISTAS.md`**

### Configuración operativa

`src/config/OperacionConfig.ts` — `COMANDO_CENTRAL_SMS`, `BRIGADA_ID`, `FUENTE_ORIGEN`.

---

## Arquitectura

```
shared/reporte.types.ts     # Modelo unificado APK + Hub
src/
├── domain/ + infrastructure/ (SQLite, Location, SMS)
├── screens/HomeScreen.tsx
└── theme/TacticalTheme.ts
api/
├── hub.ts                  # Serverless Vercel KV
└── _lib/
```

---

## Despliegue Vercel

1. Activar **Vercel KV** en el proyecto
2. Push → deploy automático
3. Probar Hub en pestaña **Hub** del dashboard o con `curl`

La web demo usa `localStorage`; operación real = **APK**.

---

## Licencia

Uso operativo — Mesh Network Venezuela / La Guaira.
