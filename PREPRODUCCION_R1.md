# Mapa STM — GitHub Pages + Cloudflare Workers (R1)

**Estado: candidato técnico de preproducción, sin desplegar. No reemplaza todavía ADMINISTRADOR R11 ni INVITADOS.**

## Estructura

- `frontend/`: interfaz HTML/CSS/JavaScript para GitHub Pages, sin Firebase y sin depender de `/exec` de Apps Script. No contiene credenciales ni datos operativos.
- `worker/`: API de Cloudflare Workers de **solo lectura**, con controles de acceso y lectura selectiva de la carpeta operativa de Google Drive COPSA.
- `worker/src/mtop-index.json`: mapa de 837 IDs de recorridos a sus 16 particiones MTOP, construido desde los ficheros reales y comprobado contra el manifiesto SHA-256.
- `worker/test/`: 16 pruebas Node para tokens, firmas, autorización, CORS, permisos de lectura, catálogo, paradas e índice.

## Estado comprobado

1. Catálogo de 1.282 entradas únicas: 1.198 entradas del índice V09 y 84 reconstrucciones V023. Se excluyen servicios urbanos del catálogo.
2. Geometrías históricas MTOP: 16/16 particiones verificadas por SHA256; 837 asociaciones sin duplicados. Consulta bajo demanda `/api/trazado?recorrido=<ID>`.
3. Canelones V023: trazados candidatos visibles, claramente identificados como NO certificados.
4. Paradas COPSA: 4.043 registros de T20, consultables por ID de variante con coordenadas disponibles. No se inventan paradas para otras empresas.
5. Interfaz: filtros visibles mediante botón permanente en móvil, máximo tres recorridos, selección y destacado por pulsación prolongada.
6. Seguridad local: JWT Google verificados con RSA/JWKS y cuenta autorizada, token INVITADOS mediante SHA-256, rechazo de escrituras, lista blanca de archivos, CORS restringido.

## Lo que todavía falta y bloquea el despliegue

- Crear/conectar una **cuenta Cloudflare** y su Worker. No se ha publicado ninguno.
- Crear un **cliente OAuth web** en Google Cloud con origen `https://wilbertala.github.io` y configurar `GOOGLE_CLIENT_ID` en Worker y `frontend/config.js`.
- Crear una identidad Google Cloud de **solo lectura** para Drive; compartir únicamente los datos operativos necesarios con ese correo. Guardar el JSON de credenciales en un secreto de Worker (no en GitHub ni en Drive público).
- Configurar secreto Worker `STM_INVITE_SHA256` con el hash SHA-256 del token privado original. **No guardar ni revelar el token privado en GitHub o scripts**.
- Comprobar permisos del Drive COPSA antes de compartir: no ampliar accesos existentes.
- Desplegar el Worker en staging y establecer su URL pública en `frontend/config.js`, después publicar la interfaz en la rama apropiada del repositorio GitHub existente. La página de lanzamiento actual del repositorio no se sustituye en este kit.
- Probar acceso REAL en Chrome, Firefox, Edge, Samsung Internet, Android y Windows, incluyendo varias sesiones de Google. No se puede garantizar compatibilidad total solo por simulación.
- Implementar edición administrativa persistente, borradores, auditoría de cambios, búsqueda de lugares y demás funciones R11 faltantes antes de retirar la versión anterior.

## Pruebas en Termux / Node

```
cd worker
node --test test/*.test.mjs
npm run lint
```

El paquete no necesita Firebase, Java ni Gradle. Wrangler (`npx wrangler`) se utiliza solamente cuando el servicio esté configurado para desplegar. **No ejecutar `wrangler deploy` hasta configurar secretos y revisar permisos.**

## Configuración de despliegue futuro (NO EJECUTAR AÚN)

En `worker/wrangler.jsonc` sustituir los marcadores de cliente OAuth y lista de administradores (NO añadir claves privadas). Guardar estas variables como *secrets* mediante `wrangler secret put` en un entorno administrado. En `frontend/config.js`, establecer la URL de Worker y cliente OAuth públicos. La API recibe la invitación únicamente por encabezado y nunca escribe sobre Drive.

## Límites de los datos

Las geometrías MTOP son históricas y pueden corresponder a servicios autorizados no operativos; Canelones V023 mezcla referencias MVOT/GPS/candidatas sin certificación vial. Las secuencias T20 pertenecen a un respaldo histórico. No declarar vigencia real, equivalencia de sentidos ni calles transitables sin auditoría de campo.
