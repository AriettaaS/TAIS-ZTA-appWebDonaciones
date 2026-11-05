# Requisitos del MVP

**Estado:** borrador para validación académica  
**Base:** [Alcance inicial y obligaciones a validar en Perú](./00-alcance-y-obligaciones-peru.md)

## 0. Restricciones del proyecto

- MVP universitario para demostrar una plataforma de donaciones monetarias en línea para proyectos sociales de la comunidad.
- Plazo aproximado de diez días.
- Solo se simulan las donaciones: no hay pasarela, dinero real, movimiento de fondos ni datos de tarjeta.
- AWS es la plataforma objetivo. El profesor mencionó Amazon Cognito, AWS Lambda y Amazon CloudWatch. El equipo propone completar el stack con React/Vite, API Gateway, DynamoDB, S3/CloudFront y CDK; revisar [04-decision-stack-tecnologico.md](./04-decision-stack-tecnologico.md) y ajustar si el curso impone restricciones.
- Todo componente generado con IA debe declararse en el informe y ser entendido, evaluado y verificado por el equipo.

## 1. Objetivo

Permitir que un visitante encuentre una campaña de una organización beneficiaria de prueba y complete un flujo de donación monetaria simulada. La demostración prioriza controles de acceso, integridad del registro, auditoría y monitoreo; no representa que se hayan recibido o liquidado fondos reales.

## 2. Alcance

### Incluido

- Campañas de asociaciones o fundaciones sin fines de lucro formalmente constituidas en Perú.
- Donaciones únicas en soles peruanos (PEN), con monto elegido por el donante.
- Donaciones repetidas iniciadas por el usuario como operaciones independientes.
- Flujo de pago completamente simulado, sin integrar una pasarela ni recopilar datos de tarjeta.
- Preferencia para mostrar públicamente el nombre y el monto individual, desactivada por defecto y sujeta a autorización expresa. En la simulación se usan datos ficticios; no es una promesa de anonimato para una futura operación real.
- Administración autenticada para crear, editar, activar y archivar campañas.
- Resultado simulado asignado por el servidor tras validar la solicitud; el cliente no puede elegir ni falsificar el estado.
- Registro de auditoría de cambios administrativos y eventos de donación simulada.
- Monitoreo de eventos de seguridad y aplicación con Amazon CloudWatch según la propuesta de arquitectura AWS del equipo.

### Fuera del MVP

- Donaciones automáticas recurrentes o suscripciones.
- Beneficiarios personas naturales, empresas, entidades públicas u organizaciones fuera de las categorías acordadas.
- Cualquier cobro o transferencia de dinero real.
- Integración con pasarela, liquidación, reembolsos, contracargos o alcance PCI.
- Almacenamiento o procesamiento de datos de tarjeta.
- Emisión de comprobantes tributarios o promesas de deducibilidad por la plataforma.
- Autoregistro y publicación automática de beneficiarios o campañas sin revisión administrativa.

## 3. Actores y permisos iniciales

| Actor | Capacidades |
|---|---|
| Visitante/donante | Consultar campañas activas, iniciar una donación única simulada y elegir si desea que su nombre y monto de prueba aparezcan públicamente. No necesita una cuenta en la plataforma en el MVP. |
| Administrador | Acceder al panel con MFA; registrar y mantener campañas vinculadas a una beneficiaria ficticia/de prueba; activar o archivar campañas de demostración; consultar estados simulados. |
| Simulador del flujo de pago | Representar estados de una donación de prueba sin contactar a un proveedor ni mover dinero. Solo el mecanismo del lado servidor puede cambiar el estado; nunca se confía en un valor enviado por el navegador. |

El beneficiario no tendrá acceso administrativo propio en el MVP. Se usarán beneficiarias ficticias o datos de prueba; no se afirmará que una organización real fue verificada.

## 4. Flujos funcionales

### 4.1 Descubrir una campaña

1. El visitante ve únicamente campañas activas.
2. La página muestra el nombre de demostración de la beneficiaria y un aviso de que la campaña y la donación son ficticias.
3. Las campañas archivadas no aceptan nuevas donaciones.
4. Si se muestran montos o progreso, se identifican claramente como simulados y se calculan solo con estados de prueba incluidos por las reglas del prototipo.

### 4.2 Donar

1. El visitante elige un monto en PEN y la campaña.
2. Antes de continuar, ve quién sería la organización beneficiaria, el monto simulado y un aviso claro de que no se realizará un cobro real.
3. La publicación conjunta del nombre y monto individual es opcional y no está seleccionada por defecto. Solo se publican ambos si el donante lo autoriza expresamente. Correo y mensajes no se publican en el MVP.
4. El servidor valida campaña y monto y crea una operación marcada explícitamente como simulada.
5. El servidor asigna el resultado `SIMULATED_SUCCESS` conforme a la regla fija de demostración; ignora cualquier estado enviado por el cliente.
6. La plataforma registra identificador de prueba, monto, campaña, beneficiario, preferencia de publicación, estado y metadatos de auditoría mínimos.
7. El usuario ve una confirmación que indica inequívocamente que se trata de una simulación y que no hubo cargo ni recepción de dinero.

### 4.3 Administrar campañas

1. El administrador inicia sesión con MFA.
2. Una campaña nueva se crea en estado borrador y se asocia a un registro de beneficiaria ficticia/de prueba.
3. Solo campañas completas pueden activarse en la demostración. La activación no significa que se haya validado legalmente una entidad real.
4. El administrador puede editar una campaña; los cambios relevantes quedan auditados.
5. Archivar impide nuevas donaciones y conserva la historia y relación con sus transacciones. No existe borrado físico desde el flujo normal del panel.
6. La autorización se comprueba en el servidor para cada operación administrativa; ocultar botones en la interfaz no cuenta como control de acceso.

## 5. Requisitos de seguridad y operación

- **Identidad administrativa:** MFA obligatorio, cuentas individuales, recuperación segura y revocación de sesiones.
- **Mínimo privilegio:** sin cuentas compartidas; el rol de administrador solo recibe las capacidades necesarias para gestionar campañas y atender operaciones.
- **Autorización:** verificar permiso y estado del recurso en el servidor en toda operación; impedir que una campaña o transacción se modifique solo por cambiar un identificador.
- **Simulación:** marcar datos y estados como prueba; el servidor asigna el resultado de demostración tras validar la operación; impedir que el navegador se conceda un estado; no usar ni almacenar credenciales de una pasarela.
- **Integridad:** validar campaña, monto y transición de estado; hacer idempotentes los eventos simulados si pueden repetirse; dejar evidencia de los cambios.
- **Privacidad:** recopilar los datos mínimos; separar datos operativos de campos públicos; no registrar credenciales, tokens ni datos de tarjeta; limitar accesos a datos identificables.
- **Registro y auditoría:** conservar quién realizó cambios y cuándo, además de eventos de donación simulada relevantes; proteger los registros contra alteración y evitar secretos o datos personales innecesarios en logs.
- **Aplicación web:** usar HTTPS; proteger sesiones y cookies; validar entradas; aplicar defensas contra CSRF, XSS e inyección conforme al framework; limitar intentos y abuso en rutas sensibles.
- **Secretos y entornos:** no usar credenciales de proveedor de pagos en el prototipo; mantener cualquier credencial AWS fuera del código y del cliente; separar configuración de demostración y secretos.
- **Monitoreo:** seleccionar señales, umbrales y acciones de respuesta proporcionados al MVP; explicar qué se monitoriza y el costo/ruido que tendría monitorear cada solicitud a mayor escala.
- **Resiliencia:** definir manejo de errores y recuperación apropiados al entorno de demostración; no presentar el prototipo como listo para producción.
- **AWS:** aplicar mínimo privilegio a roles y servicios; no incluir credenciales en el código; separar configuración de demostración y secretos; elegir servicios finales tras contrastarlos con el diseño tecnológico y restricciones del curso.
- **Zero Trust proporcional:** no confiar en una solicitud por venir de la red o sesión previamente usada; autenticar y autorizar cada operación protegida. No implementar sondeos continuos de cada usuario: usar eventos y métricas para monitorear actividad y detectar patrones relevantes, explicando latencia, costo y ruido de alertas.

## 6. Criterios de aceptación mínimos

- Una campaña archivada no aparece como disponible para donar y el servidor rechaza intentos de pago para ella.
- Una campaña de demostración solo puede asociarse a un registro de beneficiaria de prueba; la interfaz no declara que una entidad real fue validada.
- El nombre de un donante no aparece públicamente por defecto; el sistema guarda la preferencia de publicación de manera separada.
- Cada operación queda identificada visualmente y en almacenamiento como simulada; no existe conexión a proveedor de pagos.
- La interfaz nunca afirma que se cobró o recibió dinero real.
- Manipular parámetros, llamadas o estado del navegador no permite elegir ni falsificar el resultado de una donación.
- El servidor produce un resultado simulado solo después de validar la campaña y el monto; la interfaz lo identifica como no financiero.
- Un administrador sin MFA no puede acceder al panel; un usuario público no puede realizar operaciones administrativas. (Si el diseño del curso no permite MFA en el plazo, documentar la limitación y la alternativa segura implementada.)
- Las ediciones y archivados quedan auditados y no eliminan transacciones asociadas.
- Ninguna ruta, log o base de datos solicita ni contiene datos de tarjeta.
- Los montos públicos, si se muestran, se identifican como resultados simulados y se basan solo en estados de prueba definidos.
- Los eventos relevantes generan registros observables en la solución de monitoreo seleccionada, sin exponer secretos ni datos personales innecesarios.

## 7. Decisiones pendientes antes de cerrar requisitos

1. **Diseño tecnológico del curso:** servicios AWS obligatorios, componentes provistos, restricciones y formato de la entrega.
2. **Mecanismo de simulación:** se propone que el servidor genere `SIMULATED_SUCCESS` automáticamente tras validar la operación; confirmar si el curso requiere demostrar también resultados fallidos.
3. **Transparencia pública:** mostrar únicamente totales agregados de operaciones simuladas y, para cada donación, nombre y monto solo si el donante autoriza expresamente su publicación. No mostrar correos ni mensajes en el MVP.
4. **Datos de prueba:** qué datos ficticios son necesarios y cuánto tiempo conservarlos.
5. **Importes:** límites de monto y moneda para la simulación.
6. **Cuenta administrativa:** quiénes podrán ser administradores y cómo se aprobarán y revisarán sus accesos.
7. **Informe académico:** plantilla, rúbrica y formato exigido para documentar decisiones, seguridad y asistencia de IA.

No se deben habilitar pagos reales en el prototipo. Cualquier futura transición a producción requeriría un proyecto y una revisión legal, de pagos, privacidad y seguridad independientes.

## 8. Siguiente paso

Revisar el stack propuesto en [04-decision-stack-tecnologico.md](./04-decision-stack-tecnologico.md) con el equipo. Si el ingeniero no entrega especificaciones adicionales, registrar las decisiones propuestas como supuestos y usarlas para cerrar el diagrama, las pruebas de aceptación y el plan de implementación.
