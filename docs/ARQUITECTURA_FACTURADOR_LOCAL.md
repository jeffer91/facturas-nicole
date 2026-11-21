# Nicole Facturador — arquitectura de implementación

Estado: diseño técnico inicial, NO apto para emitir facturas reales.
Rama: feature/facturador-local-sri

## Objetivo
Aplicación instalada en Windows para emisión de comprobantes electrónicos de Nicole Encajes, reutilizando el registro público de clientes existente. Sustituir el facturador gratuito solo después de pruebas de extremo a extremo y conciliación de secuenciales.

## Componentes
- Interfaz local de escritorio: Tauri + frontend web.
- Motor local: servicios para validación, impuestos, secuenciales, XML, firma XAdES-BES y conexión SRI.
- SQLite local: facturas, líneas, secuenciales, estados, bitácora de transmisión y documentos. Migraciones y respaldos cifrados.
- Supabase existente: registros públicos, contactos y fotografías; crear entidad de clientes maestros sin eliminar solicitudes históricas.
- Catálogo: lectura de Google Sheets con caché y sincronización, sin publicar credenciales en frontend.
- Entrega: RIDE PDF, XML autorizado, correo con registro de intentos y reenvío.

## Seguridad
- Archivo P12/PFX y contraseña exclusivamente locales; no repositorio, web pública ni Supabase.
- Usar almacenamiento seguro del sistema operativo para secretos y controles de acceso a archivos.
- Autenticación administrativa independiente del PIN del registro web; permisos mínimos.
- Nunca almacenar llaves privadas ni certificados con contraseña en logs.
- No activar producción con certificado de prueba, ni viceversa.

## Flujo de estados
BORRADOR -> LISTA_PARA_FIRMAR -> FIRMADA -> ENVIADA_RECEPCION -> PENDIENTE_AUTORIZACION -> AUTORIZADA -> ENVIADA_CLIENTE.
Estados alternativos: DEVUELTA, NO_AUTORIZADA, ERROR_TRANSITORIO, ENVIO_PENDIENTE.
- Clave de acceso y secuencial asignados de manera transaccional.
- Reintentos idempotentes: consultar estado antes de reenviar; nunca generar nuevo número por error de red.
- Guardar XML firmado, respuesta SRI, número y fecha de autorización, RIDE y evidencia de entrega.
- No permitir modificar una factura autorizada; correcciones por comprobante tributario pertinente.

## Separación de ambientes
- Certificación: pruebas con comprobantes ficticios.
- Producción: habilitar solo tras checklist formal y configuración del establecimiento/punto de emisión.
- El SRI gratuito sigue disponible durante transición; conciliar último secuencial antes del corte.
- Evaluar punto de emisión distinto para evitar colisiones, sujeto a configuración tributaria real.

## Primeros entregables
1. Esqueleto instalable de Windows con SQLite y migraciones.
2. Clientes maestros: búsqueda, deduplicación por tipo y número de identificación, actualización controlada.
3. Catálogo sincronizado, impuestos por producto y comprobación de precios.
4. Motor XML validado contra XSD aplicable y pruebas automatizadas.
5. Firma XAdES-BES con P12/PFX, validación de certificado y pruebas con SRI certificación.
6. Recepción/autorización, RIDE, correo, auditoría, copias de seguridad y recuperación.
7. Prueba de extremo a extremo y autorización expresa para activar producción.

## Datos pendientes de configuración
RUC emisor, razón social, régimen tributario, establecimiento, punto de emisión, secuencial, dirección matriz/establecimiento, impuestos aplicables, correo emisor y características del certificado. No guardar datos sensibles en GitHub.

## Criterios de salida
- XML válido y firmado, aceptado y autorizado por SRI en certificación.
- Reintentos no duplican facturas.
- RIDE y XML coinciden con autorización.
- Recuperación desde respaldo verificada.
- Validación con contador/responsable tributario antes de activar producción.
