# Arquitectura propuesta AWS y enfoque Zero Trust

**Estado:** arquitectura de trabajo propuesta; validar restricciones de la asignatura  
**Base:** [Requisitos del MVP](./01-requisitos-mvp.md)  
**Restricción:** demostración en aproximadamente diez días, sin pasarela ni dinero real

## 1. Objetivo de arquitectura

Construir una demostración pequeña que permita probar campañas, autenticación administrativa y registro de donaciones simuladas. El diseño debe mostrar que cada solicitud protegida se valida, que el estado de una donación no depende del navegador y que las acciones relevantes generan evidencia para monitoreo.

La instrucción verbal menciona Amazon Cognito, AWS Lambda y Amazon CloudWatch. Como stack de trabajo el equipo propone React/Vite, API Gateway, DynamoDB, S3/CloudFront y AWS CDK; la justificación está en [04-decision-stack-tecnologico.md](./04-decision-stack-tecnologico.md). Los componentes adicionales siguen sujetos a restricciones que pueda especificar la asignatura.

## 2. Componentes propuestos

| Componente | Responsabilidad propuesta | Estado |
|---|---|---|
| Amazon Cognito User Pool | Identidad de administradores; cuentas individuales y MFA. Los donantes del prototipo no necesitan cuenta. | Mencionado por el profesor; confirmar configuración y MFA requerido. |
| Amazon API Gateway | Exponer rutas HTTP; aplicar autorización JWT de Cognito a rutas administrativas y límites de tasa básicos. | Propuesta seleccionada como base de trabajo; confirmar restricciones del curso. |
| AWS Lambda | Ejecutar lógica de campañas, validación de donaciones simuladas, autorización de cada operación y escritura de auditoría. Dividir funciones por responsabilidad para limitar permisos. | Mencionado por el profesor; confirmar alcance. |
| Amazon DynamoDB | Persistir campañas de demostración y donaciones simuladas. No guardar información de pago real. | Propuesta seleccionada como base de trabajo; confirmar restricciones del curso. |
| Amazon CloudWatch | Centralizar logs estructurados, métricas y alarmas de seguridad/operación. | Mencionado por el profesor; confirmar nivel de monitoreo esperado. |
| Amazon S3 + CloudFront | Servir una interfaz React/Vite estática desde un bucket privado con HTTPS. Evitar claves AWS en el navegador. | Propuesta seleccionada como base de trabajo; confirmar restricciones del curso. |

No se propone una pasarela, servicio de tarjetas, flujo de liquidación ni captura de datos de tarjeta. Para simplificar y reducir costo, no se incorporan de inicio WAF, SIEM externo, EKS, NAT Gateway ni servicios de monitoreo adicionales, salvo que el diseño del curso los exija.

## 2.1 Estado del primer stack de código

El stack CDK inicial ya define los servicios anteriores, pero **no está desplegado** y la interfaz web aún no consume la API ni implementa el inicio de sesión administrativo. Las pruebas locales de CDK/backend no sustituyen pruebas en una cuenta AWS.

| Ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /campaigns` | Público | Lista campañas activas. |
| `POST /donations` | Público | Valida monto, campaña, consentimiento y clave idempotente; el servidor crea `SIMULATED_SUCCESS`. No procesa dinero. |
| `GET /admin/campaigns` | JWT Cognito + grupo `Administrators` | Lista campañas administrativas. |
| `POST /admin/campaigns` | JWT Cognito + grupo `Administrators` | Crea una campaña en estado `DRAFT`. |
| `PATCH /admin/campaigns/{campaignId}` | JWT Cognito + grupo `Administrators` | Edita campos permitidos y puede activar (`ACTIVE`) o devolver a borrador (`DRAFT`). |
| `POST /admin/campaigns/{campaignId}/archive` | JWT Cognito + grupo `Administrators` | Archiva una campaña sin eliminarla. |

El User Pool deshabilita el autorregistro y exige MFA TOTP; todavía no crea una cuenta administradora inicial. Los roles Lambda son separados y limitados a las acciones/recursos de cada handler. DynamoDB usa modo bajo demanda, cifrado administrado por AWS y recuperación a un punto en el tiempo. Esta última tiene costo: revisar si se mantiene durante la demo. Las tablas y el User Pool se retienen al eliminar el stack; la interfaz almacenada en S3 se elimina con sus objetos. Los logs se retienen siete días.

API Gateway aplica un límite de tasa global por etapa (10 solicitudes por segundo, ráfaga de 20), no cuotas por usuario/IP. Los handlers rechazan cuerpos mayores de 16 KiB. La alarma actual detecta errores 5xx de API, pero no envía notificaciones ni cubre por sí sola fraude, intentos fallidos de autenticación o abuso de las rutas públicas. Los accesos se registran sin payload ni dirección IP. Configurar presupuesto y revisar costos antes de desplegar; no asumir que estos controles bastan para producción.

La auditoría local de dependencias de infraestructura reporta dos hallazgos moderados asociados a `minimatch` incluido en AWS CDK 2.275.0. La versión recomendada automáticamente por `npm audit fix --force` (2.239.0) también presenta vulnerabilidades de mayor severidad y no pasó las pruebas locales de CDK; por eso no se aplicó ese downgrade. Revisar la alerta y una actualización compatible de CDK antes del despliegue. Esta dependencia afecta el toolchain de infraestructura, no el bundle de las Lambdas.

## 3. Flujo de solicitudes y límites de confianza

### Visitante: lectura y donación simulada

1. El navegador obtiene la aplicación web pública.
2. Para listar campañas activas, la interfaz llama a una ruta pública de API Gateway.
3. API Gateway invoca una Lambda de lectura con permisos solo para consultar campañas publicables.
4. Para iniciar una donación simulada, el navegador envía campaña, monto y preferencia de publicación. La Lambda valida el estado de la campaña, el monto permitido y los campos publicables en el servidor.
5. El servidor crea el registro con `simulation=true` y le asigna `SIMULATED_SUCCESS` según la regla fija de la demo. Nunca acepta del cliente un estado de pago final.
6. El resultado se muestra como simulación, indicando que no hubo cargo ni recepción de dinero.

### Administrador: operación protegida

1. El administrador se autentica en Cognito con cuenta individual y MFA.
2. API Gateway valida el token JWT en cada solicitud a rutas administrativas.
3. La Lambda verifica además rol/permisos y autorización para el recurso concreto. No confía en que una ruta esté protegida solo porque la interfaz o el token parezcan correctos.
4. Crear, editar o archivar campañas requiere autorización del lado servidor y genera un evento de auditoría.
5. Las operaciones administrativas se limitan a campañas y generan un evento de auditoría con actor, recurso, fecha y cambios mínimos.
6. Las funciones Lambda usan roles IAM distintos y mínimos; una función de lectura no recibe permisos de escritura ni acceso a auditoría si no lo necesita.

### Monitoreo

1. Las Lambdas emiten logs estructurados con identificador de solicitud, operación, resultado y referencia de recurso seudónima cuando sea posible.
2. No se registran tokens JWT, contraseñas, datos de tarjeta, secretos, payloads completos ni datos personales innecesarios.
3. CloudWatch recoge métricas de errores de autorización, solicitudes inválidas, errores de aplicación y actividad administrativa.
4. Alarmas con umbrales razonables notifican patrones anómalos; las alarmas deben tener responsable y procedimiento de respuesta.

## 4. Aplicación práctica de Zero Trust

Zero Trust no significa reautenticar al usuario en cada clic ni sondear continuamente a cada sesión. En este MVP se traduce en:

- No conceder acceso por estar dentro de una red, conocer una URL o haber iniciado sesión anteriormente.
- Validar firma, emisor, audiencia y vigencia del JWT en cada llamada protegida; volver a comprobar el permiso de negocio y el recurso en el backend.
- Aplicar MFA al acceso administrativo y sesiones con expiración/revocación coherentes con el servicio de identidad.
- Validar entradas y estado de recursos en el servidor, con rechazo por defecto.
- Asignar a cada función un rol IAM específico y mínimo; evitar credenciales compartidas o de larga duración en el frontend.
- Registrar intentos fallidos y acciones privilegiadas para detectar anomalías sin guardar más datos de los necesarios.
- Tratar explícitamente la simulación como no financiera y aislarla de cualquier futura integración real.

## 5. Modelo de amenazas preliminar

| Amenaza | Impacto | Controles propuestos | Señales a monitorear |
|---|---|---|---|
| Visitante altera monto, campaña o estado desde el navegador | Recaudación simulada incorrecta o falsa impresión de pago | Validar campaña/monto en Lambda; el cliente no define el estado final; transiciones permitidas del lado servidor. | Validaciones rechazadas, cambios inválidos repetidos. |
| Usuario no autorizado intenta editar campañas | Desinformación pública o abuso de funciones administrativas | Cognito + authorizer JWT; autorización por operación y recurso; privilegio mínimo en IAM. | Fallos de autorización y ráfagas de solicitudes administrativas. |
| Robo o abuso de cuenta administrativa | Cambios maliciosos de campañas o de estados simulados | MFA, cuentas individuales, sesiones limitadas, revisión de accesos y auditoría de cambios. | Inicios de sesión fallidos, cambios sensibles, actividad inusual. |
| Acceso a datos de otra donación mediante cambio de identificador | Exposición de datos o modificación de registros | No exponer datos internos en rutas públicas; autorización sobre cada recurso; respuestas públicas con campos permitidos por lista. | Rechazos por acceso a recursos ajenos. |
| Permisos IAM excesivos o función comprometida | Lectura, modificación o borrado de datos fuera de la tarea necesaria | Rol distinto por función; permisos de recurso concretos; revisión de políticas antes de desplegar. | Errores de acceso y cambios de infraestructura mediante CloudTrail si el entorno lo habilita. |
| Logs exponen secretos o datos personales | Acceso indebido y mayor impacto de una filtración | Logs estructurados mínimos, redacción de campos, no registrar tokens ni payloads, retención definida y permisos de lectura restringidos. | Búsqueda/revisión periódica de patrones prohibidos y accesos a logs. |
| Confusión entre simulación y donación real | Usuarios creen que un pago fue cobrado o recibido | Etiquetas persistentes de “simulación”; aviso previo y recibo final que indique que no hubo cargo. Datos de prueba solamente. | Revisión de UX y pruebas de aceptación. |
| Demasiadas alarmas o registros de bajo valor | Costos, ruido y pérdida de señales útiles | Muestrear o agregar eventos de lectura de bajo riesgo; registrar todas las acciones privilegiadas; limitar payload y retención; alarmar por umbrales accionables. | Volumen de logs, costo, falsos positivos y tiempo de respuesta. |

Este modelo inicial debe ajustarse al diagrama final, datos efectivamente tratados y capacidades habilitadas en la cuenta AWS del curso.

## 6. Costos y límites de monitoreo

La observabilidad y la verificación tienen costos de solicitudes, cómputo, almacenamiento de logs, retención y atención de alertas. El prototipo no debe implementar telemetría indiscriminada para cada evento de bajo riesgo. Se recomienda:

- Auditar siempre cambios privilegiados y transiciones de estado simuladas.
- Medir/registrar errores de autorización y fallas relevantes; agregar o muestrear lecturas públicas de alta frecuencia si aportan poco valor de seguridad.
- Definir retención corta para datos de demostración y logs, consistente con las necesidades del curso.
- No prometer detección “en tiempo real” ni cobertura total sin configurar y probar métricas, umbrales y notificaciones.
- Presentar los drivers de costo y, si el curso exige montos, calcularlos con la región, volumen, retención y precios actuales en AWS Pricing Calculator.

La validación de JWT en cada solicitud protegida es una comprobación síncrona necesaria para autorizar la llamada, no un sondeo separado que mantenga al usuario bajo observación constante. La actividad adicional de detección se concentra en señales que tengan respuesta definida.

## 7. Decisiones de arquitectura pendientes

1. Confirmar que no existan servicios obligatorios distintos a los indicados verbalmente y elegir la región AWS permitida.
2. Confirmar modalidad de MFA de Cognito compatible con el entorno universitario.
3. Confirmar cuenta, propietario, permisos de despliegue, presupuesto y alertas de gasto.
4. Acordar qué métricas/alarms de CloudWatch se mostrarán y quién recibirá notificaciones.
5. Acordar procedimiento de limpieza del entorno después de la demo.

## 8. Plan de trabajo tentativo de diez días

| Día | Resultado |
|---|---|
| 1 | Cerrar alcance, requisitos mínimos, equipo, cuenta AWS y criterios de aceptación. |
| 2 | Validar arquitectura, diagrama de flujo y amenazas principales; preparar repositorio y entornos. |
| 3 | Crear infraestructura mínima y autenticación administrativa Cognito con MFA si el entorno lo permite. |
| 4 | Implementar API de campañas con autorización y validación servidor. |
| 5 | Implementar creación y transición de donaciones simuladas. |
| 6 | Integrar persistencia y auditoría de cambios relevantes. |
| 7 | Integrar interfaz y estados simulados claramente rotulados. |
| 8 | Configurar CloudWatch, métricas/umbrales de seguridad y pruebas de abuso/errores. |
| 9 | Ejecutar pruebas de aceptación, revisar costos/permisos y corregir hallazgos. |
| 10 | Ensayar demo; completar informe, declarar asistencia de IA y explicar evaluaciones, límites y trabajo futuro. |

Este plan es una propuesta para organizar el trabajo, no una estimación garantizada. Debe ajustarse a las fechas, tamaño del equipo y entregables solicitados por el curso.

## 9. Siguiente paso

Validar esta propuesta con el equipo y, si es posible, con el profesor, especialmente servicios AWS adicionales, MFA y límites de gasto. Usar la decisión de stack y las pruebas de [03-modelo-amenazas-y-pruebas.md](./03-modelo-amenazas-y-pruebas.md) como base para comenzar el prototipo después de confirmar el acceso autorizado a AWS.
