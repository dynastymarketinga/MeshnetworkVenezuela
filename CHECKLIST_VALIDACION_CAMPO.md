# Checklist de validación en campo — La Guaira

**App:** MeshnetworkVenezuela · **Versión:** 1.0.0 · **Brigada:** editar en `src/config/OperacionConfig.ts`

Usar este documento con rescatistas reales (Bomberos, Protección Civil, Cruz Roja) en ejercicio controlado antes de operación real.

---

## A. Pre-despliegue (15 min)

| # | Prueba | OK | Notas |
|---|--------|:--:|-------|
| A1 | APK instalada desde archivo `.apk` (no Expo Go) | ☐ | |
| A2 | Número comando en `OperacionConfig.COMANDO_CENTRAL_SMS` verificado con central | ☐ | |
| A3 | Permisos GPS y SMS concedidos al abrir la app | ☐ | |
| A4 | App abre con fondo negro y lista vacía o con datos previos | ☐ | |
| A5 | Reiniciar teléfono: los reportes guardados siguen visibles (SQLite) | ☐ | |

---

## B. Registro de punto de rescate

| # | Prueba | OK | Notas |
|---|--------|:--:|-------|
| B1 | Sin ubicación texto → alerta y no guarda | ☐ | |
| B2 | Sin GPS → alerta y no guarda | ☐ | |
| B3 | Con ubicación + GPS → reporte aparece en lista | ☐ | |
| B4 | Triaje CRÍTICO visible con borde rojo / prioridad clara | ☐ | |
| B5 | Triaje POR LOCALIZAR y LOCALIZADO distinguibles bajo sol/humo | ☐ | |
| B6 | Texto legible con guantes y pantalla al 30% brillo | ☐ | |

---

## C. GPS y navegación offline

| # | Prueba | OK | Notas |
|---|--------|:--:|-------|
| C1 | Botón "CAPTURAR COORDENADAS GPS" obtiene lat/lon en ≤30 s | ☐ | |
| C2 | Coordenadas coinciden ±50 m con punto conocido en mapa | ☐ | |
| C3 | "NAVEGAR AL PUNTO" abre OsmAnd / Google Maps / app de mapas | ☐ | |
| C4 | Ruta a pie calculable **sin datos móviles** (mapas descargados) | ☐ | |

---

## D. Transmisión SMS (contingencia 2G/3G)

| # | Prueba | OK | Notas |
|---|--------|:--:|-------|
| D1 | "COMPRIMIR SMS" copia lote MNv1 al portapapeles | ☐ | |
| D2 | "ENVIAR AL COMANDO CENTRAL" abre SMS con número fijo y cuerpo cargado | ☐ | |
| D3 | Segundo teléfono recibe SMS; pegar en "PEGAR Y FUSIONAR" importa sin duplicar ID | ☐ | |
| D4 | Lotes múltiples (1/3, 2/3, 3/3) se fusionan correctamente | ☐ | |

---

## E. Escenario táctico (30 min, 2 brigadas)

1. **Brigada A** registra 3 puntos reales en zona acotada (ej. Macuto / Maiquetía).
2. **Brigada A** envía lote 1 al comando central por SMS.
3. **Brigada B** (sin registro previo) fusiona SMS recibido → debe ver los 3 puntos.
4. **Brigada B** navega al punto CRÍTICO más cercano offline.
5. Apagar **Brigada A** completamente → encender → datos intactos.

| Resultado global | ☐ Aprobado | ☐ Requiere ajustes |

---

## F. Observaciones de campo

**Fecha:** _______________  
**Lugar:** _______________  
**Responsable:** _______________  

**Problemas encontrados:**

1. 
2. 
3. 

**Cambios solicitados antes de producción:**

1. 
2. 

---

## Comandos de compilación APK

```bash
# Requiere cuenta Expo / EAS
eas build --platform android --profile preview

# O build local con Android Studio instalado
npx expo run:android
```

Tras generar el APK, distribuir por USB/WhatsApp/Drive a dispositivos de prueba (no Play Store).
