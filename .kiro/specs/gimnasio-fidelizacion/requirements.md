# Requirements Document

## Introduction

Este documento define los requisitos para una aplicación web SaaS multi-gimnasio orientada a la fidelización de socios. La plataforma permite a dueños, administradores y recepcionistas gestionar la base de socios, registrar asistencia, administrar planes y pagos, diseñar y ejecutar campañas de fidelización (cumpleaños, recordatorios, renovaciones, promociones, referidos, encuestas NPS y programa de puntos), enviar mensajes por WhatsApp mediante la API oficial de Meta, y monitorear métricas clave como retención, riesgo de abandono, efectividad de campañas, asistencia promedio e ingresos proyectados.

La aplicación opera en modelo SaaS: cada gimnasio cliente constituye un tenant con datos aislados. El sistema debe cumplir con las normativas de protección de datos personales aplicables.

## Glossary

- **Plataforma**: La aplicación web SaaS completa que integra todos los módulos funcionales.
- **Tenant**: Instancia lógica de datos aislada perteneciente a un gimnasio cliente.
- **Gimnasio**: Organización cliente de la Plataforma que corresponde a un Tenant.
- **Dueño**: Usuario con control total sobre un Tenant, incluyendo facturación y configuración global.
- **Administrador**: Usuario con permisos de gestión operativa (socios, campañas, reportes) dentro de un Tenant, sin acceso a facturación.
- **Recepcionista**: Usuario con permisos limitados a registro de asistencia, consulta de socios y cobros, sin capacidad de crear campañas ni ver reportes financieros.
- **Socio**: Persona registrada como cliente del Gimnasio, receptor de campañas y titular de un plan.
- **Plan**: Tipo de membresía con precio, duración y características definidas.
- **Membresía**: Instancia activa o histórica de un Plan asignado a un Socio con fecha de inicio y fin.
- **Asistencia**: Registro de un ingreso del Socio al Gimnasio en una fecha y hora específicas.
- **Pago**: Registro monetario asociado a una Membresía, con estado pagado o pendiente.
- **Campaña**: Conjunto de mensajes programados dirigidos a un Segmento de Socios con un objetivo de fidelización.
- **Segmento**: Grupo de Socios filtrado por criterios definidos (por ejemplo, últimos 30 días sin asistir, cumpleañeros del mes).
- **Plantilla_WhatsApp**: Mensaje preaprobado por Meta conforme a la política de WhatsApp Business, identificado por un nombre y un idioma.
- **GestorWhatsApp**: Componente de la Plataforma responsable de enviar mensajes a través de la API oficial de WhatsApp Business (Meta Cloud API).
- **MotorCampañas**: Componente de la Plataforma que evalúa reglas de segmentación, programa envíos y ejecuta Campañas.
- **MotorRiesgo**: Componente de la Plataforma que calcula el puntaje de riesgo de abandono de cada Socio.
- **PuntajeRiesgo**: Valor numérico entre 0 y 100 que estima la probabilidad de abandono de un Socio, donde 100 representa el máximo riesgo.
- **Punto**: Unidad virtual acumulable por un Socio, canjeable por recompensas definidas por el Gimnasio.
- **Recompensa**: Beneficio configurado por el Gimnasio que puede canjearse por una cantidad de Puntos.
- **Referido**: Persona registrada como Socio que fue invitada por otro Socio existente.
- **NPS**: Net Promoter Score, indicador de satisfacción calculado a partir de encuestas con respuesta en escala 0 a 10.
- **Tasa_Retención**: Porcentaje de Socios activos al final de un periodo respecto a los activos al inicio del mismo periodo.
- **Churn**: Porcentaje de Socios que causan baja durante un periodo respecto a los activos al inicio del periodo.
- **Dashboard**: Vista consolidada que muestra indicadores clave de desempeño del Gimnasio.
- **PII**: Información personal identificable del Socio (nombre, documento, teléfono, correo, fecha de nacimiento).
- **Consentimiento_Marketing**: Autorización expresa otorgada por un Socio para recibir comunicaciones de marketing, registrada con fecha, hora y canal de captura.
- **Bandeja_Alertas**: Panel de notificaciones dentro de la Plataforma donde se registran eventos que requieren atención de Dueño o Administrador.
- **Ventana_Atribución**: Periodo configurable en días posterior al envío de una Campaña durante el cual se contabilizan las acciones objetivo de los destinatarios para calcular la tasa de conversión.
- **Opt-out**: Estado del Socio que indica su exclusión explícita de futuros envíos de Campañas automáticas de marketing.
- **Tenant_Activo**: Tenant seleccionado en la sesión autenticada de un usuario que posee acceso a uno o más Tenants, contra el cual se evalúan los permisos y se resuelven las consultas.

## Requirements

### Requirement 1: Arquitectura Multi-Tenant

**User Story:** Como Dueño de un gimnasio, quiero que mis datos estén aislados de los de otros gimnasios, para proteger la privacidad de mis socios y mi operación comercial.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ asociar cada registro de datos pertenecientes a un Gimnasio (incluyendo Socios, Planes, Membresías, Asistencias, Pagos, Segmentos, Campañas, Plantillas_WhatsApp, Mensajes, Puntos, Recompensas, Referidos, encuestas NPS y entradas del log de auditoría) a un identificador único e inmutable de Tenant asignado en el momento de su creación.
2. CUANDO un usuario autenticado solicita datos operativos, LA Plataforma DEBERÁ devolver exclusivamente los registros asociados al Tenant_Activo seleccionado en la sesión del usuario, excluyendo cualquier registro perteneciente a otros Tenants.
3. SI una operación autenticada intenta leer, crear, modificar o eliminar datos asociados a un Tenant distinto al Tenant_Activo de la sesión, ENTONCES LA Plataforma DEBERÁ rechazar la operación sin devolver ni persistir datos, responder con un error indicando acceso no autorizado y registrar el intento en el log de auditoría incluyendo usuario, Tenant_Activo, Tenant solicitado, acción intentada y marca de tiempo.
4. LA Plataforma DEBERÁ permitir que una misma dirección de correo electrónico esté asociada a uno o más Tenants con un rol independiente (Dueño, Administrador o Recepcionista) por cada Tenant, de modo que los permisos se evalúen siempre respecto al Tenant_Activo y no se hereden entre Tenants.
5. CUANDO un usuario autenticado tiene acceso a más de un Tenant, LA Plataforma DEBERÁ requerir la selección explícita de un Tenant_Activo antes de permitir el acceso a datos operativos y DEBERÁ reiniciar el contexto de la sesión al cambiar de Tenant_Activo, invalidando cualquier resultado en caché del Tenant anterior.

### Requirement 2: Autenticación y Autorización

**User Story:** Como Dueño, quiero que cada usuario acceda con sus credenciales y tenga permisos según su rol, para controlar quién puede hacer qué en la Plataforma.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ autenticar usuarios mediante correo electrónico con formato conforme a RFC 5322 y contraseña de entre 10 y 128 caracteres que contenga al menos una letra mayúscula, una letra minúscula, un dígito y un carácter no alfanumérico, almacenada mediante un algoritmo de hashing resistente a fuerza bruta (por ejemplo, bcrypt, argon2 o scrypt) con sal única por usuario.
2. LA Plataforma DEBERÁ soportar los roles Dueño, Administrador y Recepcionista, cada uno asociado a una matriz de permisos documentada y versionada consultable desde el módulo de configuración del Tenant, donde cada permiso declara de forma explícita las acciones permitidas y denegadas sobre cada módulo funcional.
3. SI un usuario con rol Recepcionista intenta acceder a los módulos de Campañas, reportes financieros o configuración del Tenant, ENTONCES LA Plataforma DEBERÁ denegar la operación sin exponer los datos solicitados, mostrar un mensaje visible que indique permiso insuficiente y registrar el intento en el log de auditoría.
4. SI un usuario falla la autenticación con credenciales inválidas 5 veces consecutivas dentro de una ventana deslizante de 15 minutos, ENTONCES LA Plataforma DEBERÁ bloquear la cuenta durante 15 minutos contados desde el último intento fallido, rechazar todo nuevo intento durante ese lapso con un mensaje que indique cuenta bloqueada temporalmente y registrar el bloqueo en el log de auditoría.
5. SI las credenciales ingresadas son inválidas y la cuenta no se encuentra bloqueada, ENTONCES LA Plataforma DEBERÁ rechazar el intento en un tiempo máximo de 2 segundos con un mensaje genérico de credenciales inválidas que no revele si el correo o la contraseña es el campo incorrecto, e incrementar el contador de intentos fallidos de esa cuenta.
6. CUANDO una sesión de usuario autenticado alcanza 60 minutos consecutivos sin actividad del lado del cliente, LA Plataforma DEBERÁ invalidar la sesión, rechazar las solicitudes posteriores asociadas a esa sesión y redirigir al usuario a la pantalla de inicio de sesión con un mensaje que indique que la sesión expiró por inactividad.
7. DONDE el Dueño del Tenant active la autenticación de dos factores, LA Plataforma DEBERÁ requerir, tras la validación exitosa de la contraseña y antes de establecer la sesión, un segundo factor de verificación basado en un código temporal de 6 dígitos con vigencia máxima de 60 segundos para cada usuario con rol Dueño o Administrador del Tenant.
8. SI un usuario falla la verificación del segundo factor 5 veces consecutivas dentro de una ventana de 15 minutos, ENTONCES LA Plataforma DEBERÁ bloquear la cuenta durante 15 minutos bajo las mismas reglas del criterio 4 y registrar el evento en el log de auditoría.

### Requirement 3: Gestión CRUD de Socios

**User Story:** Como Administrador, quiero dar de alta, editar, consultar y dar de baja Socios, para mantener actualizada la base de datos del Gimnasio.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir a los usuarios con rol Dueño o Administrador crear un Socio registrando al menos nombre (1 a 100 caracteres), apellido (1 a 100 caracteres), teléfono móvil, correo electrónico (con formato local@dominio, longitud total de 5 a 254 caracteres) y fecha de nacimiento (anterior a la fecha actual y posterior al 1 de enero de 1900).
2. SI un usuario intenta crear o editar un Socio con un teléfono móvil ya existente para otro Socio activo o inactivo del mismo Tenant, ENTONCES LA Plataforma DEBERÁ rechazar la operación, no persistir el registro y mostrar un mensaje indicando conflicto por teléfono duplicado.
3. SI el teléfono móvil ingresado no cumple el formato E.164 (signo +, código de país de 1 a 3 dígitos y número, con longitud total de dígitos entre 8 y 15), ENTONCES LA Plataforma DEBERÁ rechazar la operación y mostrar un mensaje indicando el formato de teléfono requerido.
4. LA Plataforma DEBERÁ permitir a los usuarios con rol Dueño o Administrador editar los datos de un Socio aplicando las mismas validaciones definidas para la creación en los criterios 1, 2 y 3.
5. CUANDO un usuario edita un Socio, LA Plataforma DEBERÁ registrar en el log de auditoría el identificador del Socio, el usuario que realizó el cambio, la fecha y hora en la zona horaria del Gimnasio, y la lista de campos modificados indicando valor anterior y valor nuevo.
6. CUANDO un usuario con rol Dueño o Administrador da de baja a un Socio, LA Plataforma DEBERÁ marcar al Socio como inactivo, conservar íntegro su historial de Asistencias, Membresías, Pagos y Puntos, y excluirlo de todas las Campañas cuya fecha de envío sea posterior al instante de la baja.
7. CUANDO un usuario autenticado ejecuta una búsqueda de Socios por coincidencia parcial en nombre, apellido, teléfono o documento con una consulta de al menos 2 caracteres, LA Plataforma DEBERÁ devolver los resultados pertenecientes al Tenant del usuario con un tiempo de respuesta p95 inferior a 2 segundos para Tenants con hasta 50 000 Socios.

### Requirement 4: Importación Masiva de Socios

**User Story:** Como Administrador, quiero importar Socios desde un archivo CSV o Excel, para migrar bases existentes sin carga manual.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir a los usuarios con rol Dueño o Administrador cargar archivos CSV o XLSX con codificación UTF-8 de hasta 10 MB, que incluyan al menos las columnas nombre, apellido, teléfono móvil, correo electrónico y fecha de nacimiento conforme a la plantilla descargable publicada por la Plataforma.
2. CUANDO se carga un archivo aceptado, LA Plataforma DEBERÁ validar cada fila y presentar, dentro del límite de procesamiento definido en el criterio 5, un reporte que indique el total de filas procesadas, el número de filas aceptadas, el número de filas rechazadas y el motivo de rechazo por fila con su número de fila correspondiente.
3. SI una fila carece de algún campo obligatorio (nombre, apellido, teléfono móvil, correo electrónico o fecha de nacimiento), o contiene un teléfono móvil que no cumple el formato E.164, o un teléfono móvil duplicado dentro del mismo archivo o preexistente en el Tenant, ENTONCES LA Plataforma DEBERÁ rechazar esa fila, continuar el procesamiento de las filas restantes y registrar el motivo específico de rechazo en el reporte.
4. CUANDO un usuario con rol Dueño o Administrador confirma la importación tras revisar el reporte, LA Plataforma DEBERÁ persistir únicamente las filas aceptadas asociándolas al Tenant del usuario y omitir las filas rechazadas.
5. LA Plataforma DEBERÁ procesar archivos de hasta 10 000 filas en un tiempo no superior a 5 minutos, medido desde la finalización de la carga del archivo hasta la entrega del reporte del criterio 2.
6. SI un archivo cargado supera 10 MB, tiene un formato distinto de CSV o XLSX, o carece de las columnas obligatorias definidas en la plantilla, ENTONCES LA Plataforma DEBERÁ rechazar la carga sin procesar su contenido e informar al usuario el motivo específico del rechazo.
7. SI el usuario no confirma la importación dentro de 30 minutos desde la generación del reporte o la cancela explícitamente, ENTONCES LA Plataforma DEBERÁ descartar los resultados del reporte sin persistir ningún registro.

### Requirement 5: Integración con Sistemas Externos de Gimnasio

**User Story:** Como Dueño, quiero conectar la Plataforma con mi sistema de gestión existente, para evitar mantener bases duplicadas.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ exponer una API REST autenticada mediante token por Tenant que permita crear, actualizar y consultar Socios, Asistencias, Planes, Membresías y Pagos, aplicando un límite máximo de 120 solicitudes por minuto por token y rechazando las solicitudes que lo excedan con un error indicando el límite alcanzado y el tiempo de espera sugerido antes del siguiente intento.
2. LA Plataforma DEBERÁ aceptar webhooks entrantes con firma HMAC y marca de tiempo en cada solicitud para sincronizar Asistencias y Pagos desde sistemas externos, aceptando cargas útiles de hasta 1 MB y procesando cada webhook válido en un tiempo no superior a 5 segundos.
3. SI un webhook entrante presenta una firma inválida o una marca de tiempo con desfase superior a 5 minutos respecto a la hora del servidor, ENTONCES LA Plataforma DEBERÁ rechazar la solicitud con código HTTP 401, no aplicar ningún cambio de datos y registrar el intento en el log de auditoría con fecha, hora, dirección IP de origen y motivo del rechazo.
4. LA Plataforma DEBERÁ publicar documentación de la API en formato OpenAPI 3 que incluya todos los recursos expuestos, esquemas de solicitud y respuesta, errores posibles, límites de tasa vigentes y formato de firma y encabezados esperados para los webhooks.
5. LA Plataforma DEBERÁ permitir al Dueño generar, revocar y rotar los tokens de API por Tenant, invalidando en un plazo no superior a 60 segundos cualquier solicitud realizada con un token revocado y registrando cada acción en el log de auditoría.
6. CUANDO un webhook entrante válido incluye un identificador de idempotencia ya procesado dentro de las últimas 24 horas, LA Plataforma DEBERÁ reconocer la solicitud como exitosa sin volver a aplicar los cambios ni duplicar registros.
7. SI una solicitud de la API o un webhook referencia un Socio, Plan, Membresía o Pago inexistente en el Tenant, o contiene campos obligatorios ausentes o con formato inválido, ENTONCES LA Plataforma DEBERÁ rechazar la operación con un error indicando el recurso o campo afectado, conservar los datos existentes sin modificaciones y no crear registros parciales.

### Requirement 6: Registro de Asistencia

**User Story:** Como Recepcionista, quiero registrar la entrada de cada Socio al Gimnasio, para contar con un historial de uso que alimente las métricas y las Campañas.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir a los usuarios con rol Recepcionista, Administrador o Dueño registrar una Asistencia de forma manual buscando al Socio por nombre, apellido, documento o teléfono, devolviendo los resultados de búsqueda en menos de 2 segundos para Tenants con hasta 50 000 Socios.
2. LA Plataforma DEBERÁ permitir registrar una Asistencia mediante la lectura de un código QR único asignado a cada Socio activo del Tenant.
3. CUANDO se registra una Asistencia para un Socio cuya Membresía está marcada como vencida, LA Plataforma DEBERÁ aceptar el registro y mostrar en la misma pantalla una alerta con el estado y la fecha de fin de la Membresía que permanezca visible hasta que el usuario la descarte explícitamente.
4. SI se intenta registrar una Asistencia mediante un código QR que no corresponde a un Socio del Tenant_Activo o cuya lectura resulta ilegible, ENTONCES LA Plataforma DEBERÁ rechazar el registro e informar al usuario el motivo del rechazo sin persistir la Asistencia.
5. SI se intenta registrar una Asistencia para un Socio marcado como inactivo, ENTONCES LA Plataforma DEBERÁ rechazar el registro e informar al usuario que el Socio está inactivo.
6. LA Plataforma DEBERÁ persistir cada Asistencia con fecha y hora con precisión de segundos, expresadas en la zona horaria configurada del Gimnasio, y conservar el identificador del Socio y el método de registro (manual o QR).
7. SI se intenta registrar una Asistencia para el mismo Socio dentro de una ventana de deduplicación configurable por el Dueño o Administrador del Tenant entre 1 y 240 minutos con valor por defecto de 30 minutos, ENTONCES LA Plataforma DEBERÁ rechazar el nuevo registro e informar al usuario la fecha y hora de la Asistencia previa ya registrada.

### Requirement 7: Gestión de Planes y Membresías

**User Story:** Como Administrador, quiero definir los Planes ofrecidos y asignar Membresías a los Socios, para controlar qué servicios tiene contratado cada uno.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir a los roles Dueño y Administrador crear, editar y archivar Planes con nombre (de 1 a 80 caracteres), descripción (de 0 a 500 caracteres), duración en días (número entero entre 1 y 3650), precio (número decimal no negativo entre 0,00 y 9.999.999,99) y moneda (código ISO 4217 de 3 letras).
2. CUANDO un usuario con rol Dueño o Administrador asigna una Membresía a un Socio, LA Plataforma DEBERÁ registrar la fecha de inicio indicada y calcular automáticamente la fecha de fin como la fecha de inicio más la duración en días del Plan menos un día.
3. LA Plataforma DEBERÁ considerar una Membresía en estado activa cuando la fecha actual en la zona horaria configurada del Gimnasio se encuentra entre su fecha de inicio y su fecha de fin inclusive y la Membresía no ha sido cancelada.
4. SI un usuario intenta asignar una nueva Membresía a un Socio que ya tiene una Membresía en estado activa, ENTONCES LA Plataforma DEBERÁ rechazar la asignación, mostrar un mensaje indicando el conflicto y conservar sin cambios la Membresía activa existente.
5. SI un usuario intenta asignar una Membresía utilizando un Plan en estado archivado, ENTONCES LA Plataforma DEBERÁ rechazar la operación e informar que el Plan no está disponible para nuevas Membresías.
6. CUANDO la fecha actual en la zona horaria configurada del Gimnasio supera la fecha de fin de una Membresía no cancelada, LA Plataforma DEBERÁ marcar dicha Membresía como vencida en un plazo no superior a 60 minutos.
7. LA Plataforma DEBERÁ conservar el historial completo de Membresías de cada Socio, incluyendo las Membresías vencidas y canceladas, preservando fecha de inicio, fecha de fin, Plan asociado, estado final y, cuando aplique, fecha y motivo de cancelación.

### Requirement 8: Registro de Pagos

**User Story:** Como Administrador, quiero registrar los Pagos de cada Membresía y ver las cuotas pendientes, para controlar la cobranza.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir a los roles Dueño, Administrador y Recepcionista registrar Pagos asociados a una Membresía existente del mismo Tenant, indicando monto entre 0,01 y 9 999 999,99 expresado en la misma moneda del Plan de la Membresía, fecha de Pago no posterior a la fecha actual del sistema en la zona horaria del Gimnasio, método de pago seleccionado entre efectivo, transferencia bancaria, tarjeta de débito, tarjeta de crédito y otro, y estado pagado o pendiente.
2. SI al registrar un Pago el monto está fuera del rango 0,01 a 9 999 999,99, la fecha es posterior a la fecha actual, la moneda no coincide con la del Plan de la Membresía asociada, la Membresía no pertenece al Tenant del usuario, o el método de pago no corresponde a uno de los valores admitidos, ENTONCES LA Plataforma DEBERÁ rechazar la operación sin persistir el registro y mostrar un mensaje indicando el campo inválido.
3. LA Plataforma DEBERÁ mostrar en la ficha de cada Socio el saldo pendiente acumulado expresado en la moneda del Plan, calculado como la suma de los montos de los Pagos con estado pendiente que no se encuentran anulados, y DEBERÁ actualizar dicho saldo en un plazo máximo de 5 segundos tras cada alta, edición o anulación de un Pago del Socio.
4. LA Plataforma DEBERÁ permitir únicamente a los roles Dueño y Administrador anular un Pago no anulado previamente, conservando el registro original y agregando marca de anulación, identificador del usuario que ejecuta la anulación, fecha y hora de la anulación en la zona horaria del Gimnasio, y motivo de anulación en texto de entre 5 y 500 caracteres; el Pago anulado DEBERÁ quedar excluido del cálculo del saldo pendiente y permanecer visible en el historial con su marca de anulación.
5. LA Plataforma DEBERÁ permitir a los roles Dueño y Administrador exportar a un archivo CSV el historial de Pagos del Tenant del usuario filtrado por un rango de fechas cuya amplitud sea menor o igual a 366 días, incluyendo los Pagos vigentes y los anulados identificados por su marca de anulación, y DEBERÁ generar el archivo en un tiempo máximo de 60 segundos para rangos con hasta 100 000 Pagos.

### Requirement 9: Creación y Segmentación de Campañas

**User Story:** Como Administrador, quiero crear Campañas dirigidas a Segmentos específicos de Socios, para que los mensajes lleguen a las personas correctas.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir a los roles Dueño y Administrador crear una Campaña con los siguientes datos obligatorios: nombre (entre 3 y 80 caracteres, único dentro del Tenant), objetivo (entre 1 y 500 caracteres), Segmento existente en el Tenant, Plantilla_WhatsApp aprobada por Meta, fecha y hora de inicio igual o posterior al momento de la creación, y tipo de frecuencia de envío (única, diaria, semanal o mensual) con fecha de fin opcional para las frecuencias recurrentes.
2. LA Plataforma DEBERÁ permitir definir un Segmento mediante la combinación conjuntiva (AND) de uno o más de los siguientes criterios: días sin asistir (entero entre 0 y 3650), estado de Membresía (activa, vencida, cancelada o sin Membresía), rango de edad en años (valores mínimo y máximo enteros entre 0 y 120, con mínimo menor o igual al máximo), Plan contratado (selección de uno o varios Planes existentes en el Tenant), antigüedad como Socio en días (entero entre 0 y 3650) y etiquetas personalizadas (hasta 20 etiquetas por Segmento, cada una de 1 a 40 caracteres).
3. CUANDO un usuario previsualiza un Segmento, LA Plataforma DEBERÁ mostrar, en un tiempo no superior a 5 segundos para Tenants con hasta 50 000 Socios, el número total de Socios activos del Tenant que cumplen todos los criterios y una muestra aleatoria de hasta 20 Socios que cumplen los criterios.
4. LA Plataforma DEBERÁ gestionar el ciclo de vida de una Campaña mediante los estados borrador, programada, en ejecución, pausada, cancelada y finalizada, permitiendo pausar únicamente Campañas en estado programada o en ejecución, reanudar únicamente Campañas en estado pausada, y cancelar únicamente Campañas en estado borrador, programada, en ejecución o pausada.
5. SI la Plantilla_WhatsApp asociada a una Campaña es rechazada por Meta o dada de baja, ENTONCES LA Plataforma DEBERÁ pausar automáticamente la Campaña, detener los envíos pendientes de esa Campaña y notificar al Administrador en la Bandeja_Alertas dentro de los 5 minutos siguientes a la detección del cambio de estado de la Plantilla_WhatsApp.
6. SI un usuario intenta guardar una Campaña con datos inválidos (campos obligatorios vacíos, nombre duplicado en el Tenant, fecha de inicio anterior al momento actual, Segmento inexistente o Plantilla_WhatsApp no aprobada por Meta), ENTONCES LA Plataforma DEBERÁ rechazar la operación, indicar al usuario los campos con error y no persistir la Campaña.

### Requirement 10: Campañas de Recordatorio de Asistencia

**User Story:** Como Administrador, quiero enviar recordatorios automáticos a Socios que llevan días sin venir, para reactivar su compromiso con el Gimnasio.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ ofrecer una Campaña preconfigurada que identifique Socios activos con última Asistencia registrada hace más de N días, donde N es un entero configurable por el Administrador en el rango de 1 a 365 con valor por defecto 7.
2. CUANDO un Socio activo cumple el criterio de inactividad configurado y la Campaña de recordatorio está habilitada, EL MotorCampañas DEBERÁ programar el envío del mensaje recordatorio dentro de las siguientes 24 horas contadas desde la detección del cumplimiento del criterio.
3. LA Plataforma DEBERÁ evitar enviar más de un recordatorio de la misma Campaña al mismo Socio dentro de un periodo de gracia configurable por el Administrador en el rango de 1 a 365 días, con valor por defecto 14 días.
4. SI un Socio identificado por el criterio no posee Asistencias registradas, ENTONCES LA Plataforma DEBERÁ tomar la fecha de alta del Socio como referencia para evaluar el criterio de inactividad.
5. SI un Socio está marcado como inactivo o excluido de envíos por Opt-out, ENTONCES LA Plataforma DEBERÁ excluirlo de la Campaña de recordatorio sin generar error y registrar el motivo de la exclusión en el historial del Socio.

### Requirement 11: Campañas de Cumpleaños

**User Story:** Como Administrador, quiero enviar automáticamente un saludo y un beneficio a los Socios en su cumpleaños, para fortalecer la relación emocional.

#### Acceptance Criteria

1. CUANDO la fecha actual, expresada en la zona horaria configurada del Gimnasio, coincide con el día y mes de nacimiento de un Socio activo con Consentimiento_Marketing vigente, EL MotorCampañas DEBERÁ enviar el mensaje de cumpleaños dentro de una ventana horaria configurable por el Administrador, acotada entre las 07:00 y las 22:00 hora local del Gimnasio, con duración mínima de 1 hora y máxima de 12 horas (valor por defecto de 09:00 a 12:00).
2. LA Plataforma DEBERÁ asociar al mensaje de cumpleaños un código de beneficio único por Socio y por año calendario, con una vigencia configurable por el Administrador entre 1 y 90 días desde la fecha de envío (valor por defecto 30 días).
3. SI un Socio no tiene fecha de nacimiento registrada, o está marcado como inactivo, o ha registrado Opt-out, o no cuenta con Consentimiento_Marketing vigente, ENTONCES LA Plataforma DEBERÁ excluirlo de la Campaña de cumpleaños sin interrumpir el procesamiento del resto de Socios y sin generar error.
4. SI la fecha de nacimiento registrada de un Socio corresponde al 29 de febrero y el año en curso no es bisiesto, ENTONCES EL MotorCampañas DEBERÁ programar el envío del mensaje de cumpleaños el 28 de febrero dentro de la misma ventana horaria configurada.
5. EL MotorCampañas DEBERÁ enviar a lo sumo un mensaje de cumpleaños por Socio por año calendario, incluso si la evaluación de la Campaña se ejecuta múltiples veces en un mismo día.

### Requirement 12: Campañas de Renovación de Membresía

**User Story:** Como Administrador, quiero avisar a los Socios antes y después del vencimiento de su Membresía, para maximizar las renovaciones.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir al Administrador configurar por Tenant los avisos de renovación en los momentos: 7 días antes de la fecha de fin de la Membresía, 1 día antes de la fecha de fin, el día de la fecha de fin y 3 días después de la fecha de fin, permitiendo habilitar o deshabilitar cada uno de forma independiente.
2. CUANDO un aviso de renovación habilitado alcanza su momento programado, EL MotorCampañas DEBERÁ encolar el envío del mensaje al Socio dentro de una ventana horaria configurable por el Administrador entre las 08:00 y las 21:00 en la zona horaria del Gimnasio, utilizando la Plantilla_WhatsApp asociada a través del GestorWhatsApp.
3. CUANDO un Socio registra una nueva Membresía cuya fecha de inicio es igual o posterior a la fecha de fin de su Membresía vigente, EL MotorCampañas DEBERÁ cancelar los avisos de renovación pendientes asociados a la Membresía vigente dentro de los 5 minutos siguientes al registro.
4. LA Plataforma DEBERÁ registrar en el historial del Socio el estado de envío de cada aviso de renovación con los valores pendiente, enviado o fallido, y actualizar el estado dentro de los 5 minutos siguientes a la notificación recibida del GestorWhatsApp.
5. SI un Socio se encuentra marcado como inactivo, como Opt-out o sin Consentimiento_Marketing registrado, ENTONCES LA Plataforma DEBERÁ omitir la programación y el envío de avisos de renovación para ese Socio sin generar error.

### Requirement 13: Programa de Puntos y Recompensas

**User Story:** Como Dueño, quiero que los Socios acumulen Puntos por su actividad y puedan canjearlos por Recompensas, para incentivar la fidelidad.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir al Administrador configurar reglas de acumulación de Puntos para los eventos Asistencia, Pago registrado, Referido convertido y Respuesta a encuesta, donde cada regla especifica un número entero de Puntos entre 1 y 10 000 por evento y puede habilitarse o deshabilitarse de forma independiente.
2. CUANDO ocurre un evento con su regla habilitada y queda persistido correctamente, LA Plataforma DEBERÁ sumar al Socio el número de Puntos definido por la regla dentro de un plazo máximo de 5 minutos y registrar el movimiento con fecha y hora, evento de origen, Puntos sumados y saldo resultante.
3. LA Plataforma DEBERÁ permitir definir Recompensas con nombre de 3 a 100 caracteres, costo en Puntos como entero entre 1 y 1 000 000, stock opcional como entero no negativo entre 0 y 1 000 000, fecha de inicio de vigencia y fecha de fin de vigencia, donde la fecha de fin es mayor o igual a la fecha de inicio.
4. CUANDO un Socio solicita canjear una Recompensa vigente con stock disponible (cuando aplica) y cuenta con Puntos suficientes, LA Plataforma DEBERÁ, de forma atómica, descontar los Puntos del saldo del Socio, decrementar el stock en 1 cuando aplique, generar un código de canje único de al menos 8 caracteres alfanuméricos y registrar la transacción.
5. SI el saldo de Puntos del Socio es insuficiente al momento del canje, ENTONCES LA Plataforma DEBERÁ rechazar la operación sin descontar Puntos ni stock e informar al Socio el saldo actual y la cantidad de Puntos faltante.
6. SI un Socio intenta canjear una Recompensa que no está vigente en la fecha actual, que no tiene stock disponible o que ha sido desactivada, ENTONCES LA Plataforma DEBERÁ rechazar el canje sin descontar Puntos ni stock e informar el motivo específico del rechazo.
7. CUANDO un Pago que originó una acumulación de Puntos es anulado, LA Plataforma DEBERÁ revertir los Puntos correspondientes del saldo del Socio dentro de un plazo máximo de 5 minutos y registrar un movimiento de reversión con referencia al Pago anulado.
8. LA Plataforma DEBERÁ mostrar al Administrador el historial completo de movimientos de Puntos de cada Socio indicando fecha y hora, tipo de movimiento (acumulación, canje o reversión), evento o Recompensa de origen, variación de Puntos y saldo resultante, ordenado por fecha descendente y con paginación de hasta 50 movimientos por página.

### Requirement 14: Campañas Promocionales Masivas

**User Story:** Como Administrador, quiero enviar promociones puntuales a Segmentos de Socios, para impulsar ventas de Planes, clases o eventos.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir crear Campañas promocionales de envío único programables en una fecha y hora específicas, requiriendo al menos nombre, Segmento, Plantilla_WhatsApp asociada y una fecha y hora de envío futura con al menos 10 minutos de anticipación respecto al momento de creación.
2. SI el Administrador intenta programar una Campaña promocional con fecha y hora en el pasado o con menos de 10 minutos de anticipación respecto al momento de creación, ENTONCES LA Plataforma DEBERÁ rechazar la operación, no persistir la Campaña y mostrar un mensaje de error que indique la restricción de anticipación mínima.
3. CUANDO una Campaña promocional programada alcanza su fecha y hora de envío configurada, EL MotorCampañas DEBERÁ iniciar el envío a los Socios del Segmento asociado y actualizar los contadores de avance (Socios alcanzados, pendientes y fallidos) al menos una vez cada 5 segundos hasta finalizar el envío.
4. LA Plataforma DEBERÁ permitir cancelar una Campaña promocional programada hasta 5 minutos antes de la hora de inicio configurada, cambiando su estado a cancelada y evitando cualquier envío posterior asociado a esa Campaña.
5. SI el Administrador intenta cancelar una Campaña promocional dentro de los 5 minutos previos a la hora de inicio configurada o después de haberse iniciado el envío, ENTONCES LA Plataforma DEBERÁ rechazar la cancelación, conservar el estado actual de la Campaña y mostrar un mensaje de error que indique que la Campaña ya no puede ser cancelada.

### Requirement 15: Campañas de Referidos

**User Story:** Como Dueño, quiero premiar a los Socios que traen nuevos Socios, para crecer la base por recomendación.

#### Acceptance Criteria

1. CUANDO se crea un Socio, LA Plataforma DEBERÁ generar y asociarle un código de referido único dentro del Tenant, compuesto por entre 6 y 12 caracteres alfanuméricos, y un enlace de registro que incluya dicho código como parámetro.
2. CUANDO un nuevo Socio completa su registro utilizando un código o enlace de referido perteneciente a un Socio activo del mismo Tenant distinto del nuevo Socio, LA Plataforma DEBERÁ asociar al nuevo Socio como Referido del Socio referente y marcar al nuevo Socio como Referido en su ficha.
3. SI el código o enlace utilizado en el registro es inexistente, pertenece a otro Tenant, corresponde al propio nuevo Socio o está asociado a un Socio inactivo, ENTONCES LA Plataforma DEBERÁ completar el registro del nuevo Socio sin asociación de Referido, omitir la marca de Referido e informar el motivo del rechazo al usuario.
4. CUANDO un Referido registra su primer Pago en estado pagado, LA Plataforma DEBERÁ considerar al Referido como convertido y otorgar al Socio referente la recompensa de referidos configurada por el Administrador (Puntos, descuento u otro beneficio) dentro de un plazo máximo de 5 minutos desde la confirmación del Pago.
5. SI al producirse la conversión de un Referido no existe una recompensa de referidos configurada para el Tenant, ENTONCES LA Plataforma DEBERÁ registrar la conversión sin otorgar recompensa y notificar al Administrador la ausencia de configuración en la Bandeja_Alertas.
6. LA Plataforma DEBERÁ mostrar a cada Administrador un ranking de hasta 50 Socios ordenado de forma descendente por cantidad de Referidos convertidos, filtrable por rango de fechas y con un periodo por defecto correspondiente a los últimos 90 días.

### Requirement 16: Encuestas de Satisfacción NPS

**User Story:** Como Dueño, quiero medir el NPS de mis Socios periódicamente, para detectar oportunidades de mejora.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ permitir configurar encuestas NPS con una pregunta principal obligatoria en escala entera de 0 a 10 y hasta 3 preguntas abiertas de seguimiento opcionales, cada una con respuesta de hasta 500 caracteres.
2. CUANDO se cumple la frecuencia configurada (mensual, trimestral o semestral) de una encuesta NPS activa, EL MotorCampañas DEBERÁ encolar el envío, dentro de las siguientes 24 horas, a los Socios activos del Segmento definido que cuenten con Consentimiento_Marketing vigente y que no hayan recibido una encuesta NPS en los últimos 30 días.
3. LA Plataforma DEBERÁ generar un enlace único por Socio y por envío de encuesta que admita una única respuesta y expire a los 14 días desde la fecha de envío.
4. SI un Socio accede a un enlace de encuesta expirado o previamente utilizado, ENTONCES LA Plataforma DEBERÁ rechazar el registro de la respuesta y mostrar un mensaje informativo indicando el motivo del rechazo.
5. LA Plataforma DEBERÁ calcular el NPS del Gimnasio como la diferencia entre el porcentaje de promotores (puntaje 9 o 10) y el porcentaje de detractores (puntaje 0 a 6) sobre el total de respuestas válidas, considerando válida a toda respuesta que contenga un valor entero de 0 a 10 en la pregunta principal, registrada mediante un enlace no expirado y no duplicada para el mismo Socio y envío.
6. LA Plataforma DEBERÁ presentar en el Dashboard la evolución del NPS con un punto por mes para los últimos 12 meses, indicando para cada mes el valor de NPS, el número de respuestas válidas y el número de invitaciones enviadas.

### Requirement 17: Integración con WhatsApp Business API Oficial

**User Story:** Como Dueño, quiero que los mensajes se envíen por WhatsApp de forma confiable y legal, para no arriesgar el bloqueo de mi número y cumplir con las políticas de Meta.

#### Acceptance Criteria

1. EL GestorWhatsApp DEBERÁ integrarse con la API oficial de WhatsApp Business de Meta (Cloud API) utilizando las credenciales (identificador de número de teléfono y token de acceso) configuradas por cada Tenant.
2. SI el Tenant no tiene credenciales configuradas o las credenciales son rechazadas por Meta, ENTONCES EL GestorWhatsApp DEBERÁ bloquear el envío, pausar automáticamente las Campañas que dependan del canal e informar al Dueño y al Administrador mediante una alerta visible en la Bandeja_Alertas dentro de 5 minutos desde la detección.
3. EL GestorWhatsApp DEBERÁ enviar únicamente mensajes basados en Plantillas_WhatsApp previamente aprobadas por Meta cuando el envío ocurre fuera de la ventana de 24 horas de conversación activa con el Socio.
4. CUANDO un envío a la API de Meta falla con un error clasificado como recuperable por Meta (por ejemplo, límite de tasa, error transitorio de servidor o tiempo de espera agotado), EL GestorWhatsApp DEBERÁ reintentar el envío con retroceso exponencial hasta 3 veces, con un retraso inicial de 30 segundos y un retraso máximo de 10 minutos entre reintentos, antes de marcarlo como fallido registrando el motivo reportado por Meta.
5. SI un envío a la API de Meta falla con un error clasificado como no recuperable por Meta (por ejemplo, número inválido, plantilla rechazada o destinatario bloqueado), ENTONCES EL GestorWhatsApp DEBERÁ marcar el mensaje como fallido sin reintentar y registrar el motivo reportado por Meta.
6. CUANDO LA Plataforma recibe un mensaje entrante de un Socio, LA Plataforma DEBERÁ abrir o extender una ventana de conversación activa que inicia en la marca de tiempo de dicho mensaje entrante y dura 24 horas, durante la cual el Dueño, el Administrador y el Recepcionista pueden enviar mensajes de texto libres sin usar Plantillas_WhatsApp.
7. LA Plataforma DEBERÁ ofrecer una bandeja de entrada unificada donde Dueño, Administrador y Recepcionista pueden leer respuestas de Socios y contestarlas manualmente, reflejando cada respuesta entrante en la bandeja dentro de 60 segundos desde su recepción desde Meta.
8. LA Plataforma DEBERÁ registrar para cada mensaje el estado reportado por Meta (enviado, entregado, leído, fallido) y la marca de tiempo correspondiente, actualizando el estado dentro de 60 segundos desde la recepción de la notificación de Meta.
9. SI el Socio envía una respuesta que coincide con una palabra clave de baja configurada por el Tenant (por ejemplo, BAJA o STOP) o si el Administrador marca manualmente al Socio como excluido, ENTONCES LA Plataforma DEBERÁ registrar la fecha y el origen del Opt-out, marcar al Socio como excluido de envíos de marketing y excluirlo de todas las Campañas automáticas futuras a partir de ese momento.

### Requirement 18: Dashboard y Métricas de Negocio

**User Story:** Como Dueño, quiero un Dashboard con los indicadores clave de mi Gimnasio, para tomar decisiones basadas en datos.

#### Acceptance Criteria

1. CUANDO el Dueño accede al Dashboard, LA Plataforma DEBERÁ presentar, dentro de 3 segundos desde la solicitud, los siguientes indicadores correspondientes al periodo seleccionado: cantidad de Socios activos, cantidad de nuevos Socios dados de alta en el periodo, Tasa_Retención expresada en porcentaje con 2 decimales, Churn expresado en porcentaje con 2 decimales, cantidad de Socios en riesgo de abandono, asistencia promedio por Socio expresada en visitas por semana con 1 decimal, ingresos del periodo calculados como la suma de pagos confirmados asociados a Membresías dentro del periodo, e ingresos proyectados del mes siguiente.
2. CUANDO el Dueño selecciona un filtro de rango de fechas, LA Plataforma DEBERÁ recalcular y actualizar todos los indicadores del Dashboard dentro de 3 segundos, permitiendo elegir entre los rangos preestablecidos (hoy, últimos 7 días, último mes, último trimestre, año actual) o un rango personalizado cuya duración no supere los 24 meses y cuya fecha de inicio sea anterior o igual a la fecha de fin.
3. LA Plataforma DEBERÁ calcular la Tasa_Retención como el porcentaje, con 2 decimales, de Socios activos al inicio del periodo seleccionado que permanecen activos al final del mismo periodo, y DEBERÁ reportar un valor de 0% cuando no existan Socios activos al inicio del periodo.
4. LA Plataforma DEBERÁ calcular los ingresos proyectados del siguiente mes como la suma de los montos de Membresías activas con fecha de fin posterior al mes siguiente más las renovaciones esperadas, estimadas aplicando la Tasa_Retención histórica de los últimos 6 meses cerrados a las Membresías que vencen dentro del mes siguiente; SI existe menos de 1 mes de historial cerrado, ENTONCES LA Plataforma DEBERÁ indicar que la proyección de ingresos no está disponible por falta de historial suficiente.
5. CUANDO el Dueño solicita exportar una métrica del Dashboard, LA Plataforma DEBERÁ generar un archivo en el formato elegido por el usuario (CSV o PDF) que refleje los datos del rango de fechas y filtros vigentes al momento de la solicitud, completando la descarga dentro de 10 segundos para volúmenes de hasta 100 000 registros.
6. SI LA Plataforma no puede obtener los datos necesarios para calcular uno o más indicadores del Dashboard, ENTONCES LA Plataforma DEBERÁ mostrar un mensaje de error indicando cuál indicador no pudo calcularse, mantener visibles los demás indicadores disponibles y no descartar los filtros aplicados por el Dueño.
7. SI el rango personalizado seleccionado tiene fecha de inicio posterior a la fecha de fin, excede 24 meses de duración o contiene fechas futuras a la fecha actual, ENTONCES LA Plataforma DEBERÁ rechazar la selección, mostrar un mensaje de error indicando las restricciones del rango permitido y conservar el rango previamente aplicado.

### Requirement 19: Reporte de Efectividad de Campañas

**User Story:** Como Administrador, quiero ver qué Campañas están funcionando mejor, para optimizar la estrategia de fidelización.

#### Acceptance Criteria

1. CUANDO un Administrador accede al Reporte de Efectividad de Campañas, LA Plataforma DEBERÁ mostrar, por cada Campaña del Tenant ejecutada en los últimos 365 días, las métricas mensajes enviados, mensajes entregados, mensajes leídos, respuestas recibidas y tasa de conversión, con datos actualizados con un desfase máximo de 15 minutos respecto del evento más reciente.
2. LA Plataforma DEBERÁ calcular la tasa de conversión de una Campaña como el porcentaje de destinatarios entregados que ejecutan la acción objetivo configurada (renovar Membresía, registrar Asistencia, canjear código de Recompensa o responder encuesta NPS) dentro de la Ventana_Atribución de la Campaña, expresado con 2 decimales.
3. LA Plataforma DEBERÁ permitir configurar la Ventana_Atribución de cada Campaña como un número entero de días entre 1 y 90, con valor por defecto de 7 días.
4. SI el total de destinatarios entregados de una Campaña es cero, ENTONCES LA Plataforma DEBERÁ mostrar la tasa de conversión como "N/D" y excluir esa Campaña del ordenamiento por tasa de conversión.
5. CUANDO el Administrador visualiza la comparación de efectividad entre Campañas, LA Plataforma DEBERÁ presentar los resultados en una tabla que permita ordenar ascendente y descendente por las columnas nombre de la Campaña, fecha de ejecución, mensajes enviados, mensajes entregados, mensajes leídos, respuestas recibidas y tasa de conversión.

### Requirement 20: Detección de Socios en Riesgo de Abandono

**User Story:** Como Dueño, quiero identificar proactivamente a los Socios en riesgo de darse de baja, para intervenir antes de perderlos.

#### Acceptance Criteria

1. EL MotorRiesgo DEBERÁ calcular, para cada Socio con Membresía activa, un PuntajeRiesgo entero entre 0 y 100 ponderando: días transcurridos desde la última Asistencia registrada, frecuencia de Asistencias de los últimos 30 días comparada con el promedio de Asistencias semanales de los 90 días previos, días restantes hasta el vencimiento de la Membresía vigente y cantidad de Pagos con estado pendiente asociados a esa Membresía.
2. EL MotorRiesgo DEBERÁ recalcular el PuntajeRiesgo de cada Socio con Membresía activa con una frecuencia mínima de una vez cada 24 horas.
3. LA Plataforma DEBERÁ clasificar a cada Socio con PuntajeRiesgo calculado en uno de tres niveles de riesgo utilizando el último PuntajeRiesgo disponible: bajo (0 a 39), medio (40 a 69) y alto (70 a 100).
4. LA Plataforma DEBERÁ permitir a los roles Dueño y Administrador crear Segmentos cuyo criterio de filtrado sea nivel de riesgo (bajo, medio o alto) y utilizarlos como destinatarios de Campañas de retención.
5. CUANDO un Socio transita desde un nivel de riesgo bajo o medio a un nivel de riesgo alto tras un recálculo del PuntajeRiesgo, LA Plataforma DEBERÁ registrar una alerta en la Bandeja_Alertas del Administrador dentro de los 5 minutos posteriores al recálculo.
6. SI EL MotorRiesgo no dispone de al menos 30 días de historial de Asistencia para un Socio con Membresía activa, ENTONCES LA Plataforma DEBERÁ clasificar a ese Socio en nivel de riesgo bajo e indicar en la ficha del Socio que el PuntajeRiesgo no cuenta con historial suficiente hasta acumular dicho historial.
7. SI EL MotorRiesgo falla al calcular el PuntajeRiesgo de un Socio durante el ciclo de recálculo, ENTONCES LA Plataforma DEBERÁ conservar el último PuntajeRiesgo válido del Socio, registrar el error en el log de auditoría y reintentar el cálculo en el siguiente ciclo diario.

### Requirement 21: Cumplimiento de Protección de Datos

**User Story:** Como Dueño, quiero que la Plataforma cumpla con la normativa de protección de datos personales, para evitar sanciones y generar confianza en mis Socios.

#### Acceptance Criteria

1. CUANDO un Socio otorga su consentimiento expreso para recibir comunicaciones de marketing, LA Plataforma DEBERÁ registrar el Consentimiento_Marketing asociando al identificador del Socio la fecha y hora de otorgamiento y el canal por el cual fue capturado, antes de incluir al Socio en cualquier Campaña de marketing.
2. CUANDO un Administrador procesa una solicitud de acceso a datos de un Socio, LA Plataforma DEBERÁ generar y permitir la entrega de un export en formato JSON que contenga toda la PII del Socio (nombre, documento, teléfono, correo, fecha de nacimiento) junto con sus Membresías, Pagos, Asistencias y consentimientos registrados, dentro de 30 días calendario contados desde la fecha de la solicitud.
3. SI la generación del export de datos solicitado por un Socio no puede completarse dentro de 30 días calendario, ENTONCES LA Plataforma DEBERÁ mantener la solicitud en estado pendiente y notificar al Administrador con un mensaje indicando el motivo del retraso.
4. CUANDO un Administrador procesa una solicitud de borrado de datos de un Socio, LA Plataforma DEBERÁ anonimizar, dentro de 30 días calendario contados desde la fecha de la solicitud, todos los campos de PII del Socio (nombre, documento, teléfono, correo, fecha de nacimiento) reemplazándolos por valores no identificables, y DEBERÁ conservar únicamente los datos agregados necesarios para reportes contables.
5. LA Plataforma DEBERÁ almacenar la PII de los Socios cifrada en reposo tanto en la base de datos de producción como en las copias de seguridad.
6. LA Plataforma DEBERÁ cifrar en tránsito todas las comunicaciones entre cliente y servidor mediante TLS versión 1.2 o superior, y DEBERÁ rechazar toda conexión que negocie una versión inferior.
7. LA Plataforma DEBERÁ mantener un log de auditoría inmutable de accesos y modificaciones sobre la PII, registrando para cada evento el identificador del usuario, la fecha y hora, el tipo de operación y el identificador del Socio afectado, y conservando dichos registros por al menos 12 meses.
8. SI un Socio no posee un Consentimiento_Marketing vigente registrado, ENTONCES LA Plataforma DEBERÁ excluirlo de toda Campaña cuyo objetivo sea promocional o de marketing.
9. CUANDO un Socio revoca su Consentimiento_Marketing, LA Plataforma DEBERÁ registrar la revocación con fecha y hora y excluir al Socio de toda nueva Campaña de marketing dentro de 24 horas desde la revocación.

### Requirement 22: Interfaz de Usuario Web Responsive

**User Story:** Como usuario del sistema, quiero acceder a la Plataforma desde computadora, tableta o teléfono, para operar sin depender de un dispositivo específico.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ presentar una interfaz web adaptable a anchos de pantalla desde 360 px hasta 1920 px, manteniendo accesibles todos los controles funcionales, sin desplazamiento horizontal no intencionado, sin solapamiento de elementos y sin ocultamiento de acciones primarias, tanto en orientación vertical como horizontal.
2. LA Plataforma DEBERÁ presentar todos los textos, etiquetas, mensajes de confirmación, notificaciones y avisos de error de la interfaz en idioma español por defecto.
3. LA Plataforma DEBERÁ cumplir con las pautas de accesibilidad WCAG 2.1 nivel AA en las pantallas críticas de uso diario (login, alta de Socios, registro de Asistencia, creación de Campañas y Dashboard), incluyendo navegación completa por teclado, contraste mínimo de 4.5:1 para texto normal y etiquetas accesibles en todos los campos de formulario.
4. CUANDO un usuario completa exitosamente una acción que modifica datos, LA Plataforma DEBERÁ mostrar una confirmación visible en pantalla dentro de 2 segundos desde la recepción de la respuesta del servidor y mantenerla visible durante al menos 3 segundos o hasta que el usuario la descarte.
5. SI una acción que modifica datos falla por error de validación o error del servidor, ENTONCES LA Plataforma DEBERÁ mostrar un mensaje de error visible dentro de 2 segundos desde la recepción de la respuesta, indicar el motivo del fallo y preservar los datos ingresados por el usuario en el formulario.
6. CUANDO una operación solicitada por el usuario tarda más de 1 segundo en responder, LA Plataforma DEBERÁ mostrar un indicador visual de progreso o carga hasta que la operación finalice o el servidor devuelva una respuesta.

### Requirement 23: Rendimiento y Escalabilidad

**User Story:** Como Dueño, quiero que la Plataforma responda con fluidez incluso con muchos Socios y Campañas, para que mi operación no se vea afectada.

#### Acceptance Criteria

1. CUANDO un usuario autenticado ejecuta una operación interactiva (alta de Socio, registro de Asistencia o búsqueda de Socio) sobre un Tenant con hasta 50 000 Socios activos y una carga concurrente de hasta 100 usuarios simultáneos, LA Plataforma DEBERÁ responder con un tiempo de respuesta p95 inferior a 500 ms y p99 inferior a 1 000 ms, medido en el servidor entre la recepción de la solicitud y el envío de la respuesta.
2. EL MotorCampañas DEBERÁ encolar y procesar al menos 10 000 envíos por hora por Tenant, respetando los límites de tasa publicados por la API oficial de WhatsApp Business de Meta vigente.
3. SI una solicitud de EL MotorCampañas excede el límite de tasa de la API de Meta, ENTONCES EL MotorCampañas DEBERÁ reintentar el envío aplicando una política de espera incremental hasta un máximo de 5 intentos, preservar el mensaje en la cola sin pérdida y registrar el resultado final (enviado o fallido) por cada destinatario.
4. LA Plataforma DEBERÁ mantener una disponibilidad mensual igual o superior a 99,5 % calculada como (minutos disponibles / minutos totales del mes calendario) x 100, excluyendo ventanas de mantenimiento programadas de hasta 4 horas acumuladas por mes que hayan sido notificadas al Dueño con al menos 48 horas de anticipación.
5. SI la carga de un Tenant supera los 50 000 Socios activos o los 100 usuarios concurrentes, ENTONCES LA Plataforma DEBERÁ continuar atendiendo las operaciones interactivas con un tiempo de respuesta p95 inferior a 1 500 ms, preservar la consistencia de datos entre Tenants y notificar al Dueño mediante una alerta en la Bandeja_Alertas indicando que se ha alcanzado el umbral de capacidad contratada.

### Requirement 24: Registro de Auditoría

**User Story:** Como Dueño, quiero saber quién hizo qué y cuándo en la Plataforma, para trazabilidad y control.

#### Acceptance Criteria

1. LA Plataforma DEBERÁ registrar en el log de auditoría, como mínimo, los siguientes eventos: intentos de autenticación exitosos y fallidos, creación, modificación y baja de Socios, envío de Campañas, canjes de Recompensas y accesos a reportes financieros.
2. CADA entrada del log de auditoría DEBERÁ incluir: identificador del usuario que originó la acción, identificador del Tenant, tipo de acción, entidad afectada con su identificador, fecha y hora del evento en formato UTC con precisión de segundos, y dirección IP de origen.
3. LA Plataforma DEBERÁ conservar las entradas del log de auditoría durante al menos 12 meses desde la fecha del evento, manteniéndolas inmutables sin permitir edición ni eliminación durante ese periodo.
4. CUANDO un Dueño solicita consultar el log de auditoría de su Tenant, LA Plataforma DEBERÁ permitir filtrar los resultados por rango de fechas, identificador de usuario y tipo de acción, devolviendo resultados paginados con un máximo de 100 entradas por página en un tiempo de respuesta no mayor a 5 segundos.
5. SI un usuario con rol Administrador o Recepcionista intenta consultar, modificar o eliminar entradas del log de auditoría, ENTONCES LA Plataforma DEBERÁ denegar la operación, mostrar un mensaje de permiso insuficiente y registrar el intento como una nueva entrada del log de auditoría.
6. SI falla el registro de una entrada del log de auditoría, ENTONCES LA Plataforma DEBERÁ reintentar la escritura hasta 3 veces con un intervalo máximo de 2 segundos entre intentos y, si persiste la falla, notificar al Dueño mediante una alerta visible en la Bandeja_Alertas.
