# Facturas Nicole

Aplicación para recopilar datos de clientes de Nicole Encajes (Ecuador), mediante QR público y panel administrativo.

Enlaces previstos para GitHub Pages:

- Cliente público: https://jeffer91.github.io/facturas-nicole/
- Administrador con PIN: https://jeffer91.github.io/facturas-nicole/admin/
- Cartel QR imprimible: https://jeffer91.github.io/facturas-nicole/cartel.html

Campos obligatorios: tipo y número de identificación (cédula, RUC o pasaporte), nombres o razón social, correo, celular y aceptación del tratamiento para facturación. Dirección opcional.

Tecnologías: archivos web estáticos en site; Edge Function invoice-api; tablas privadas del Supabase Nicole Encajes. El PIN está almacenado como hash bcrypt en Supabase, nunca en el código de GitHub. La sesión del administrador dura hasta 8 horas y el formulario de clientes no requiere autenticación. Hay límites básicos para solicitudes y protección RLS; los clientes no pueden listar registros.

Desde administración se pueden consultar y copiar los datos, exportar CSV y marcar como gestionado después de tramitar la factura. Esta aplicación NO genera XML, firma, autoriza ni envía facturas electrónicas ante el SRI.

Para activar el sitio: GitHub -> Settings -> Pages -> Build and deployment -> Source: GitHub Actions. Si Pages aún no estaba habilitado, selecciónalo y ejecuta el workflow "Publicar Facturas Nicole".

Privacidad: información personal de clientes. No usar para marketing sin una base legal separada. Definir un plazo de conservación y procedimiento de rectificación/eliminación.


## Fotografías de comprobantes de compra
- El cliente puede tomar una fotografía o seleccionar una de su galería desde el formulario público. Es **opcional**, no sustituye los datos obligatorios.
- El navegador convierte la imagen a JPG, la reduce hasta un máximo de 2 MB y evita conservar metadatos EXIF habituales del archivo original.
- La API valida la cabecera binaria, el tipo y el tamaño, y guarda la fotografía en el bucket privado `nicole-invoice-receipts`.
- Cada foto queda asociada a un registro en `invoice_client_registrations` mediante `receipt_storage_path`, `receipt_mime` y `receipt_uploaded_at`.
- La administración puede pulsar **Ver foto de la compra**. Se genera una URL firmada y temporal de 120 segundos para visualizar el archivo.
- Los visitantes no tienen permisos de consulta sobre la tabla ni acceso directo a los archivos. El CSV indica si hay foto, pero nunca revela la ruta privada.
- La imagen permite comprobar visualmente los productos o cantidades, **no extrae los productos automáticamente** y **no constituye una factura autorizada por el SRI**.
