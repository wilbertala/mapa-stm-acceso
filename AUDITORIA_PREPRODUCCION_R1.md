# Auditoría técnica R1 — 23/11/2026

| Control | Evidencia | Resultado |
|---|---|---|
| 16 archivos comprimidos MTOP | SHA-256 contra geometrias_mtop_manifest_v017.json de COPSA | 16/16 correctos |
| Asociación de líneas MTOP | IDs únicos en 16 shards | 837 rutas, sin duplicados |
| Catálogo V09 + Canelones V023 | Fuentes originales cargadas localmente | 1.282 registros únicos, sin urbanos en salida |
| Autenticación Google | Firma RS256/JWKS, aud, iss, sub, correo verificado, allowlist | Prueba automatizada aprobada |
| INVITADOS | Digest SHA256 de token hexadecimal, sin secretos públicos | Prueba automatizada aprobada |
| No escribir Drive | Rutas GET; métodos POST rechazados | Prueba aprobada |
| CORS | Solo origen configurado de GitHub Pages | Prueba aprobada |
| Paradas | T20 asociadas a ID, orden y límites de coordenadas | Prueba aprobada |
| UI | Simulación Chromium 390×780, 816×390, 1366×768 | Controles visibles, búsqueda cargada, sin errores JS |

**Pendiente:** Pruebas HTTPS remotas con cuentas reales; auditoría de permisos de Drive; comprobación de OAuth y de la identidad de servicio; integración de edición y paridad R11. La API no está desplegada.
