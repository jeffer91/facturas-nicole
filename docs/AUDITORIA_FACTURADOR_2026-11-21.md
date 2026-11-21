# Auditoría de preparación para producción — Nicole Facturador

Fecha de revisión: 2026-11-21
Rama auditada: main
Veredicto: **NO APTO PARA PRODUCCIÓN**.

## Evidencia revisada
- `site/index.html`: registro público de clientes.
- `site/facturador/index.html` y `site/facturador/app.js`: preparación de borradores.
- `site/admin/app.js`: consulta administrativa.
- `supabase/functions/invoice-api/index.ts`: registro, listado, autenticación y fotografías.
- `facturador_local/factura_xml.py`: XML de pruebas.
- `facturador_local/firma_local.py`: importación cifrada de P12/PFX; sin firma XML.
- `facturador_local/gmail_edge.py`: borrador Gmail con adjuntos; sin integración con emisión.
- `facturador_local/archivo_facturas.py`: archivo local; sin integración.
- GitHub Actions: flujos de publicación y pruebas unitarias recientes exitosos. **No demuestran autorización SRI real.**

## Bloqueantes P0 — no habilitar emisión
- [ ] Validación de facturas contra XSD oficial y reglas tributarias SRI vigentes.
- [ ] Firma electrónica XAdES-BES válida con certificado correspondiente al emisor.
- [ ] Integración con servicios SRI de certificación, recepción y autorización.
- [ ] Máquina de estados persistente (borrador, firmado, enviado, pendiente, autorizado, rechazado).
- [ ] Secuenciales únicos transaccionales, reintentos idempotentes y recuperación ante corte de red.
- [ ] Impuestos y redondeo con precisión decimal por artículo; catálogo tributario validado.
- [ ] RIDE PDF generado a partir de respuesta SRI autorizada y XML final.
- [ ] Almacenamiento seguro de XML firmado, autorizado, respuesta SRI y RIDE; backups y restauración.
- [ ] Acceso administrativo endurecido; autenticación fuerte y permisos de facturación.
- [ ] Pruebas integrales en certificación SRI, casos de rechazo, reintentos y conciliación.

## Hallazgos P1
- El facturador web solo carga 200 clientes; no hay búsqueda paginada global.
- El facturador web usa Number/float y una tarifa general seleccionable; no usar como cálculo fiscal definitivo.
- Los productos se introducen manualmente; no hay integración de catálogo.
- Los módulos locales no se ejecutan dentro de GitHub Pages ni están conectados a la UI web.
- Gmail requiere configuración OAuth y pruebas reales de creación de borradores.
- El nombre y apellidos se capturan separados, pero la API almacena `full_name` combinado.
- La API de registro guarda solicitudes, **no facturas emitidas**.
- El campo `autorizado=True` en módulos locales es una condición provisional suministrada por el llamador, no una verificación del SRI.

## Evidencia de automatización existente
- Publicación GitHub Pages por Actions: exitosa.
- Pruebas unitarias Python: exitosas.
- No se han comprobado integración SRI, Windows, certificado real, correo real ni persistencia transaccional.

## Criterios de aceptación
1. Validar XML y firma con el SRI de pruebas.
2. Autorizar casos de factura con distintos impuestos, descuentos, datos y errores.
3. Verificar que doble clic y pérdida de internet no dupliquen comprobantes.
4. Guardar XML autorizado, respuesta SRI y RIDE con trazabilidad y backup.
5. Preparar Gmail con PDF/XML correctos y registrar entrega o fallo.
6. Verificar conciliación contra facturador actual, numeración y establecimiento.
7. Aprobar puesta en producción con revisión fiscal y técnica documentada.

**No cambiar ambiente a producción ni usar secuenciales reales hasta superar estos controles.**
