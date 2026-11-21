# GUÍA MAESTRA — puesta en marcha del Facturador Nicole

**Actualizado:** 21 de noviembre de 2026  
**Proyecto:** `jeffer91/facturas-nicole` (JavaScript / Electron, escritorio Windows)  
**Estado general:** DESARROLLO IMPLEMENTADO EN CÓDIGO, **NO VALIDADO PARA EMITIR FACTURAS REALES**  
**Ambiente permitido durante estas verificaciones:** PRUEBAS / CERTIFICACIÓN DEL SRI.

> Este es el documento principal de seguimiento del proyecto. Cada cambio futuro debe registrar aquí: qué se hizo, qué evidencia lo demuestra, qué falta y si autoriza —o no— avanzar de etapa. Una tarea no se marca como probada solo porque el código exista.

## 1. Tablero de avance

| Etapa | Estado comprobable | Falta para cerrar |
|---|---|---|
| A. Registro público de clientes y acceso admin | Código existente en el repositorio | Comprobar login y registros desde el PC |
| B. Ventas y borradores en Electron | Interfaz implementada | Probar con datos reales y revisar cálculos |
| C. XML y firma P12/PFX | Código incorporado; **sin prueba con certificado real** | Instalar dependencias, generar XML, validar firma/XSD |
| D. Servicios del SRI (recepción y autorización) | Integración SOAP incorporada; **sin respuesta verificada del SRI** | Probar envío, autorización y manejo de errores |
| E. PDF/RIDE, historial, respaldo y correo | Implementados parcialmente; sin validación completa | Revisar el RIDE obligatorio, SMTP, respaldos y reinicios |
| F. Habilitación tributaria y producción | **NO habilitada ni verificada en este proyecto** | Verificar RUC, punto de emisión, régimen y primer comprobante |
| G. Instalador Windows | Comando `npm run dist` configurado | Compilar e instalar en una PC Windows |

**Criterio para declarar «lista»:** no bastará con que cargue la pantalla. Hay que conseguir una factura de prueba `AUTORIZADO` por el SRI, validar el XML firmado y el RIDE, verificar el ciclo de recuperación de errores y probar el correo. La producción requiere además RUC habilitado y verificación tributaria.

## 2. Orden exacto de trabajo

### Paso 1 — Descargar e iniciar en VS Code [PENDIENTE DE EJECUCIÓN]
1. Abrir el repositorio en Visual Studio Code, desde el directorio raíz.
2. Instalar Node.js y las dependencias: `npm install`.
3. Validar sintaxis: `npm run check`.
4. Ejecutar pruebas: `npm test`.
5. Abrir la aplicación: `npm start`.
6. Confirmar que carga el escritorio local y permite iniciar sesión con el PIN administrativo existente.

**Evidencia esperada:** salida de la terminal sin errores y captura de la app abierta. **No hay registro de una ejecución satisfactoria en el PC del usuario.**

### Paso 2 — Configurar datos del emisor [PENDIENTE]
En la sección de configuración ingresar RUC, razón social exacta, nombre comercial, dirección matriz, dirección del establecimiento si aplica, establecimiento, punto de emisión, secuencial siguiente verificado, forma de pago y condición tributaria. Mantener **PRUEBAS**.

**Atención a la numeración:** se mencionó empezar en 2000. Esto NO debe habilitarse sin revisar primero las facturas ya emitidas y el punto de emisión que utilizará el nuevo programa; no duplicar ni saltar números sin verificación.

**Evidencia esperada:** configuración revisada contra el RUC y secuenciales anteriores.

### Paso 3 — Seleccionar y comprobar el certificado [PENDIENTE]
Seleccionar el archivo local `.p12` / `.pfx` desde la aplicación. Introducir su contraseña **solo en la pantalla local** al emitir una prueba. Confirmar titularidad, vigencia y que el XML queda firmado XAdES-BES y supera el XSD correspondiente.

**Nunca** compartir el certificado ni su contraseña por ChatGPT, GitHub, correo público o Supabase.

**Evidencia esperada:** validación de la firma y XSD, sin divulgar claves ni datos sensibles.

### Paso 4 — Primera factura en certificación del SRI [PENDIENTE]
1. Ingresar venta ficticia con un cliente de prueba y artículos de prueba.
2. Generar XML y firmar.
3. Transmitir al **ambiente de pruebas** por el servicio de recepción del SRI.
4. Comprobar estado de recepción `RECIBIDA` y luego consultar autorización.
5. Comprobar `AUTORIZADO`. Si aparece `DEVUELTA`, `NO AUTORIZADO` o `PENDIENTE`, conservar clave y secuencial y diagnosticar el motivo; no crear a ciegas otra factura.

**Evidencia esperada:** clave de acceso de 49 dígitos, respuesta del SRI y XML autorizado, con datos sensibles ocultos.

### Paso 5 — Revisar salida, errores y resguardo [PENDIENTE]
Comprobar que el PDF (RIDE) coincida con el XML autorizado y tenga todos los campos obligatorios. Probar envío SMTP de XML y PDF únicamente para comprobantes reales autorizados, usando un destinatario de prueba permitido. Verificar mensajes de error, desconexión, reintento de consulta, reinicio, unicidad de secuenciales, respaldo y restauración de archivos.

**Evidencia esperada:** validación de RIDE, comprobación de entrega y recuperación sin duplicados.

### Paso 6 — Validación tributaria y producción [BLOQUEADA]
Antes de activar PRODUCCIÓN:
- Confirmar que el RUC está habilitado como emisor de comprobantes electrónicos en producción.
- Verificar establecimiento, punto de emisión, secuencial, régimen tributario, obligaciones especiales y tarifas vigentes.
- Confirmar que el tipo de factura y los artículos están cubiertos por el programa. Actualmente el cálculo está planteado para factura ordinaria IVA 0 % y 15 %; otros tratamientos necesitan implementación adicional.
- Repetir la lista de pruebas después de cualquier cambio de biblioteca, XML o certificado.
- Obtener una autorización expresa del operador antes de generar la **primera venta real**.

**Evidencia esperada:** primer XML de producción autorizado y conciliado contra el portal del SRI.

### Paso 7 — Instalar y operar en Windows [PENDIENTE]
Tras aprobar todas las pruebas:
- Compilar instalador mediante `npm run dist`.
- Instalar, iniciar sesión y probar en la computadora de operación.
- Configurar copias de seguridad y custodia documental durante el plazo legal.
- Asegurar recuperación ante apagones y cambios de equipo.

## 3. Archivos relevantes

- `electron/main.cjs`: ventana local y puente IPC.
- `electron/preload.cjs`: API limitada para la interfaz.
- `electron/sri-service.cjs`: motor local de facturación, firma, transmisión y persistencia.
- `site/facturador/index.html` / `app.js`: pantalla de ventas y configuración.
- `tests/core.test.cjs`: pruebas unitarias; no equivalen a autorización del SRI.
- `.github/workflows/validar-facturador.yml`: comprobaciones automatizadas (revisar su resultado antes de marcarlas como aprobadas).

## 4. Registro de avances

| Fecha | Trabajo realizado | Evidencia | Estado |
|---|---|---|---|
| 2026-11-21 | Estructura Electron y pantalla de preparación preexistentes | Archivos del repositorio | Código revisado |
| 2026-11-21 | Motor local de XML/firma/SOAP, PDF, SMTP, historial, IPC y configuraciones incorporados | Archivos en GitHub | Código incorporado; integración real no probada |
| 2026-11-21 | Pruebas unitarias y flujo de CI incorporados | `tests/core.test.cjs` y workflow | Ejecución exitosa no verificada |
| 2026-11-21 | Guía maestra publicada y enlazada al inicio del README y de la pantalla | Este documento y pantalla | Documentado |

## 5. Fuentes de referencia
- SRI: https://www.sri.gob.ec/facturacion-electronica
- Ficha técnica de comprobantes electrónicos esquema offline v2.34 y XSD oficiales.
- Biblioteca técnica utilizada (componentes experimentales): https://github.com/esteban-dcp/ecuador-tax

**Regla de actualización:** tras cada avance real, mover únicamente las etapas con evidencia del estado PENDIENTE a VERIFICADO, anotar fecha y registrar fallas encontradas y correcciones aplicadas. No declarar lista la app hasta pasar la validación de extremo a extremo y la revisión tributaria.
