# Gmail exclusivamente en Microsoft Edge

## Funcionalidad implementada
El backend local puede crear un **borrador real en Gmail con PDF y XML adjuntos** usando la API de Gmail. Abre la carpeta Borradores en Microsoft Edge para que el operador revise y pulse Enviar.

**No envía correos automáticamente.** No requiere contraseña de Gmail ni guarda tokens en GitHub.

## Configuración en la computadora Windows
1. Crear un proyecto en Google Cloud, habilitar **Gmail API** y configurar pantalla de consentimiento OAuth.
2. Crear un cliente OAuth tipo **Aplicación de escritorio** y descargar su JSON.
3. Guardarlo solo en `%LOCALAPPDATA%\\NicoleFacturador\\gmail\\oauth_client.json`. No subirlo al repositorio.
4. Instalar dependencias: `pip install -r facturador_local/requirements-windows.txt`.
5. En la primera ejecución se abre el navegador para conceder permiso `gmail.compose`. El token se guarda cifrado con DPAPI, vinculado al usuario Windows.
6. Una vez autorizada la factura en SRI y generados PDF/XML, invocar desde el backend `preparar_borrador_gmail(destinatario, numero_factura, ruta_pdf, ruta_xml, autorizado=True)`.

**Advertencia:** el argumento `autorizado=True` es una interfaz provisional; antes de exponerlo en la UI debe derivarse exclusivamente de un registro local verificado contra la respuesta del SRI. El envío no se debe habilitar hasta entonces.

## Pendiente
Integrar el botón de envío en la pantalla de facturación, verificar estado SRI y generar archivos autorizados. La pantalla de configuración actual solo abre un borrador de texto sin adjuntos. El borrador con adjuntos se crea con este nuevo módulo, todavía sin interfaz.
