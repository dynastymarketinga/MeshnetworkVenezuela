# Hub de integración — Desarrolladores Venezuela

API centralizada en **Vercel KV** para reducir fragmentación entre apps de crisis (desaparecidos, edificios colapsados, sin vivienda).

**Base URL:** `https://meshnetwork-venezuela.vercel.app/api/hub`

La **APK Mesh Network** opera offline + SMS y **no** llama a este Hub. Otras webs/apps sí.

---

## Flujo recomendado (William / integradores)

1. Antes de guardar en su base local → `GET ?action=consultar`
2. Buscar duplicados por `id` o por proximidad (`latitud`, `longitud`, `ubicacion_exacta`)
3. Si no existe o su registro es más reciente → `POST ?action=registrar`
4. Mantener su DB local y sincronizar periódicamente con el Hub

---

## GET — Consultar base maestra

```http
GET /api/hub?action=consultar
```

**Respuesta 200:**

```json
{
  "version": "1.0",
  "protocolo": "MNv2",
  "total": 42,
  "reportes": [ /* ReporteEmergencia[] */ ]
}
```

**Ejemplo JavaScript:**

```javascript
const res = await fetch('https://meshnetwork-venezuela.vercel.app/api/hub?action=consultar');
const { reportes } = await res.json();
```

---

## POST — Registrar reportes

```http
POST /api/hub?action=registrar
Content-Type: application/json
X-Hub-Api-Key: <opcional si HUB_API_KEY está en Vercel>
```

**Cuerpo — un registro:**

```json
{
  "id": "VTB-2026-001",
  "fuente_origen": "VenezuelaTeBusca",
  "tipo_registro": "PERSONA_ATRAPADA",
  "nombre_completo": "María López",
  "edad": "8",
  "genero": "F",
  "ubicacion_exacta": "Edificio Residencias Macuto, piso 3",
  "latitud": 10.601234,
  "longitud": -66.934567,
  "estado_actual": "CRITICO",
  "telefono_contacto": "04141234567",
  "estado_estructura": "SEGURO",
  "notas_paramedicos": "Atrapada bajo losa",
  "timestamp": 1719494400000,
  "ciudad": "Macuto"
}
```

**Cuerpo — lote:**

```json
{
  "reportes": [ { "...": "..." } ]
}
```

**Respuesta 200:**

```json
{
  "version": "1.0",
  "protocolo": "MNv2",
  "importados": 1,
  "actualizados": 0,
  "ignorados": 0,
  "total": 1
}
```

**Reglas de fusión:**

| Caso | Acción |
|------|--------|
| `id` nuevo | Importado |
| `id` existe y `timestamp` mayor | Actualizado |
| `id` existe y `timestamp` menor o igual | Ignorado |

---

## CORS

Origen `*` permitido para `GET`, `POST`, `OPTIONS`. Headers: `Content-Type`, `X-Hub-Api-Key`.

---

## Modelo `ReporteEmergencia`

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | Único global (`SOS-*`, `VTB-*`, etc.) |
| `fuente_origen` | string | Ej. `MeshApp`, `VenezuelaTeBusca` |
| `tipo_registro` | enum | `PERSONA_ATRAPADA`, `INFRAESTRUCTURA_DANADA`, `SIN_VIVIENDA` |
| `nombre_completo` | string | Default `Anónimo` |
| `edad` | string | |
| `genero` | string | |
| `ubicacion_exacta` | string | Sector/calle/edificio |
| `latitud` | number | Obligatorio |
| `longitud` | number | Obligatorio |
| `estado_actual` | enum | `CRITICO`, `POR LOCALIZAR`, `LOCALIZADO` |
| `telefono_contacto` | string | Reconstrucción / familia |
| `estado_estructura` | enum | `COLAPSO_TOTAL`, `PARCIAL`, `HABITABLE`, `SEGURO` |
| `notas_paramedicos` | string | |
| `timestamp` | number | Unix ms |
| `ciudad` | string? | Opcional (La Guaira, etc.) |

---

## SMS MNv2 (APK offline)

Llaves comprimidas: `i o x n e g u lt lg s c r m t` (+ `y` ciudad).

Lotes: `MNv2|1/3|[...]` — compatible con importación `MNv1`.

---

## Configuración Vercel (operador)

1. Proyecto Vercel → **Storage** → crear **KV**
2. Vincular al proyecto (inyecta `KV_REST_API_URL`, `KV_REST_API_TOKEN`)
3. Opcional: `HUB_API_KEY` para exigir header en POST
4. Redeploy

**Probar:**

```bash
curl "https://meshnetwork-venezuela.vercel.app/api/hub?action=consultar"
```

---

## Dashboard interactivo

En `index.html` → pestaña **Hub**: consultar en vivo y probar POST.
