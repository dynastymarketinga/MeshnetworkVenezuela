# MeshnetworkVenezuela

Herramienta offline-first para paramédicos y brigadas de rescate en La Guaira, Venezuela. Registra incidentes y transporta datos sin depender de internet.

## Componentes

| Componente | Tecnología | Cómo probarlo |
|------------|------------|---------------|
| **Simulador Web** | `index.html` + Vanilla JS | [Vercel](https://meshnetwork-venezuela.vercel.app) (tras conectar repo) |
| **App Móvil** | Expo + React Native + TypeScript | Expo Go + `npx expo start` |

## Simulador Web (Vercel)

Abre la URL de Vercel en cualquier navegador. Permite:

- Registrar reportes tácticos (SOS-)
- Simular pulsos de malla BLE (BLE-)
- Ver lista ordenada por prioridad: CRITICO → POR LOCALIZAR → LOCALIZADO
- Copiar cadena JSON comprimida para SMS (llaves `i,n,e,g,u,s,o,t`)

La lógica web replica `MemoryReporteRepository` del código TypeScript.

## App Móvil (Expo Go)

```bash
npm install
npx expo start
```

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
