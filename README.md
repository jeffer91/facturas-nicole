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
