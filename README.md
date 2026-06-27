# MeshnetworkVenezuela

Herramienta offline-first para paramédicos y brigadas de rescate en La Guaira, Venezuela. Registra incidentes y transporta datos sin depender de internet.

## Componentes

| Componente | Tecnología | Cómo probarlo |
|------------|------------|---------------|
| **App Móvil Operativa** | Expo + AsyncStorage | Expo Go + `npx expo start` |
| **Demo Web** | `index.html` (Vercel) | Solo demostración — la app real es móvil |

## App Móvil Operativa (Expo Go)

```bash
npm install
npx expo start
```

- **Persistencia local:** cada registro se guarda en disco del teléfono (AsyncStorage).
- **Exportar:** comprimir todos los reportes a JSON SMS (`i,n,e,g,u,s,o,t`).
- **Importar:** pegar cadena de otra brigada y fusionar sin duplicar IDs.
- **Prioridad:** CRITICO → POR LOCALIZAR → LOCALIZADO.
- **Sin datos falsos:** eliminada toda simulación BLE automática.

Escanea el QR con **Expo Go** en Android/iOS.

## Arquitectura (Clean Architecture)

```
src/
├── domain/          # Entidades y contratos (sin React)
├── infrastructure/  # Repositorio en memoria + simulación malla
└── screens/         # UI táctica HomeScreen
```

## Despliegue Vercel

1. Conectar repo `dynastymarketinga/MeshnetworkVenezuela` en [vercel.com](https://vercel.com)
2. Framework: **Other**
3. Build Command: *(vacío)*
4. Output Directory: `.`

El archivo `vercel.json` sirve `index.html` como página principal.

## Licencia

Uso interno — Dynasty Marketing / MeshnetworkVenezuela.
