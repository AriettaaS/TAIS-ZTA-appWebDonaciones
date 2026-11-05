# Alcance inicial y obligaciones a validar en Perú

**Estado:** borrador de descubrimiento para proyecto académico  
**Fecha de revisión:** 5 de noviembre de 2026  
**Propósito:** registrar decisiones de producto y orientar el análisis legal y de seguridad del MVP. No constituye asesoría legal ni reemplaza la revisión de un abogado peruano.

## 0. Contexto del encargo académico

- El proyecto es un MVP universitario con un plazo aproximado de diez días para demostrar una plataforma segura de donaciones monetarias en línea para proyectos sociales de la comunidad.
- El MVP simulará el registro y el estado de las donaciones. No se conectará a una pasarela, no cobrará ni moverá dinero real y no recibirá datos de tarjetas.
- AWS es la plataforma objetivo. El profesor mencionó Amazon Cognito, AWS Lambda y Amazon CloudWatch como servicios candidatos; el archivo de diseño tecnológico y la rúbrica del curso deben revisarse antes de cerrar la arquitectura.
- Los componentes generados con asistencia de IA deben declararse en el informe y el equipo debe explicar y evaluar lo que incorpora.
- La demostración académica no equivale a autorización para operar una plataforma real.
- Zero Trust se aplicará de forma proporcional: verificar identidad y permisos en cada solicitud protegida, no confiar por ubicación de red, y usar monitoreo basado en eventos/métricas. No se asumirá que sondear o revalidar constantemente a cada usuario es necesario ni gratuito; el diseño debe explicar costos, latencia y ruido operativo.

## 1. Decisiones acordadas

- El servicio permitirá realizar donaciones desde una aplicación web en Perú.
- El donante podrá indicar un monto libre y donar más de una vez.
- En el MVP, los pagos y sus estados serán simulados de forma explícita. No se integrará proveedor de pago ni se procesará dinero real.
- “Anónima” significa que el nombre del donante no se publica. La simulación no implica anonimato de los registros internos.
- La publicación del nombre y del monto individual será una opción voluntaria y desactivada por defecto. Ambos datos solo se mostrarán si el donante autoriza expresamente esa publicación.
- El administrador podrá crear, editar y archivar campañas. Archivar será la opción normal de cierre; eliminar físicamente una campaña requerirá una política de retención y no deberá borrar la trazabilidad financiera.
- El acceso administrativo tendrá controles reforzados: MFA, permisos mínimos, autorización comprobada en cada operación y registro de acciones relevantes.
- El contexto del caso es Perú. No se seleccionará proveedor de pagos para el MVP porque no se integrará ninguno.
- En el MVP, solo se admitirán asociaciones o fundaciones sin fines de lucro formalmente constituidas en Perú como beneficiarias. Las personas naturales y otras categorías quedan fuera del alcance inicial.
- El modelo conceptual de largo plazo considera a la organización beneficiaria como receptora; la plataforma no debe custodiar ni redistribuir fondos. Este flujo no se implementa ni se valida financieramente en el MVP simulado.

## 2. Alcance y límites por definir

La simulación sirve para demostrar flujos, autorización y auditoría; no demuestra que un cobro real haya ocurrido, que exista liquidación a la beneficiaria ni que el sistema esté listo para producción. La interfaz y los datos de prueba deben identificar claramente los pagos simulados para evitar confusión.

La limitación inicial a organizaciones formalmente constituidas reduce la variación de casos, pero no implica que todas tengan la misma condición tributaria ni que puedan emitir constancias deducibles.

También quedan por definir:

- Qué documentos y fuentes oficiales se usarían en una futura operación real para validar existencia legal, RUC, representantes autorizados y titularidad de la cuenta receptora.
- Si la elegibilidad exigirá alguna calificación o registro tributario adicional para campañas que anuncien beneficios fiscales; no anunciar deducibilidad antes de validarlo.
- La forma jurídica y el RUC de la entidad operadora y de cada beneficiaria.
- Cómo se verifica y documenta la relación entre cada campaña y su organización beneficiaria.
- Para una futura integración real: proveedor, onboarding y liquidación directa a cada beneficiaria, quién aparece como comercio ante el donante y qué datos requeriría el checkout.
- Qué datos de donantes de prueba conservará el MVP y por cuánto tiempo.
- Si se permitirán donaciones recurrentes automáticas, además de donaciones repetidas iniciadas por el usuario.
- Para una operación real: cómo se atenderían consultas, reclamos, reembolsos, contracargos y solicitudes de derechos de datos; qué regiones y subencargados procesarían información.

## 3. Obligaciones a revisar antes de una operación real

Los puntos siguientes son una lista inicial de asuntos para asesoría profesional si el proyecto evoluciona a una plataforma real. No implican que el prototipo académico cobre, que ya cumpla obligaciones de operación ni que todas las reglas sean aplicables sin analizar el modelo concreto.

| Tema | Relevancia potencial en producción | Trabajo requerido antes de operar |
|---|---|---|
| Datos personales | La Ley 29733 y su nuevo reglamento, aprobado por el D.S. 016-2024-JUS y publicado el 30 de noviembre de 2024, son el marco principal a considerar. El nuevo reglamento entró en vigor el 30 de marzo de 2025. Nombre, correo, identificadores de transacción y datos de actividad pueden identificar al donante; no publicar el nombre no convierte el tratamiento interno en anónimo. | Determinar responsable y encargados; documentar finalidades y base legal; mostrar información de privacidad antes de recopilar datos; habilitar los derechos que correspondan; reducir datos; fijar retención y eliminación; revisar contratos, transferencias internacionales y medidas de seguridad. Verificar las obligaciones vigentes de inscripción de bancos de datos y de notificación de incidentes con la ANPD y asesoría local. |
| Publicación opcional del nombre | Publicar el nombre es distinto de procesar la donación y puede exponer al donante. | Obtener una elección afirmativa separada, explicar exactamente qué se publicará y permitir cambiar la preferencia. No publicar por defecto nombres, correos, montos ni mensajes. |
| Protección al consumidor y contratación digital | El prototipo no ejecuta una transacción real. Si se opera públicamente, la clasificación de la relación puede variar según la entidad que cobra, el servicio ofrecido y el flujo de fondos. | Antes de operar, revisar la aplicación de la Ley 29571, sus modificaciones y las reglas digitales vigentes; evaluar información previa al pago, identidad del proveedor/beneficiario, destino de fondos, cargos, atención de reclamos y Libro de Reclamaciones cuando corresponda. |
| Impuestos y constancias de donación | El prototipo no acredita una donación a efectos tributarios. En producción, el tratamiento dependería de la condición y calificación concreta de cada entidad. | Antes de operar, revisar con contador/abogado peruano si una beneficiaria puede emitir constancias y bajo qué requisitos. No prometer deducibilidad fiscal por el solo hecho de donar en la plataforma. |
| Pagos y alcance PCI | No aplica al MVP simulado mientras no se procesen pagos ni datos de tarjetas. Sería relevante si se integra un proveedor real. | Si se evoluciona a producción, comparar proveedores disponibles en Perú, confirmar términos, reembolsos, contracargos y alcance PCI con el proveedor y asesoría especializada. |
| Seguridad y Zero Trust | La autenticación, las decisiones de autorización, las modificaciones de campañas y los cambios de estado simulados siguen siendo relevantes para la demostración. | Implementar identidad verificada, autorización por solicitud, privilegio mínimo y auditoría. En producción, integrar señales operativas, respuesta a incidentes y los controles adicionales que exija el flujo real de fondos. |

### Fuentes primarias consultadas

- [Autoridad Nacional de Protección de Datos Personales (ANPD)](https://www.gob.pe/anpd): portal oficial y acceso a sus temas de bancos de datos y derechos ARCO.
- [ANPD: reglamentos aprobados por Decreto Supremo](https://www.gob.pe/institucion/anpd/normas-legales/tipos/9-decreto-supremo): incluye el Reglamento de la Ley 29733 publicado el 30 de noviembre de 2024.
- [Ley N.° 29733, Ley de Protección de Datos Personales](https://www.leyes.congreso.gob.pe/Documentos/Leyes/29733.pdf): texto de la ley en el archivo legislativo del Congreso. Debe revisarse junto con su reglamentación vigente y modificatorias.
- [Código de Protección y Defensa del Consumidor, Ley N.° 29571](https://www.leyes.congreso.gob.pe/Documentos/Leyes/29571.pdf): texto base del Código; verificar sus modificaciones vigentes y la aplicación al modelo concreto.
- [SUNAT: Donación como gasto deducible](https://orientacion.sunat.gob.pe/01-donacion-como-gasto-deducible): explica que la deducción está condicionada, entre otros requisitos, a la naturaleza y calificación de la entidad receptora.
- [SUNAT: cartilla informativa sobre tratamiento tributario de donaciones](https://www.gob.pe/institucion/sunat/informes-publicaciones/390459-regimen-tributario-de-donaciones-cartilla-informativa): material de orientación tributaria publicado por SUNAT.

### Límites de esta identificación

Esta es una identificación inicial, no una opinión legal exhaustiva. Su aplicabilidad depende de la entidad operadora, de quién recibe y controla el dinero, de las condiciones de cada campaña y del proveedor elegido. Antes de aceptar pagos reales se debe solicitar una revisión profesional peruana de privacidad, consumo, tributación y pagos, y confirmar el texto normativo vigente a la fecha de lanzamiento.

## 4. Requisitos iniciales derivados para el MVP académico

- No solicitar ni almacenar datos de tarjeta ni conectarse a una pasarela.
- Identificar claramente todo pago como simulado en la interfaz, el modelo de datos y los informes.
- No representar un estado simulado como confirmación de dinero recibido o liquidado.
- Separar los datos privados de la donación de los campos autorizados para publicación.
- Registrar la entidad receptora y el destino declarado de cada campaña.
- Mantener estados de campaña y donación auditables; archivar campañas sin borrar transacciones.
- Documentar categorías de datos, propósitos, responsables/encargados, ubicaciones y plazos de conservación antes de construir el esquema de base de datos.
- Usar datos ficticios en la demostración; no habilitar cobros reales.
- Marcar beneficiarios y campañas de prueba como ficticios; no afirmar que una organización real fue validada.
- Documentar los componentes generados con asistencia de IA, qué se aceptó o modificó y cómo el equipo verificó su funcionamiento y sus implicaciones.

## 5. Próximo paso

Como por ahora solo existe la instrucción verbal, usar la arquitectura AWS de [02-arquitectura-propuesta-aws-zero-trust.md](./02-arquitectura-propuesta-aws-zero-trust.md) como hipótesis de trabajo, no como requisito confirmado. El equipo puede contrastar las decisiones con el ingeniero cuando tenga oportunidad; si no recibe más especificaciones, avanzar con las decisiones explícitamente marcadas como propuestas y mantener la operación real fuera del MVP.
