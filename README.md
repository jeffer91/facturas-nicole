# Facturas Nicole — aplicación de escritorio y registro de clientes

Sistema de Nicole Encajes en Ecuador: registro público de compradores, panel de administración protegido por PIN y facturador de escritorio Electron con integración con el SRI.

## Enlaces públicos
- Cliente: https://jeffer91.github.io/facturas-nicole/
- Administrador: https://jeffer91.github.io/facturas-nicole/admin/
- Cartel QR: https://jeffer91.github.io/facturas-nicole/cartel.html
- Borrador web: https://jeffer91.github.io/facturas-nicole/facturador/

La versión web solo permite preparar borradores: **no puede firmar ni enviar comprobantes**. Para emitir debes abrir el programa Electron instalado en una computadora. El registro de clientes sigue usando la Edge Function de Supabase, con sesión administrativa y fotografías de compra privadas.

## Instalar en Windows
Necesitas Node.js y conexión a Internet para instalar dependencias.

1. Descarga o clona este repositorio en una carpeta local.
2. Abre una terminal en esa carpeta y ejecuta **npm install**.
3. Ejecuta **npm run check** y **npm test**.
4. Inicia el facturador con **npm start**.
5. Para crear el instalador Windows NSIS utiliza **npm run dist**.

La aplicación de escritorio carga HTML empaquetado localmente. El proceso principal de Electron recibe las operaciones mediante IPC restringido a esa página y a una sesión de administrador validada.

## Configurar el emisor
Abre el panel «Configuración tributaria, firma electrónica y correo» y completa:

- RUC, razón social, nombre comercial y dirección matriz del emisor.
- Establecimiento, punto de emisión y siguiente secuencial libre según tus registros y el SRI. El valor inicial predeterminado es 1, NO 2000. Un salto de numeración exige verificación previa del punto de emisión y del historial.
- Obligación de llevar contabilidad y forma de pago.
- Ambiente PRUEBAS hasta haber realizado una autorización completa con el SRI.
- Certificado P12/PFX guardado en esta computadora. Su contraseña se solicita para cada factura y nunca se envía al repositorio.
- Configuración SMTP opcional para enviar el XML y el PDF al comprador después de la autorización. La contraseña SMTP se cifra mediante safeStorage de Electron si está disponible. No se guarda en texto plano.

La pantalla obliga a confirmar el cambio de PRUEBAS a PRODUCCIÓN y cada venta real. En producción confirma previamente la habilitación del RUC como emisor electrónico.

## Cómo emitir

1. Inicia sesión con PIN y selecciona un cliente registrado.
2. Añade productos, cantidades, precios sin impuesto y tarifa de IVA 0 % o 15 % para cada línea.
3. Introduce la contraseña del certificado P12/PFX.
4. Pulsa «Firmar y enviar al SRI».
5. El proceso principal genera el XML, firma XAdES-BES, reserva secuencial y clave de acceso, transmite por SOAP y consulta la autorización.
6. Si el resultado es AUTORIZADO, genera el PDF y permite remitir XML y PDF por SMTP. Si es PENDIENTE, consulta la misma clave desde el historial y NO generes una factura duplicada.
7. XML firmado, datos de autorización, PDF e historial se guardan bajo la carpeta local de usuario de Electron, subdirectorio sri-facturas. Debes realizar respaldos periódicos y conservar la documentación tributaria.

Los servicios de producción del SRI son RecepcionComprobantesOffline y AutorizacionComprobantesOffline, alojados en el servidor https://cel.sri.gob.ec/comprobantes-electronicos-ws/ . El ambiente de pruebas utiliza https://celcer.sri.gob.ec/comprobantes-electronicos-ws/ . Nunca se envían los comprobantes por correo electrónico al SRI.

## Estado real y limitaciones

**Implementado en el código:** generación de XML mediante @ecuador-tax/xml 0.1.1, firma mediante @ecuador-tax/signature 0.1.1, SOAP mediante @ecuador-tax/sri 0.1.1, historial persistente, protección de duplicados, PDF/RIDE básico, consulta de estados, envío SMTP opcional y seguridad de IPC.

**Todavía no verificado:** instalación final en el PC del contribuyente, validación con certificado de firma y RUC habilitado, autorización real en ambiente de certificación, comprobaciones del RIDE y pruebas de entrega de correo. El SDK seleccionado declara experimentales sus módulos de XML, firma y SRI, por no contar con evidencia pública de una autorización real de punta a punta. Por tanto, **no se puede afirmar que la app esté lista para emitir legalmente en producción**.

**Alcance tributario:** implementación inicial de facturas ordinarias con IVA 0 % y 15 %. ICE, IRBPNR, exportaciones, reembolsos, regímenes especiales (incluidos campos RIMPE cuando correspondan), notas de crédito, retenciones y otros comprobantes requieren desarrollo y validación antes de utilizarse para dichas operaciones. No uses esta versión para esos casos. La emisión exige revisión tributaria según tu actividad.

## Pruebas y seguridad

- Ejecutar npm run check y npm test. El workflow de GitHub Actions valida sintaxis y pruebas unitarias, no emite facturas reales.
- Verificar generación y validez XSD del XML firmado usando un P12/PFX real en ambiente de certificación.
- Verificar recepción RECIBIDA y autorización AUTORIZADO, códigos de rechazo y contingencias.
- Comprobar numeración, unicidad, reintentos, correo y respaldo de documentos.
- No subir jamás archivos P12/PFX, contraseñas, XML reales de clientes o historiales a GitHub.
- Proteger la PC con cifrado de disco y respaldo cifrado: se almacenan datos personales del cliente.
- En producción el SRI exige transmitir al momento de emitir. La aplicación no debe funcionar como cola de facturas diferidas.

Fuentes oficiales: https://www.sri.gob.ec/facturacion-electronica . Ficha técnica SRI offline v2.34 (julio de 2026). SDK experimental: https://github.com/esteban-dcp/ecuador-tax .
