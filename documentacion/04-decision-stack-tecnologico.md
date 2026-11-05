# Decisión propuesta: stack tecnológico del MVP

**Estado:** propuesta elegida como base de trabajo del equipo; validar restricciones de la asignatura  
**Contexto:** cuatro integrantes, experiencia web amplia, entrega académica aproximada de diez días, flujo completo pero simulado  
**Relacionado:** [Requisitos del MVP](./01-requisitos-mvp.md), [Arquitectura AWS Zero Trust](./02-arquitectura-propuesta-aws-zero-trust.md) y [Modelo de amenazas y pruebas](./03-modelo-amenazas-y-pruebas.md)

## 1. Decisión

Usar **TypeScript de extremo a extremo**, con una aplicación web estática en React/Vite y una arquitectura serverless en AWS desplegada como infraestructura como código con AWS CDK.

| Capa | Tecnología propuesta | Uso |
|---|---|---|
| Interfaz web | React + Vite + TypeScript | Catálogo de campañas, formulario de donación simulada, confirmación y panel administrativo. |
| Identidad administrativa | Amazon Cognito User Pool | Cuentas individuales de administradores y MFA. Los visitantes no necesitan cuenta en el MVP. |
| API | Amazon API Gateway HTTP API | Rutas públicas para consultar campañas e iniciar la simulación; rutas protegidas para administración. |
| Lógica | AWS Lambda con Node.js y TypeScript | Validación en servidor, campañas, donaciones simuladas y auditoría. |
| Persistencia | Amazon DynamoDB | Campañas y registros simulados; modo bajo demanda durante el prototipo. |
| Frontend estático | Amazon S3 privado + Amazon CloudFront | Distribución HTTPS de los archivos web sin hacer público el bucket ni incluir credenciales AWS en el navegador. |
| Observabilidad | Amazon CloudWatch | Logs estructurados mínimos, métricas y alarmas accionables. |
| Infraestructura | AWS CDK en TypeScript | Definir y desplegar recursos reproducibles, permisos IAM y configuración por entorno. |

Amazon Cognito, AWS Lambda y Amazon CloudWatch fueron nombrados por el profesor. React/Vite, API Gateway, DynamoDB, S3/CloudFront y CDK son propuestas del equipo basadas en la necesidad del MVP, no requisitos confirmados por el profesor.

### Estado de implementación

El repositorio contiene un primer stack CDK para los recursos descritos, las rutas públicas y administrativas y los handlers Lambda. Cognito deshabilita el autorregistro y exige TOTP; API Gateway valida JWT y los handlers administrativos comprueban además el grupo `Administrators`. Los roles Lambda limitan acciones DynamoDB por handler. Hay una alarma de errores 5xx de API, logging de acceso sin payloads y retención de logs por siete días.

Esto aún **no es una demo extremo a extremo en AWS**: el stack no se ha desplegado, no se ha creado una cuenta administradora inicial y React todavía no consume la API ni ofrece autenticación administrativa. El estado actual y sus límites están detallados en [la arquitectura AWS](./02-arquitectura-propuesta-aws-zero-trust.md). No afirmar que los controles fueron probados en AWS hasta desplegarlos y ejecutar pruebas autorizadas.

## 2. Justificación

- **Un solo lenguaje del equipo:** TypeScript para frontend, funciones y definición de infraestructura reduce cambios de contexto y permite compartir validaciones y tipos del contrato API cuando sea apropiado.
- **Tiempo acotado:** componentes administrados de AWS evitan implementar desde cero identidad, escalado de API y servidores permanentes. Esto no elimina la necesidad de configurar, probar y entender cada servicio.
- **Enfoque de seguridad:** Cognito proporciona autenticación; API Gateway puede validar JWT; Lambda mantiene autorización y validación de negocio del lado servidor; IAM limita el acceso entre funciones y recursos; CloudWatch permite evidenciar operación y alertas.
- **Sin cobros reales:** la lógica de donación solo persiste datos ficticios y el estado lo asigna el servidor; no existe conexión a proveedor de pagos.
- **Despliegue revisable:** CDK deja la infraestructura declarada en código para inspeccionar cambios, revisar permisos y repetir el despliegue. El equipo debe revisar la plantilla sintetizada y no aceptar ciegamente código generado.
- **Escala adecuada a una demo:** no se necesita Kubernetes, un servidor persistente, una base relacional administrada ni servicios de monitoreo externos para el alcance definido.

## 3. Flujo técnico elegido

1. CloudFront entrega por HTTPS la aplicación estática desde un bucket S3 privado con acceso restringido desde CloudFront.
2. Visitantes consultan campañas públicas mediante API Gateway; una Lambda de lectura devuelve solo campos aprobados para publicación.
3. El visitante envía campaña, monto y autorización de publicación a la ruta de simulación. La Lambda valida el cuerpo, el estado de campaña y límites de monto; descarta campos de estado enviados por el cliente.
4. El backend crea un registro de prueba y asigna `SIMULATED_SUCCESS`. La interfaz informa claramente que no hubo cargo ni recepción de dinero real.
5. El administrador se autentica con Cognito y MFA. El JWT autoriza las rutas administrativas; la Lambda verifica también permisos y estado del recurso.
6. Las funciones usan roles IAM mínimos y separados. Las acciones privilegiadas y resultados de simulación emiten logs/métricas a CloudWatch sin tokens, secretos ni payloads personales innecesarios.

## 4. Infraestructura y límites de costos

No asumir que un crédito de USD 100 está garantizado ni que cubre cualquier configuración. Confirmar el saldo, vigencia y condiciones en la cuenta educativa/console de facturación y revisar precios por región antes del despliegue.

Medidas concretas:

- Desplegar solo en la región permitida por el curso y usar datos ficticios.
- No crear NAT Gateway, clústeres, instancias EC2, WAF ni ambientes duplicados salvo requisito justificado.
- Usar DynamoDB bajo demanda para poco tráfico de demostración; elegir retención limitada para logs, por ejemplo siete días si es suficiente para la entrega.
- No registrar cada lectura pública a detalle si agregar métricas satisface la detección; sí registrar cambios administrativos y errores de autorización.
- Crear presupuesto/alerta de gasto antes del despliegue si la cuenta lo permite. Una alerta de presupuesto informa; no siempre detiene automáticamente el consumo.
- Revisar costos de CloudWatch Logs, CloudFront, API Gateway, Lambda, Cognito y almacenamiento en la región seleccionada.
- Tras la evaluación, eliminar recursos temporales mediante el stack CDK y verificar que no queden recursos facturables. Mantener el código y evidencia, no los datos de prueba en producción.

## 5. Reparto inicial entre cuatro integrantes

Una persona puede asumir coordinación e integración además de una parte técnica. El contrato de API y el modelo de datos se acuerdan primero para permitir trabajo paralelo.

| Responsable | Entrega principal | Dependencias y revisión |
|---|---|---|
| A — Infraestructura e identidad | Stack CDK, Cognito/MFA, API Gateway, IAM y despliegue base | Acordar nombres/rutas con B y variables/configuración con C. Otra persona revisa privilegios antes de desplegar. |
| B — Backend | Lambdas para campañas y donación simulada, validaciones, persistencia DynamoDB y auditoría | Definir contratos API primero; escribir pruebas de lógica y casos negativos. |
| C — Frontend | React/Vite, catálogo, formulario de donación, confirmación simulada y panel de campañas | No conectar directamente a DynamoDB ni incluir credenciales; consumir solo API. |
| D — Seguridad, calidad e integración | Pruebas de aceptación, revisión de logs/IAM, CloudWatch, evidencia y borrador del informe | No ser solo “documentador”: probar rutas de abuso y revisar el trabajo de A/B/C; apoyar integración cuando las pruebas fallen. |

## 6. Reglas de integración

- Antes de trabajar en paralelo, acordar OpenAPI o una tabla de rutas con método, autenticación, request/response, códigos de error y autorización.
- Mantener `simulation=true` y el estado simulado como datos asignados por backend, no como valores controlables por el cliente.
- Separar configuración local, pruebas y demo; no compartir credenciales personales ni guardarlas en Git.
- Revisar cambios de CDK sintetizados y políticas IAM; no desplegar plantillas con permisos amplios solo para “hacer que funcione”.
- Usar cambios pequeños, pruebas de lógica y revisión entre pares. El integrante que genera código con IA debe explicarlo y probarlo antes de integrarlo.
- Registrar en el informe qué se generó con IA, qué se modificó, qué validaciones se ejecutaron y qué limitaciones quedaron.

## 7. Riesgos y alternativas

| Riesgo | Respuesta |
|---|---|
| El curso obliga a un frontend, base de datos o herramienta de despliegue distinta | Sustituir ese componente antes de construir; preservar los límites de confianza y requisitos de seguridad. |
| Cognito MFA o despliegue de CloudFront no cabe en tiempo/cuenta del laboratorio | Acordar con el profesor una alternativa de demo, documentar exactamente qué control no se pudo probar y no afirmar cobertura inexistente. |
| El equipo no conoce CDK | Usar los primeros bloques del día 1–2 para seguir un tutorial oficial y desplegar un stack mínimo; si sigue siendo un bloqueo, evaluar AWS SAM/CloudFormation y actualizar esta decisión, no mezclar herramientas sin necesidad. |
| Créditos insuficientes o facturación difícil de controlar | Priorizar pruebas locales y despliegues breves; establecer presupuesto, alarmas y limpieza; no desplegar hasta identificar quién controla la cuenta. |
| Componentes de IA generan infraestructura/permisos incorrectos | Revisar código fuente y plantilla sintetizada, aplicar pruebas y revisión humana; nunca desplegar solo porque la generación terminó sin error. |

## 8. Decisiones inmediatas para cerrar

1. Confirmar con cada integrante que puede trabajar con TypeScript y asignar responsables.
2. Confirmar acceso autorizado a AWS, región, saldo/límites reales y quién administra la cuenta; no compartir claves en el chat ni en el repositorio.
3. Elegir los límites de monto de prueba y datos ficticios.
4. Acordar el contrato API inicial y las rutas administrativas protegidas.
5. Ejecutar una prueba pequeña de CDK y autenticación en la cuenta educativa antes de construir todo el stack.

Si no hay restricciones adicionales del curso, esta propuesta es la base seleccionada para el MVP; no implica que la arquitectura esté desplegada ni que haya sido aprobada por el profesor.
