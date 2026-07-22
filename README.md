# Sistema de Embarques — Carnes Finas el Andén (TIF 680)

Sistema web que sustituye al sistema de escritorio original (C#) para el control de
producción, embarques e inventario de la empacadora. Backend en Node/Express + MySQL,
frontend en React/Vite. Desplegado en producción en
[embarques.carnesfinaselanden.com.mx](https://embarques.carnesfinaselanden.com.mx/login).

## Estructura del proyecto

```
backend/            API en Express (Node.js) + MySQL
  src/
    routes/          Un archivo por módulo (canales, entradas, salidas, movimientos, etc.)
    middleware/       auth.js (JWT), requireAdmin.js (solo administrador)
    lib/              barcode.js, zpl.js, bitacora.js — utilidades compartidas
    db/               pool de conexión MySQL (mysql2)
  public/            Build de React copiado aquí para servirlo (frontend/dist → backend/public)
  uploads/           PDFs de romaneaje subidos (no versionado en git)
  schema.sql         Esquema completo de base de datos (instalación nueva)
  migrate.js         Migración idempotente para bases ya existentes
  setup.js           Siembra usuarios iniciales + catálogo de productos

frontend/            SPA en React + Vite + Tailwind
  src/
    pages/            Una pantalla por módulo
    components/       UI compartida (Button, Card, Table, Modal, JustificacionModal, etc.)
    api/              Cliente axios + servicios por módulo
    lib/              barcode.js (espejo del backend), browserPrint.js, date.js, csv.js

deploy/              Paquetes de despliegue a producción (no versionado en git)
schema.sql           Copia raíz del esquema (histórica, ver Notas técnicas)
```

## Cómo correr en desarrollo

**Base de datos** (MySQL/MariaDB, ej. XAMPP):
```bash
mysql -u root < schema.sql          # crea las tablas
cd backend
node setup.js                       # usuarios + catálogo de productos
node migrate.js                     # aplica cambios incrementales (columnas nuevas, etc.)
```

**Backend** (`backend/.env`, ver `backend/.env.example`):
```bash
cd backend
npm install
npm run dev        # nodemon, puerto 3001 (o npm start)
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev         # Vite dev server, puerto 5173, con proxy a /api -> localhost:3001
```

**Usuarios de prueba** (creados por `setup.js`, solo para desarrollo local):
`admin` / `admin123` (rol admin), `embarques` / `embarques123` (rol operador).

**Producción**: las contraseñas de `admin` y `embarques` en
embarques.carnesfinaselanden.com.mx ya fueron cambiadas y son distintas a las
de arriba. Este repositorio es público, así que esas contraseñas **no se
documentan aquí** — pregúntale al administrador del sistema si las necesitas.

## Roles

- **operador**: captura canales, entradas, salidas, solicita movimientos de inventario.
- **admin**: además de lo anterior, autoriza/rechaza movimientos de inventario y es el
  único que puede ver la Bitácora.

## Módulos y funcionalidad

### Canales / Romaneaje (`/canales`)
- Pantalla de lista de lotes + pantalla de captura (`/canales/nuevo` o `/canales/:id`).
- El **folio del lote es automático** (consecutivo real, continúa desde el último
  capturado) — solo se consume al dar "Registrar lote", no antes.
- Cada lote se compone de varias **canales**, cada una con su propio consecutivo.
- El **peso frío se calcula solo** (suma de medios o cuartos) — no se teclea a mano.
- El peso caliente es opcional (si no se pesó en caliente, se guarda como 0).
- Se puede **cargar el PDF del romaneaje** directamente en la captura del lote (o
  después, entrando a un lote ya existente) — se sustituye si subes uno nuevo.
- **Editar** una canal ya guardada exige justificación (queda en Bitácora).
- **Eliminar** una canal exige justificación (queda en Bitácora).

### Entradas (`/entradas`)
- Captura de producto terminado **por caja individual** (no por lote agregado).
- Cada caja obtiene un **consecutivo automático por producto dentro del lote**
  (reinicia en 1 para cada producto nuevo del mismo lote).
- Al capturar, se genera e **imprime automáticamente la etiqueta** (código de barras)
  vía Zebra Browser Print si está instalado en la máquina; si no, cae a
  copiar/descargar el `.zpl` para imprimir manualmente.
- Botón "Reimprimir todas" para reimprimir en lote las cajas de la sesión actual.
- **Eliminar** una entrada exige justificación (queda en Bitácora).

### Nomenclatura de etiqueta / código de barras
Formato canónico: `CODIGO-LOTE-CAJA-KILOS` (ej. `600-26-1-15.70`). Código, lote y caja
son de longitud variable (sin ceros a la izquierda); kilos siempre con 2 decimales.
Implementado en `backend/src/lib/barcode.js` y su espejo `frontend/src/lib/barcode.js`.

### Etiquetas (`/etiquetas`)
- Pestaña **"Buscar etiquetas"**: filtra por artículo, lote, caja y estado
  (activa/eliminada). Cada etiqueta se puede **reimprimir** (incrementa el contador de
  veces impresa) o **eliminar** (justificación obligatoria; no se borra físicamente,
  solo se marca inactiva para que el código de barras no se reutilice).
- Pestaña **"Generar manual"**: herramienta de respaldo para regenerar un ZPL a mano
  (pruebas de impresora), no queda guardada en el sistema.
- La duplicidad de etiqueta se evita a nivel de base de datos: `UNIQUE(lote_id, codigo,
  caja)` y `UNIQUE(barcode)`.

### Salidas (`/salidas`)
- Embarques a **cliente** (incluye clientes tipo tienda propia, ej. Abastos, Torreón
  Jardín — son clientes normales, mismo flujo).
- Folio consecutivo automático.
- Tiene campo de **observaciones**, visible en Reportes.
- **Editar** un renglón (el "documento de salida"/escáner) exige justificación.
- **Eliminar** un renglón NO exige justificación (decisión explícita: a diferencia del
  resto del sistema, los embarques a cliente se pueden borrar libremente si fue un
  error de captura).

### Movimientos de inventario (`/movimientos`)
Reemplaza al antiguo módulo de "Bajas". Ajustes internos de inventario (merma,
decomiso, corrección) — **no confundir con Salidas** (que son embarques a cliente).
- Puede ser de tipo **entrada** o **salida** de inventario.
- Todo movimiento nace en estado **pendiente**, sin importar quién lo capture.
- Solo el **administrador** puede **autorizar** (con comentario opcional) o
  **rechazar** (comentario obligatorio) un movimiento pendiente.
- Solo cuenta en Existencias/Reportes una vez **autorizado**.
- Se puede **editar** mientras esté pendiente (justificación obligatoria); una vez
  autorizado o rechazado queda fijo (solo eliminable, con justificación).

### Existencias (`/existencias`)
- Existencia actual por producto: entradas − salidas − movimientos autorizados (resta
  si son de salida, suma si son de entrada).
- **Filtro de fecha histórica**: puedes ver cuál era la existencia en cualquier fecha
  pasada (solo cuenta lo registrado hasta esa fecha).

### Inventario inicial (`/inventario-inicial`)
Pantalla para dar de alta cajas físicas que ya existen (con etiqueta ya impresa, de
antes de usar el sistema o de un conteo físico). Se **escanea** (o teclea) el código de
barras de cada caja, se agrega como renglón (con el producto identificado
automáticamente por el código), y al final "Meter al inventario" los registra todos de
una vez. No genera etiquetas nuevas ni consume el consecutivo de caja normal —
solo registra la existencia.

### Reportes (`/reportes`)
Pestañas: Entradas, Salidas, Movimientos de inventario, Existencias, Canales.
- Entradas y Salidas tienen un checkbox **"Agrupar por producto"** (suma cajas/kilos
  por producto; entradas además lista los números de caja).
- Existencias admite el mismo filtro de fecha histórica que la pantalla dedicada.
- Canales muestra también la observación del lote al que pertenece cada canal.
- Exportación a CSV en cualquier pestaña.

### Bitácora (`/bitacora`, solo administrador)
Registro de auditoría de toda edición/eliminación/autorización del sistema: quién,
cuándo, qué acción, sobre qué tabla/registro, la justificación dada, y el detalle
completo de los datos antes/después del cambio (JSON expandible). Con filtros por
fecha, tabla, acción y usuario.

### Clientes y Productos (`/clientes`, `/productos`)
Catálogos CRUD estándar.

## Justificación obligatoria — resumen

| Acción                          | ¿Exige justificación? |
|----------------------------------|------------------------|
| Editar/eliminar canal            | Sí                     |
| Editar/eliminar entrada           | Sí                     |
| Editar/eliminar movimiento de inventario | Sí             |
| Eliminar etiqueta                | Sí                     |
| **Editar** salida (escáner)      | Sí                     |
| **Eliminar** salida               | No                     |

Todas las acciones que exigen justificación quedan registradas en la Bitácora.

## Notas técnicas

- **Fallback en memoria**: casi todas las rutas del backend intentan MySQL primero
  (`dbOk()`) y caen a un arreglo en memoria si la base no está disponible — útil para
  desarrollar sin MySQL a la mano, pero los datos en ese modo no persisten al
  reiniciar el servidor.
- **`schema.sql`** vive en dos lugares (raíz y `backend/`) y deben mantenerse
  sincronizados manualmente — el de `backend/` es el que se empaqueta al desplegar.
- **`migrate.js`** es idempotente (seguro de correr varias veces) y usa
  `information_schema` para detectar qué falta, porque MySQL/MariaDB en hosting
  compartido no soporta de forma confiable `ADD COLUMN IF NOT EXISTS`.
- **Impresión de etiquetas**: se integra con [Zebra Browser
  Print](https://www.zebra.com/us/en/support-downloads/software/utilities/browser-print.html)
  si está instalado en la máquina del operador (impresora conectada por USB); si no se
  detecta, cae automáticamente a copiar/descargar el `.zpl`.
- La carpeta raíz del proyecto (`src/`, `public/`, `setup.js`, etc., fuera de
  `backend/`/`frontend/`) es un snapshot antiguo previo a la reestructura — no está
  versionado en git ni se usa activamente, se deja solo de referencia.

## Despliegue a producción

Ver la carpeta `deploy/` (no versionada en git, se genera localmente) para el paquete
más reciente y sus instrucciones paso a paso vía cPanel + phpMyAdmin.
