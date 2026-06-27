# Mesh Network Venezuela

Herramienta **offline-first** para paramédicos y brigadas de rescate en **La Guaira**. Registra personas afectadas con GPS, persiste en SQLite y transmite datos por **SMS manual** cuando hay señal GSM — sin internet ni servidores.

- **App de campo:** APK Android (`com.vic_arx.meshnetworkvenezuela`)
- **Demo web:** [meshnetwork-venezuela.vercel.app](https://meshnetwork-venezuela.vercel.app) (capacitación; no sustituye el APK)
- **Repo:** [github.com/dynastymarketinga/MeshnetworkVenezuela](https://github.com/dynastymarketinga/MeshnetworkVenezuela)

---

## Capacidades (sin internet)

| Función | Tecnología |
|---------|------------|
| Registro táctico + triaje | SQLite + GPS obligatorio |
| Persistencia tras apagado | `expo-sqlite` (WAL) |
| Navegación a punto | `geo:` / Google Maps / OsmAnd offline |
| Enlace entre brigadas | SMS comprimido `MNv1\|1/3\|…` |
| Fusión sin duplicados | `INSERT OR IGNORE` |

---

## Compilar APK (producción)

```powershell
npm install
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile preview
```

Instalación en teléfonos: ver **`INSTALACION_APK_CAMPO.md`**.  
Validación en terreno: ver **`CHECKLIST_VALIDACION_CAMPO.md`**.

### Configuración operativa

Editar `src/config/OperacionConfig.ts`:

- `COMANDO_CENTRAL_SMS` — número Bomberos / Protección Civil La Guaira
- `BRIGADA_ID`, `NOMBRE_COMANDO`

---

## Desarrollo local (Expo)

```powershell
npm install
npx expo start
```

Para probar en dispositivo físico con módulos nativos (SQLite, SMS, GPS):

```powershell
npm run run:android
```

---

## Arquitectura

```
src/
├── config/OperacionConfig.ts
├── domain/entities, repositories, services
├── infrastructure/
│   ├── database/SQLiteDatabase.ts
│   ├── repositories/SQLiteReporteRepository.ts
│   └── services/Location, Navigation, SmsDirect
├── screens/HomeScreen.tsx
└── theme/BrutalistTheme.ts
```

---

## Despliegue web (Vercel)

Framework: **Other** · Output: `.` · `vercel.json` sirve `index.html`.

La web usa `localStorage` como demo; la operación real es el **APK**.

---

## Licencia

Uso operativo — Mesh Network Venezuela / La Guaira.
