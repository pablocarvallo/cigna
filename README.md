# Gastos médicos Cigna · app del iPhone

App web para ver en el iPhone los gastos médicos de la familia, los reembolsos de Cigna, los topes de copago y la cuenta en dólares. Es la misma vista del artifact «Gastos Médicos Cigna» de Claude, pero **solo para mirar**: los gastos, las boletas y las liquidaciones se siguen registrando en el artifact.

## Qué muestra

- **Resumen**: saldo en el banco, total reembolsado y gastado en el año, boletas enviadas que esperan pago, boletas por enviar a Cigna (con el reembolso estimado), tope de copago por persona y familiar, gasto por mes y gasto por especialidad.
- **Gastos**: todas las boletas del año, agrupadas por mes, con búsqueda y filtros por persona y estado. Al tocar una se ve el detalle, el reembolso recibido o estimado y los pagos de cada liquidación de Cigna.
- **Copagos**: saldo de copago de cada persona y de la familia, con cada monto registrado.
- **Banco**: saldo actual, ingresos y egresos mes a mes, egresos, tipo de cambio y liquidaciones leídas.

Cuando hay más de un año con datos, se elige el año con los botones de arriba.

## Instalar en el iPhone

1. La app se publica con GitHub Pages en `https://pablocarvallo.github.io/cigna/`.
2. Abre esa dirección en **Safari** en el iPhone.
3. Toca **Compartir → Agregar a inicio**.
4. En la app de Claude abre el artifact, ve a **Banco → App del iPhone** y toca **Copiar código**.
5. Abre la app desde el icono y toca **Pegar código**.

El código queda guardado solo en ese iPhone. Para quitarlo, usa «Quitar el código» al final del Resumen.

## Cómo se mantienen sincronizados los datos

El artifact es la fuente de los datos. La app del iPhone lee una copia publicada en este repositorio:

1. Cada cambio en el artifact queda marcado como pendiente de publicar.
2. En el artifact, **Banco → App del iPhone → Publicar ahora** lanza una tarea de Claude (sin horario, solo a pedido) que exporta los datos del artifact, los cifra con `herramientas/publicar.mjs` y sube `datos/cigna.enc.json` a este repositorio. En la misma hoja se puede activar que publique sola unos minutos después del último cambio, mientras el artifact esté abierto.
3. La app lee el archivo cada vez que se abre o vuelve a primer plano, y con el botón de actualizar. Arriba indica cuándo se publicaron los datos que muestra.

Sin conexión, la app muestra la última copia que leyó.

## Privacidad

Este repositorio es público, así que los datos se publican **cifrados** con AES-256-GCM. La clave no está en el repositorio: vive en el artifact y en el iPhone, que la recibe con el código `CIGNA1.…`. Sin ese código, `datos/cigna.enc.json` no se puede leer.

Las boletas (PDF o imagen) no se publican; la app solo indica que el gasto tiene una boleta adjunta, que se abre desde el artifact.

## Publicar a mano

Con una exportación de la base de datos del artifact (una carpeta por colección y un archivo JSON por documento):

```
node herramientas/publicar.mjs --export <carpeta> --clave CIGNA1.<clave> [--cambio <ms>]
```

El script arma el resumen, lo cifra, comprueba que se puede descifrar y escribe `datos/cigna.enc.json`. No necesita dependencias, solo Node 18 o superior.

## Archivos

| Archivo | Uso |
| --- | --- |
| `index.html` | La app completa (HTML, CSS y JavaScript, sin dependencias ni compilación), con el sistema de diseño de las apps domésticas entre las marcas `DS:TOKENS` y `DS:LAYER` |
| `datos/cigna.enc.json` | Datos del artifact, cifrados |
| `herramientas/publicar.mjs` | Arma y cifra `datos/cigna.enc.json` a partir de la exportación del artifact |
| `manifest.webmanifest` | Nombre, colores e iconos de la app instalada |
| `sw.js` | Service worker para uso sin conexión (no guarda los datos; eso lo hace la app) |
| `icons/icon-full.svg` | Icono original a pantalla completa (fuente de los PNG) |
| `icons/icon.svg` | Icono con esquinas redondeadas (favicon) |
| `icons/apple-touch-icon.png` | Icono de 180 px para la pantalla de inicio del iPhone |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-1024.png` | Iconos del manifiesto y archivo de alta resolución |
