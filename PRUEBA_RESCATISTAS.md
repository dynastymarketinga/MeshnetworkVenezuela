# Prueba con rescatistas — La Guaira

**App:** Mesh Network Venezuela v1.0.0  
**Fecha:** _______________  
**Lugar:** _______________  
**Coordinador:** _______________  
**APK versión / hash:** _______________

---

## Equipo

| Rol | Nombre | Teléfono | APK instalada |
|-----|--------|----------|:-------------:|
| Brigada A — registro | | | ☐ |
| Brigada B — fusión SMS | | | ☐ |
| Comando central (receptor SMS) | | | ☐ |
| Observador técnico | | | ☐ |

**Número comando configurado en app:** _______________

---

## Fase 1 — Instalación (15 min)

| # | Prueba | A | B | OK |
|---|--------|---|---|:--:|
| 1.1 | APK instalada (no Expo Go) | ☐ | ☐ | ☐ |
| 1.2 | Permiso GPS concedido | ☐ | ☐ | ☐ |
| 1.3 | Permiso SMS concedido | ☐ | ☐ | ☐ |
| 1.4 | Mapas offline descargados (OsmAnd/Google) | ☐ | ☐ | ☐ |
| 1.5 | Pestaña Comando muestra número correcto | ☐ | ☐ | ☐ |

---

## Fase 2 — Registro offline (20 min)

**Modo avión ON · Datos móviles OFF · WiFi OFF**

| # | Prueba | Resultado | OK |
|---|--------|-----------|:--:|
| 2.1 | Brigada A: registrar punto con ubicación + GPS | | ☐ |
| 2.2 | Segundo registro con estado CRÍTICO | | ☐ |
| 2.3 | Apagar teléfono A completamente → encender → datos intactos | | ☐ |
| 2.4 | «Navegar al punto» abre mapas y muestra ruta (mapas offline) | | ☐ |
| 2.5 | Brigada B sin registros previos — lista vacía | | ☐ |

**Coordenadas punto 1:** _______________  
**Coordenadas punto 2:** _______________

---

## Fase 3 — SMS entre brigadas (20 min)

**Activar señal GSM (datos pueden seguir OFF)**

| # | Prueba | Resultado | OK |
|---|--------|-----------|:--:|
| 3.1 | Brigada A: Comprimir → copia al portapapeles | | ☐ |
| 3.2 | Brigada A: Enviar al comando central — SMS se abre con texto | | ☐ |
| 3.3 | Comando/brigada B recibe SMS | | ☐ |
| 3.4 | Brigada B: Pegar y fusionar — ve reportes de A | | ☐ |
| 3.5 | Mismo ID no se duplica al fusionar dos veces | | ☐ |
| 3.6 | Si >1 lote: enviar 1/3, 2/3, 3/3 y fusionar todos | | ☐ |

---

## Fase 4 — Escenario táctico (30 min)

1. Registrar **3 puntos reales** en zona acotada (ej. Macuto / Maiquetía).
2. Priorizar CRÍTICO en UI — visible bajo sol.
3. Brigada B navega al CRÍTICO más cercano sin internet.
4. Tiempo registro → GPS capturado: _____ seg (meta: ≤30 s).

| Punto | Ciudad | Estado | GPS OK | Navegar OK |
|-------|--------|--------|:------:|:----------:|
| 1 | | | ☐ | ☐ |
| 2 | | | ☐ | ☐ |
| 3 | | | ☐ | ☐ |

---

## Veredicto

| | |
|---|---|
| ☐ **APROBADO** — Listo para operación en contingencia | |
| ☐ **CONDICIONAL** — Requiere ajustes menores | |
| ☐ **RECHAZADO** — No desplegar hasta corregir | |

### Problemas encontrados

1. 
2. 
3. 

### Ajustes solicitados

1. 
2. 

### Firmas

**Jefe brigada:** _______________  **Fecha:** _______  
**Técnico app:** _______________  **Fecha:** _______

---

## Comandos build (referencia técnica)

```powershell
cd C:\Users\pc\Desktop\App
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile preview
```

Ver `INSTALACION_APK_CAMPO.md` para instalar en dispositivos.
