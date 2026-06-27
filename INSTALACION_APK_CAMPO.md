# Instalación APK en campo — La Guaira

Guía para instalar **Mesh Network Venezuela** en teléfonos Android de brigadas de rescate **sin Play Store** y **sin internet** (solo para la instalación inicial puede hacer falta WiFi una vez).

---

## APK listo — build 27 jun 2026

| | |
|---|---|
| **Versión** | 1.0.0 (perfil `preview`) |
| **Build EAS** | [Ver build en Expo](https://expo.dev/accounts/victorx2/projects/meshnetwork-venezuela/builds/0fc65d2d-951c-4db1-8c00-e13bcb2e9069) |
| **Descarga directa APK** | https://expo.dev/artifacts/eas/Uzihf_EC79RC4mD1fNLiJ0znlBF9PenFc_bM4Ud4Hyo.apk |
| **Instalar en Android** | Abrir el enlace del build en el teléfono o escanear el QR que muestra Expo |

Copia local (si existe): `releases/MeshNetworkVenezuela-1.0.0-preview.apk`

> **Número comando:** esta build usa el placeholder `04140000000`. Cuando tengas el número real de Bomberos/Protección Civil, edita `src/config/OperacionConfig.ts` y vuelve a compilar (`npx eas-cli build --platform android --profile preview`).

---

## Antes de salir a terreno (responsable técnico)

### 1. Compilar el APK (solo si necesitas nueva versión)

```powershell
cd C:\Users\pc\Desktop\App
npm install
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

- Al terminar, EAS entrega un enlace para descargar el archivo `.apk`.
- Guárdalo en USB, Google Drive o envíalo por WhatsApp a los responsables de brigada.

**Alternativa local** (requiere Android Studio + SDK):

```powershell
npm run run:android
```

El APK generado suele estar en `android/app/build/outputs/apk/`.

### 2. Configurar número del comando central

Editar `src/config/OperacionConfig.ts`:

```typescript
COMANDO_CENTRAL_SMS: '0414XXXXXXX',  // número real Bomberos / Protección Civil
```

Volver a compilar el APK tras cambiar el número.

### 3. Mapas offline en cada teléfono

En **cada** dispositivo de brigada, **antes** de perder internet:

- **OsmAnd** (recomendado): descargar mapa «Estado La Guaira / Vargas».
- **Google Maps**: descargar zona offline de Maiquetía, Macuto, La Guaira.

Sin mapas descargados, «Navegar al punto» no calculará ruta sin datos.

---

## Instalar en 1 teléfono Android (rescatista)

### Opción A — USB (más confiable)

1. En el teléfono: **Ajustes → Acerca del teléfono → Tocar 7 veces «Número de compilación»** (activa opciones de desarrollador).
2. **Ajustes → Opciones de desarrollador → Instalar apps desconocidas** (permitir para Archivos o Chrome).
3. Conectar USB al PC, copiar `MeshNetworkVenezuela.apk` al teléfono.
4. Abrir el archivo con **Mis archivos** → Instalar → Aceptar permisos.

### Opción B — WhatsApp / Drive (sin PC en campo)

1. Enviar el `.apk` por WhatsApp (documento) o enlace de Drive.
2. Descargar en el teléfono.
3. Permitir «orígenes desconocidos» si el sistema lo pide.
4. Instalar.

### Opción C — QR (si el APK está en URL pública)

1. Subir APK a hosting temporal (Drive con enlace directo, GitHub Release, etc.).
2. Generar QR con la URL de descarga.
3. Escanear e instalar.

---

## Primer arranque (cada teléfono)

1. Abrir **Mesh Network Venezuela** (icono con logo del perro rescate).
2. Conceder permisos:
   - **Ubicación** → «Permitir solo con la app en uso».
   - **SMS** → Permitir (para enviar al comando).
3. Verificar pestaña **Comando**: número SMS correcto.
4. Registrar un punto de prueba con GPS en zona conocida.
5. Apagar y encender el teléfono → el reporte debe seguir visible.

---

## Despliegue para 10 rescatistas (checklist rápido)

| # | Teléfono | Instalado | GPS OK | Mapas offline | Número comando | Prueba SMS |
|---|----------|:---------:|:------:|:-------------:|:--------------:|:----------:|
| 1 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 2 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 3 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 4 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 5 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 6 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 7 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 8 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 9 |          | ☐         | ☐      | ☐             | ☐              | ☐          |
| 10|          | ☐         | ☐      | ☐             | ☐              | ☐          |

**Responsable:** _______________  
**Fecha:** _______________  
**Versión APK:** 1.0.0  

---

## Operación sin internet (recordatorio)

| Acción | ¿Necesita internet? |
|--------|---------------------|
| Registrar persona + GPS | No |
| Guardar en SQLite | No |
| Ver reportes en el teléfono | No |
| Navegar al punto | No (si mapas descargados) |
| Enviar SMS al comando | No datos — solo señal GSM 2G/3G |
| Fusionar SMS recibido | No |

---

## Problemas frecuentes

| Problema | Solución |
|----------|----------|
| «No se puede instalar» | Activar orígenes desconocidos; desinstalar versión anterior |
| GPS no captura | Salir al aire libre; activar ubicación de alta precisión |
| SMS no abre | Verificar permiso SMS; SIM activa con saldo |
| Navegar no funciona offline | Descargar mapas OsmAnd/Google antes |
| Datos perdidos tras reinicio | Reinstalar APK actual; no usar Expo Go |

---

Ver también: `CHECKLIST_VALIDACION_CAMPO.md` para ejercicio táctico completo.
