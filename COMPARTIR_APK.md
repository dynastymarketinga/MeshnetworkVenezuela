# Cómo compartir la app con brigadas (solo APK)

**No envíes el enlace de la web (Vercel).** En el navegador el GPS suele bloquearse y no aparecen reportes.

## Mensaje para WhatsApp (copiar y pegar)

```
Mesh Network Venezuela — app de rescate La Guaira

1. Abre ESTE enlace EN TU ANDROID (no en PC):
https://expo.dev/accounts/victorx2/projects/meshnetwork-venezuela/builds/3fba0ec4-6b7c-4e0e-85a0-2fc79f84a95b

2. Instala la app (permite «orígenes desconocidos» si pregunta).

3. Abre la app → Registro → toca «Capturar coordenadas GPS» → PERMITIR ubicación.

4. Complete ubicación + datos → «Registrar punto de rescate».

5. Ve a Reportes: ahí debe aparecer el punto guardado.
```

> Tras una build nueva en Expo, sustituye el enlace por el último build en la cuenta `victorx2`.

## Si dice que no le aparece nada

| Causa | Solución |
|-------|----------|
| Abrió la web en Chrome, no la APK | Reinstalar desde el enlace de arriba |
| Negó ubicación | Ajustes → Apps → Mesh Network → Permisos → Ubicación → Permitir |
| No capturó GPS | Debe tocar el botón azul antes de registrar |
| No registró | Sin GPS + ubicación escrita no guarda nada |

## Versión actual

APK **1.1.0** — MNv2, UI OLED, Hub separado en Vercel para otras apps.

Ver **`HUB_INTEGRACION_DESARROLLADORES.md`** para integradores.
