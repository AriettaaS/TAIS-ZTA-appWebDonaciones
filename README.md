# TAIS Donaciones Seguras

MVP académico para demostrar un flujo de donación monetaria simulada y controles Zero Trust sobre AWS. No procesa pagos, no mueve dinero y no debe recibir datos de tarjetas.

## Estructura

- `apps/web`: interfaz React + TypeScript + Vite.
- `infrastructure`: infraestructura AWS con CDK y TypeScript.
- `documentacion`: alcance, requisitos, arquitectura, amenazas y decisiones del stack.

## Comandos

Desde la raíz del repositorio:

```powershell
npm run dev
npm run build
npm run test
npm run lint
```

`npm run build` compila el frontend y verifica tipos/compilación de la infraestructura. `npm run test` ejecuta pruebas de CDK/backend.

El despliegue AWS no es parte de la configuración local inicial. No ejecutar `cdk deploy` sin autorización explícita para usar la cuenta, región y presupuesto del equipo.

## Estado actual

Existe una interfaz local de demostración y un primer stack CDK con Cognito, API Gateway, Lambdas, DynamoDB, S3/CloudFront y CloudWatch. La interfaz todavía no consume la API AWS ni implementa el inicio de sesión administrativo; por tanto, el flujo visual local no demuestra los controles del backend.

La API definida incluye `GET /campaigns` y `POST /donations` públicos, además de rutas administrativas protegidas con JWT para listar, crear, editar y archivar campañas. Las donaciones son siempre ficticias. Los handlers tienen validación de entradas, registro idempotente y permisos IAM separados por operación.

Para sintetizar y revisar la infraestructura sin desplegar:

```powershell
npm --prefix infrastructure run cdk -- synth
```

No ejecutar `cdk deploy` sin autorización explícita y revisión del equipo. Las tablas DynamoDB y el User Pool se retienen al eliminar el stack; la infraestructura de datos retenida puede seguir generando costos. El bucket de archivos web se elimina junto con sus objetos. Revisar la plantilla sintetizada, los costos regionales y los límites de la cuenta antes de cualquier despliegue. No compartir credenciales AWS en el chat ni guardarlas en Git.
