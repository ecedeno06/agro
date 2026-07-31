# Implementación de identidad firmada para `SUPERADMIN`

## 1. Objetivo

Proteger el rol `SUPERADMIN` para que ningún usuario pueda obtener acceso total únicamente modificando la tabla `usuario_rol`.

La autorización final debe cumplir todas estas condiciones:

```text
SUPERADMIN efectivo =
usuario autenticado
+ rol SUPERADMIN asignado
+ identidad especial registrada
+ firma digital válida
```

Un registro en `usuario_rol` por sí solo **no debe conceder acceso de superadministrador**.

---

## 2. Stack considerado

- PostgreSQL
- Node.js con ES Modules (`import`)
- Driver `pg`
- TypeScript
- Criptografía Ed25519 mediante `node:crypto`
- Angular 18 standalone
- Angular Signals
- JWT o sesión para autenticación
- Argon2 o bcrypt para contraseñas

---

## 3. Estructura actual

### Tabla `usuarios`

```text
id_usuario
usuario
password_hash
activo
...
```

### Tabla `catalogo_rol`

```text
id_rol
codigo_rol
descripcion
...
```

### Tabla `usuario_rol`

```text
id_usuario
id_rol
```

El rol protegido vive en `catalogo_rol`:

```text
codigo_rol = SUPERADMIN
```

---

## 4. Regla principal

No autorizar así:

```ts
const esSuperadmin = roles.includes('SUPERADMIN');
```

Autorizar así:

```ts
const esSuperadmin =
  roles.includes('SUPERADMIN') &&
  await superadminService.esSuperadmin(idUsuarioAutenticado);
```

Debe usarse `&&`, nunca `||`.

---

# Parte I: PostgreSQL

## 5. Verificar duplicados en `usuario_rol`

```sql
SELECT
    id_usuario,
    id_rol,
    COUNT(*)
FROM usuario_rol
GROUP BY id_usuario, id_rol
HAVING COUNT(*) > 1;
```

Corrige los duplicados antes de continuar.

## 6. Crear restricción única

```sql
ALTER TABLE usuario_rol
ADD CONSTRAINT uq_usuario_rol
UNIQUE (id_usuario, id_rol);
```

## 7. Crear esquema de seguridad

```sql
CREATE SCHEMA IF NOT EXISTS security;
```

## 8. Crear tabla de identidad firmada

> Cambia `BIGINT` por `INTEGER` si tus IDs actuales son `INTEGER`.

```sql
CREATE TABLE security.superadmin_identidad (
    slot SMALLINT PRIMARY KEY
        DEFAULT 1
        CHECK (slot = 1),

    id_usuario BIGINT NOT NULL,

    id_rol BIGINT NOT NULL,

    security_id UUID NOT NULL UNIQUE,

    firma BYTEA NOT NULL,

    version_firma SMALLINT NOT NULL DEFAULT 1,

    ambiente VARCHAR(30) NOT NULL DEFAULT 'production',

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_superadmin_usuario_rol
        FOREIGN KEY (id_usuario, id_rol)
        REFERENCES usuario_rol(id_usuario, id_rol)
        ON DELETE RESTRICT
);
```

### Por qué existe `slot`

```sql
slot SMALLINT PRIMARY KEY CHECK (slot = 1)
```

Solo puede existir una fila porque todos los registros tendrían que usar `slot = 1`, pero la clave primaria no permite duplicados.

## 9. Permisos recomendados

La cuenta normal del backend debe poder leer la tabla, pero no modificarla.

```sql
REVOKE ALL
ON security.superadmin_identidad
FROM PUBLIC;

GRANT USAGE
ON SCHEMA security
TO app_runtime;

GRANT SELECT
ON security.superadmin_identidad
TO app_runtime;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON security.superadmin_identidad
FROM app_runtime;
```

Crear una cuenta administrativa separada:

```sql
CREATE ROLE security_provisioner
LOGIN PASSWORD 'CAMBIAR_ESTA_CONTRASEÑA';
```

Permisos mínimos:

```sql
GRANT USAGE
ON SCHEMA security
TO security_provisioner;

GRANT SELECT, INSERT, UPDATE, DELETE
ON security.superadmin_identidad
TO security_provisioner;

GRANT SELECT
ON usuarios, catalogo_rol, usuario_rol
TO security_provisioner;

GRANT INSERT
ON usuario_rol
TO security_provisioner;
```

La contraseña real no debe guardarse en una migración ni subirse a Git.

---

# Parte II: Firma digital

## 10. Qué se firma

La firma debe cubrir únicamente datos estables:

```text
type=SUPERADMIN_IDENTITY
version=1
environment=production
user_id=25
role_id=1
security_id=550e8400-e29b-41d4-a716-446655440000
authority=SUPERADMIN
```

No incluir:

```text
contraseña
password_hash
nombre
correo
último inicio de sesión
```

La contraseña puede cambiar sin generar una firma nueva.

## 11. Claves Ed25519

```text
Clave privada
- Crea firmas.
- Debe permanecer fuera del backend público.
- Solo se usa para crear o reemplazar al SUPERADMIN.

Clave pública
- Verifica firmas.
- Vive en el backend.
- No puede crear firmas nuevas.
```

Arquitectura:

```text
Backend principal
├── clave pública
├── puede verificar
└── no puede firmar

Proceso administrativo
├── clave privada cifrada
├── contraseña de la clave
├── credencial especial PostgreSQL
└── puede aprovisionar al SUPERADMIN

Angular
└── no recibe ninguna clave
```

---

# Parte III: Backend Node.js

## 12. Dependencias

```bash
npm install pg argon2 jsonwebtoken dotenv
npm install -D typescript tsx @types/node @types/pg @types/jsonwebtoken
```

## 13. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": [
    "src/**/*.ts",
    "scripts/**/*.ts"
  ]
}
```

## 14. `package.json`

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/src/server.js",
    "generate:superadmin-keys": "tsx scripts/generate-superadmin-keys.ts",
    "provision:superadmin": "tsx scripts/provision-superadmin.ts"
  }
}
```

Con `NodeNext`, usa extensión `.js` en imports internos:

```ts
import { construirSuperadminPayload } from './superadmin-payload.js';
```

## 15. Variables de entorno del backend

```env
DATABASE_URL=postgresql://app_runtime:CAMBIAR@localhost:5432/mi_base
APP_ENVIRONMENT=production
SUPERADMIN_PUBLIC_KEY_PATH=/ruta/segura/superadmin-public.pem

JWT_SECRET=CAMBIAR_POR_UN_SECRETO_LARGO
JWT_EXPIRES_IN=15m
```

No colocar en el backend normal:

```env
SUPERADMIN_PRIVATE_KEY_PATH=
SUPERADMIN_PRIVATE_KEY_PASSPHRASE=
```

Agregar a `.gitignore`:

```gitignore
.env
.env.*
!.env.example

secrets/
*.pem
```

## 16. Estructura sugerida

```text
src/
├── config/
│   ├── database.ts
│   └── security.ts
├── auth/
│   ├── auth.service.ts
│   ├── auth.middleware.ts
│   └── token.service.ts
├── users/
│   ├── usuario.repository.ts
│   └── rol.repository.ts
├── security/
│   ├── superadmin-payload.ts
│   ├── superadmin.repository.ts
│   ├── superadmin.service.ts
│   └── require-superadmin.middleware.ts
└── server.ts

scripts/
├── generate-superadmin-keys.ts
└── provision-superadmin.ts
```

## 17. Conexión PostgreSQL

`src/config/database.ts`

```ts
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Falta DATABASE_URL');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

pool.on('error', error => {
  console.error('Error inesperado en PostgreSQL', error);
});
```

## 18. Construir el contenido firmado

`src/security/superadmin-payload.ts`

```ts
export interface SuperadminPayload {
  idUsuario: number;
  idRol: number;
  securityId: string;
  ambiente: string;
  versionFirma: number;
}

export function construirSuperadminPayload(
  datos: SuperadminPayload
): Buffer {
  if (
    !Number.isSafeInteger(datos.idUsuario) ||
    datos.idUsuario <= 0
  ) {
    throw new Error('idUsuario inválido');
  }

  if (
    !Number.isSafeInteger(datos.idRol) ||
    datos.idRol <= 0
  ) {
    throw new Error('idRol inválido');
  }

  if (
    !Number.isSafeInteger(datos.versionFirma) ||
    datos.versionFirma <= 0
  ) {
    throw new Error('versionFirma inválida');
  }

  if (!datos.securityId) {
    throw new Error('securityId inválido');
  }

  if (!datos.ambiente) {
    throw new Error('ambiente inválido');
  }

  const contenido = [
    'type=SUPERADMIN_IDENTITY',
    `version=${datos.versionFirma}`,
    `environment=${datos.ambiente}`,
    `user_id=${datos.idUsuario}`,
    `role_id=${datos.idRol}`,
    `security_id=${datos.securityId}`,
    'authority=SUPERADMIN'
  ].join('\n');

  return Buffer.from(contenido, 'utf8');
}
```

La misma función debe usarse al firmar y verificar.

## 19. Repositorio de identidad

`src/security/superadmin.repository.ts`

```ts
import type { Pool } from 'pg';

export interface SuperadminIdentityRow {
  id_usuario: string;
  id_rol: string;
  security_id: string;
  firma: Buffer;
  version_firma: number;
  ambiente: string;
  codigo_rol: string;
}

export class SuperadminRepository {
  constructor(private readonly pool: Pool) {}

  async buscarPorUsuario(
    idUsuario: number
  ): Promise<SuperadminIdentityRow | null> {
    const result = await this.pool.query<SuperadminIdentityRow>(
      `
        SELECT
          sai.id_usuario,
          sai.id_rol,
          sai.security_id,
          sai.firma,
          sai.version_firma,
          sai.ambiente,
          cr.codigo_rol
        FROM security.superadmin_identidad sai

        INNER JOIN usuario_rol ur
          ON ur.id_usuario = sai.id_usuario
         AND ur.id_rol = sai.id_rol

        INNER JOIN catalogo_rol cr
          ON cr.id_rol = sai.id_rol

        WHERE sai.slot = 1
          AND sai.id_usuario = $1
          AND cr.codigo_rol = 'SUPERADMIN'
        LIMIT 1
      `,
      [idUsuario]
    );

    return result.rows[0] ?? null;
  }
}
```

## 20. Servicio de verificación

`src/security/superadmin.service.ts`

```ts
import {
  createPublicKey,
  verify,
  type KeyObject
} from 'node:crypto';

import { readFileSync } from 'node:fs';

import {
  construirSuperadminPayload
} from './superadmin-payload.js';

import {
  SuperadminRepository
} from './superadmin.repository.js';

export class SuperadminService {
  private readonly publicKey: KeyObject;

  constructor(
    private readonly repository: SuperadminRepository,
    private readonly ambiente: string,
    publicKeyPath: string
  ) {
    const publicKeyPem = readFileSync(
      publicKeyPath,
      'utf8'
    );

    this.publicKey = createPublicKey(publicKeyPem);
  }

  async esSuperadmin(
    idUsuarioAutenticado: number
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(idUsuarioAutenticado) ||
      idUsuarioAutenticado <= 0
    ) {
      return false;
    }

    const registro =
      await this.repository.buscarPorUsuario(
        idUsuarioAutenticado
      );

    if (!registro) {
      return false;
    }

    const idUsuarioRegistro =
      Number(registro.id_usuario);

    const idRolRegistro =
      Number(registro.id_rol);

    if (
      idUsuarioRegistro !== idUsuarioAutenticado ||
      registro.codigo_rol !== 'SUPERADMIN' ||
      registro.ambiente !== this.ambiente
    ) {
      return false;
    }

    const payload = construirSuperadminPayload({
      idUsuario: idUsuarioRegistro,
      idRol: idRolRegistro,
      securityId: registro.security_id,
      ambiente: registro.ambiente,
      versionFirma: registro.version_firma
    });

    try {
      return verify(
        null,
        payload,
        this.publicKey,
        registro.firma
      );
    } catch (error) {
      console.error(
        'Error verificando firma SUPERADMIN',
        error
      );

      return false;
    }
  }
}
```

## 21. Inicialización

`src/config/security.ts`

```ts
import { pool } from './database.js';

import {
  SuperadminRepository
} from '../security/superadmin.repository.js';

import {
  SuperadminService
} from '../security/superadmin.service.js';

const publicKeyPath =
  process.env.SUPERADMIN_PUBLIC_KEY_PATH;

const environment =
  process.env.APP_ENVIRONMENT ?? 'development';

if (!publicKeyPath) {
  throw new Error(
    'Falta SUPERADMIN_PUBLIC_KEY_PATH'
  );
}

export const superadminRepository =
  new SuperadminRepository(pool);

export const superadminService =
  new SuperadminService(
    superadminRepository,
    environment,
    publicKeyPath
  );
```

---

# Parte IV: Login

## 22. Flujo correcto

Todos los usuarios usan la misma pantalla y el mismo endpoint.

```text
1. Buscar siempre en usuarios.
2. Verificar contraseña.
3. Consultar roles.
4. Si tiene SUPERADMIN, verificar identidad firmada.
5. Crear sesión o JWT.
```

No buscar primero en la tabla de superadministrador.

## 23. Consulta del usuario

```sql
SELECT
    id_usuario,
    usuario,
    password_hash,
    activo
FROM usuarios
WHERE usuario = $1
LIMIT 1;
```

## 24. Consulta de roles

```sql
SELECT
    cr.id_rol,
    cr.codigo_rol
FROM usuario_rol ur

INNER JOIN catalogo_rol cr
    ON cr.id_rol = ur.id_rol

WHERE ur.id_usuario = $1;
```

## 25. Servicio de login

```ts
export interface LoginResponse {
  accessToken: string;

  usuario: {
    idUsuario: number;
    nombreUsuario: string;
    roles: string[];
    isSuperadmin: boolean;
  };
}

export async function login(
  nombreUsuario: string,
  password: string
): Promise<LoginResponse> {
  const usuario =
    await usuarioRepository.buscarPorNombre(
      nombreUsuario
    );

  if (!usuario || !usuario.activo) {
    throw new Error(
      'Usuario o contraseña incorrectos'
    );
  }

  const passwordValida =
    await passwordService.verificar(
      password,
      usuario.passwordHash
    );

  if (!passwordValida) {
    throw new Error(
      'Usuario o contraseña incorrectos'
    );
  }

  const roles =
    await rolRepository.buscarPorUsuario(
      usuario.idUsuario
    );

  const tieneRolSuperadmin =
    roles.includes('SUPERADMIN');

  const firmaValida =
    tieneRolSuperadmin
      ? await superadminService.esSuperadmin(
          usuario.idUsuario
        )
      : false;

  const isSuperadmin =
    tieneRolSuperadmin &&
    firmaValida;

  if (
    tieneRolSuperadmin &&
    !firmaValida
  ) {
    await auditoriaRepository.registrar({
      idUsuario: usuario.idUsuario,
      evento: 'SUPERADMIN_CON_FIRMA_INVALIDA',
      descripcion:
        'Tiene el rol SUPERADMIN sin identidad firmada válida'
    });
  }

  const rolesEfectivos = roles.filter(
    rol => rol !== 'SUPERADMIN'
  );

  if (isSuperadmin) {
    rolesEfectivos.push('SUPERADMIN');
  }

  const accessToken =
    await tokenService.generar({
      sub: usuario.idUsuario,
      isSuperadmin
    });

  return {
    accessToken,

    usuario: {
      idUsuario: usuario.idUsuario,
      nombreUsuario: usuario.nombreUsuario,
      roles: rolesEfectivos,
      isSuperadmin
    }
  };
}
```

### Política recomendada

En producción, si alguien tiene `SUPERADMIN` pero la firma no es válida:

```text
registrar auditoría
bloquear privilegio
opcionalmente bloquear el login
notificar al administrador
```

---

# Parte V: Middleware para operaciones críticas

## 26. Middleware

`src/security/require-superadmin.middleware.ts`

```ts
import type {
  NextFunction,
  Request,
  Response
} from 'express';

import {
  superadminService
} from '../config/security.js';

interface AuthenticatedRequest extends Request {
  user?: {
    idUsuario: number;
  };
}

export async function requireSuperadmin(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idUsuario =
      Number(request.user?.idUsuario);

    if (
      !Number.isSafeInteger(idUsuario) ||
      idUsuario <= 0
    ) {
      response.status(401).json({
        message: 'Usuario no autenticado'
      });

      return;
    }

    const autorizado =
      await superadminService.esSuperadmin(
        idUsuario
      );

    if (!autorizado) {
      response.status(403).json({
        message:
          'Se requiere una identidad SUPERADMIN válida'
      });

      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
```

Uso:

```ts
router.delete(
  '/administracion/empresa/:id',
  authenticateJwt,
  requireSuperadmin,
  eliminarEmpresaController
);
```

El ID debe salir del JWT o sesión validada:

```ts
const idUsuario = request.user.idUsuario;
```

Nunca de:

```ts
request.body.idUsuario
request.query.idUsuario
request.params.idUsuario
```

---

# Parte VI: Generación de claves

## 27. Script de generación

`scripts/generate-superadmin-keys.ts`

```ts
import {
  generateKeyPairSync
} from 'node:crypto';

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';

const outputDirectory =
  process.env.SUPERADMIN_KEYS_DIRECTORY ??
  './secrets';

const passphrase =
  process.env.SUPERADMIN_PRIVATE_KEY_PASSPHRASE;

if (!passphrase) {
  throw new Error(
    'Falta SUPERADMIN_PRIVATE_KEY_PASSPHRASE'
  );
}

mkdirSync(outputDirectory, {
  recursive: true,
  mode: 0o700
});

const {
  publicKey,
  privateKey
} = generateKeyPairSync(
  'ed25519',
  {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },

    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase
    }
  }
);

writeFileSync(
  `${outputDirectory}/superadmin-public.pem`,
  publicKey,
  {
    encoding: 'utf8',
    mode: 0o644
  }
);

writeFileSync(
  `${outputDirectory}/superadmin-private.pem`,
  privateKey,
  {
    encoding: 'utf8',
    mode: 0o600
  }
);

console.log('Claves generadas correctamente.');
console.log(
  'No copies la clave privada al backend público.'
);
```

Ejecución:

```bash
SUPERADMIN_PRIVATE_KEY_PASSPHRASE="frase-muy-larga" \
npm run generate:superadmin-keys
```

---

# Parte VII: Aprovisionamiento del SUPERADMIN

## 28. Script administrativo

`scripts/provision-superadmin.ts`

```ts
import {
  createPrivateKey,
  randomUUID,
  sign
} from 'node:crypto';

import {
  readFileSync
} from 'node:fs';

import {
  Pool
} from 'pg';

import {
  construirSuperadminPayload
} from '../src/security/superadmin-payload.js';

async function main(): Promise<void> {
  const idUsuario = Number(process.argv[2]);

  if (
    !Number.isSafeInteger(idUsuario) ||
    idUsuario <= 0
  ) {
    throw new Error(
      'Uso: npm run provision:superadmin -- <idUsuario>'
    );
  }

  const databaseUrl =
    process.env.SECURITY_DATABASE_URL;

  const privateKeyPath =
    process.env.SUPERADMIN_PRIVATE_KEY_PATH;

  const passphrase =
    process.env.SUPERADMIN_PRIVATE_KEY_PASSPHRASE;

  const ambiente =
    process.env.APP_ENVIRONMENT ?? 'production';

  if (!databaseUrl) {
    throw new Error(
      'Falta SECURITY_DATABASE_URL'
    );
  }

  if (!privateKeyPath) {
    throw new Error(
      'Falta SUPERADMIN_PRIVATE_KEY_PATH'
    );
  }

  if (!passphrase) {
    throw new Error(
      'Falta SUPERADMIN_PRIVATE_KEY_PASSPHRASE'
    );
  }

  const privateKeyPem = readFileSync(
    privateKeyPath,
    'utf8'
  );

  const privateKey = createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    passphrase
  });

  const pool = new Pool({
    connectionString: databaseUrl
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const usuarioResult =
      await client.query<{
        id_usuario: string;
      }>(
        `
          SELECT id_usuario
          FROM usuarios
          WHERE id_usuario = $1
          FOR UPDATE
        `,
        [idUsuario]
      );

    if (usuarioResult.rowCount !== 1) {
      throw new Error('El usuario no existe');
    }

    const rolResult =
      await client.query<{
        id_rol: string;
      }>(
        `
          SELECT id_rol
          FROM catalogo_rol
          WHERE codigo_rol = 'SUPERADMIN'
          LIMIT 1
        `
      );

    if (rolResult.rowCount !== 1) {
      throw new Error(
        'No existe el rol SUPERADMIN'
      );
    }

    const idRol = Number(
      rolResult.rows[0].id_rol
    );

    await client.query(
      `
        INSERT INTO usuario_rol (
          id_usuario,
          id_rol
        )
        VALUES ($1, $2)

        ON CONFLICT (
          id_usuario,
          id_rol
        )
        DO NOTHING
      `,
      [
        idUsuario,
        idRol
      ]
    );

    const securityId = randomUUID();
    const versionFirma = 1;

    const payload = construirSuperadminPayload({
      idUsuario,
      idRol,
      securityId,
      ambiente,
      versionFirma
    });

    const firma = sign(
      null,
      payload,
      privateKey
    );

    await client.query(
      `
        INSERT INTO security.superadmin_identidad (
          slot,
          id_usuario,
          id_rol,
          security_id,
          firma,
          version_firma,
          ambiente
        )
        VALUES (
          1,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )

        ON CONFLICT (slot)
        DO UPDATE SET
          id_usuario = EXCLUDED.id_usuario,
          id_rol = EXCLUDED.id_rol,
          security_id = EXCLUDED.security_id,
          firma = EXCLUDED.firma,
          version_firma = EXCLUDED.version_firma,
          ambiente = EXCLUDED.ambiente,
          actualizado_en = NOW()
      `,
      [
        idUsuario,
        idRol,
        securityId,
        firma,
        versionFirma,
        ambiente
      ]
    );

    await client.query('COMMIT');

    console.log(
      `Usuario ${idUsuario} firmado como SUPERADMIN`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

Ejecución:

```bash
SECURITY_DATABASE_URL="postgresql://security_provisioner:..." \
SUPERADMIN_PRIVATE_KEY_PATH="/ruta/superadmin-private.pem" \
SUPERADMIN_PRIVATE_KEY_PASSPHRASE="frase-muy-larga" \
APP_ENVIRONMENT="production" \
npm run provision:superadmin -- 25
```

La clave privada solo se usa cuando:

- Se crea inicialmente el SUPERADMIN.
- Se reemplaza al SUPERADMIN.
- Se rotan las claves.
- Cambia un dato incluido en la firma.

No se usa para:

- Registrar usuarios normales.
- Iniciar sesión.
- Cambiar contraseña.
- Actualizar nombre o correo.
- Ejecutar peticiones normales.

---

# Parte VIII: Angular 18 standalone con Signals

## 29. Modelos

```ts
export interface AuthenticatedUser {
  idUsuario: number;
  nombreUsuario: string;
  roles: string[];
  isSuperadmin: boolean;
}

export interface LoginResponse {
  accessToken: string;
  usuario: AuthenticatedUser;
}
```

## 30. Store con Signals

`src/app/auth/auth.store.ts`

```ts
import {
  computed,
  Injectable,
  signal
} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private readonly usuarioSignal =
    signal<AuthenticatedUser | null>(null);

  readonly usuario =
    this.usuarioSignal.asReadonly();

  readonly autenticado = computed(
    () => this.usuarioSignal() !== null
  );

  readonly isSuperadmin = computed(
    () =>
      this.usuarioSignal()?.isSuperadmin === true
  );

  readonly roles = computed(
    () => this.usuarioSignal()?.roles ?? []
  );

  readonly idUsuario = computed(
    () =>
      this.usuarioSignal()?.idUsuario ?? null
  );

  establecerUsuario(
    usuario: AuthenticatedUser
  ): void {
    this.usuarioSignal.set(usuario);
  }

  cerrarSesion(): void {
    this.usuarioSignal.set(null);
  }
}
```

## 31. Servicio de autenticación

```ts
import {
  inject,
  Injectable
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  tap
} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http =
    inject(HttpClient);

  private readonly authStore =
    inject(AuthStore);

  login(
    usuario: string,
    password: string
  ) {
    return this.http
      .post<LoginResponse>(
        '/api/auth/login',
        {
          usuario,
          password
        }
      )
      .pipe(
        tap(response => {
          this.authStore.establecerUsuario(
            response.usuario
          );
        })
      );
  }

  logout(): void {
    this.authStore.cerrarSesion();
  }
}
```

## 32. Guard funcional

```ts
import {
  inject
} from '@angular/core';

import {
  CanActivateFn,
  Router
} from '@angular/router';

import {
  AuthStore
} from './auth.store';

export const superadminGuard: CanActivateFn =
  () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    if (authStore.isSuperadmin()) {
      return true;
    }

    return router.createUrlTree([
      '/sin-autorizacion'
    ]);
  };
```

## 33. Ruta standalone

```ts
import {
  Routes
} from '@angular/router';

import {
  superadminGuard
} from './auth/superadmin.guard';

export const routes: Routes = [
  {
    path: 'superadmin',
    canActivate: [
      superadminGuard
    ],
    loadComponent: () =>
      import(
        './superadmin/superadmin.component'
      ).then(
        module =>
          module.SuperadminComponent
      )
  }
];
```

## 34. Menú con Signal

Componente:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  inject
} from '@angular/core';

import {
  RouterLink
} from '@angular/router';

import {
  AuthStore
} from '../auth/auth.store';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: './menu.component.html',
  changeDetection:
    ChangeDetectionStrategy.OnPush
})
export class MenuComponent {
  readonly authStore =
    inject(AuthStore);
}
```

Plantilla:

```html
@if (authStore.isSuperadmin()) {
  <a routerLink="/superadmin">
    Administración total
  </a>
}
```

Angular solo controla la interfaz. El backend sigue siendo la autoridad real.

## 35. Restaurar sesión

Al recargar Angular, el Signal vuelve a `null`.

Flujo recomendado:

```text
1. Guardar sesión o token en cookie HttpOnly.
2. Al iniciar Angular, llamar GET /api/auth/me.
3. El backend valida nuevamente al usuario.
4. Angular actualiza el Signal.
```

Ejemplo de respuesta:

```json
{
  "idUsuario": 25,
  "nombreUsuario": "administrador",
  "roles": [
    "ADMIN",
    "SUPERADMIN"
  ],
  "isSuperadmin": true
}
```

---

# Parte IX: Auditoría

## 36. Tabla sugerida

```sql
CREATE TABLE security.auditoria_seguridad (
    id BIGSERIAL PRIMARY KEY,

    id_usuario BIGINT,

    evento VARCHAR(100) NOT NULL,

    descripcion TEXT,

    ip INET,

    user_agent TEXT,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Eventos recomendados:

```text
SUPERADMIN_CON_FIRMA_INVALIDA
INTENTO_ACCESO_SUPERADMIN
CAMBIO_SUPERADMIN
ROTACION_CLAVES
CAMBIO_CONTRASEÑA_SUPERADMIN
LOGIN_SUPERADMIN
LOGOUT_SUPERADMIN
```

No registrar:

- Contraseñas.
- Claves privadas.
- Frases de contraseña.
- JWT completos.
- Secretos de configuración.

---

# Parte X: Pruebas

## 37. Pruebas mínimas

```text
Firma válida con datos originales → true
ID de usuario modificado → false
ID de rol modificado → false
security_id modificado → false
ambiente modificado → false
versión modificada → false
firma copiada a otra identidad → false
firma vacía o corrupta → false
```

Ejemplo:

```ts
import {
  generateKeyPairSync,
  sign,
  verify
} from 'node:crypto';

import {
  construirSuperadminPayload
} from './superadmin-payload.js';

const {
  publicKey,
  privateKey
} = generateKeyPairSync('ed25519');

const payloadOriginal =
  construirSuperadminPayload({
    idUsuario: 1,
    idRol: 10,
    securityId:
      '550e8400-e29b-41d4-a716-446655440000',
    ambiente: 'test',
    versionFirma: 1
  });

const firma = sign(
  null,
  payloadOriginal,
  privateKey
);

console.assert(
  verify(
    null,
    payloadOriginal,
    publicKey,
    firma
  ) === true
);

const payloadManipulado =
  construirSuperadminPayload({
    idUsuario: 2,
    idRol: 10,
    securityId:
      '550e8400-e29b-41d4-a716-446655440000',
    ambiente: 'test',
    versionFirma: 1
  });

console.assert(
  verify(
    null,
    payloadManipulado,
    publicKey,
    firma
  ) === false
);
```

## 38. Casos de integración

### Usuario normal

```text
POST /auth/login
→ 200
→ isSuperadmin = false
```

### SUPERADMIN legítimo

```text
POST /auth/login
→ 200
→ isSuperadmin = true
```

### Rol agregado manualmente

```text
Agregar SUPERADMIN en usuario_rol
sin identidad firmada
→ isSuperadmin = false o login bloqueado
```

### Firma copiada

```text
Copiar firma a otro ID
→ verificación false
```

### Endpoint crítico

```text
Usuario normal
DELETE /administracion/...
→ 403
```

### JWT manipulado

```text
JWT dice isSuperadmin=true
pero identidad no es válida
→ middleware verifica nuevamente
→ 403
```

---

# Parte XI: Orden de implementación

## 39. Etapa 1: base de datos

- [ ] Verificar tipos reales de IDs.
- [ ] Eliminar duplicados de `usuario_rol`.
- [ ] Crear `uq_usuario_rol`.
- [ ] Crear esquema `security`.
- [ ] Crear `superadmin_identidad`.
- [ ] Configurar permisos.
- [ ] Crear `security_provisioner`.

## 40. Etapa 2: criptografía

- [ ] Crear `superadmin-payload.ts`.
- [ ] Crear script de generación de claves.
- [ ] Generar claves en entorno seguro.
- [ ] Copiar solo la clave pública al backend.
- [ ] Guardar la privada cifrada fuera del backend.

## 41. Etapa 3: backend

- [ ] Crear repositorio.
- [ ] Crear servicio de verificación.
- [ ] Integrarlo al login.
- [ ] Filtrar rol SUPERADMIN no firmado.
- [ ] Crear middleware para rutas críticas.
- [ ] Crear auditoría.
- [ ] Implementar `/api/auth/me`.

## 42. Etapa 4: aprovisionamiento

- [ ] Crear script `provision-superadmin.ts`.
- [ ] Firmar al primer SUPERADMIN.
- [ ] Verificar que solo exista una fila.
- [ ] Probar reemplazo controlado.

## 43. Etapa 5: Angular

- [ ] Crear interfaces.
- [ ] Crear `AuthStore` con Signals.
- [ ] Crear servicio de login.
- [ ] Crear guard funcional.
- [ ] Ocultar menús con `@if`.
- [ ] Restaurar sesión con `/api/auth/me`.

## 44. Etapa 6: pruebas de manipulación

- [ ] Agregar manualmente el rol a otro usuario.
- [ ] Copiar la firma.
- [ ] Cambiar `id_usuario`.
- [ ] Cambiar `security_id`.
- [ ] Cambiar `id_rol`.
- [ ] Eliminar el registro.
- [ ] Confirmar que ningún caso concede privilegios.

---

# Parte XII: Reglas obligatorias

1. El rol `SUPERADMIN` por sí solo no concede acceso.
2. La clave privada nunca vive en Angular.
3. La clave privada no vive en el backend público.
4. La clave privada no se guarda en PostgreSQL.
5. La clave pública sí puede vivir en el backend.
6. Los endpoints críticos verifican nuevamente la firma.
7. El ID se obtiene del JWT o sesión validada.
8. Angular solo controla visibilidad y navegación.
9. La contraseña no forma parte de la firma.
10. Solo el proceso administrativo crea o reemplaza la identidad.
11. La cuenta normal de PostgreSQL no modifica la tabla especial.
12. Toda anomalía se registra en auditoría.

---

# Flujo final

```text
Usuario inicia sesión
        ↓
Backend busca en usuarios
        ↓
Verifica contraseña
        ↓
Consulta usuario_rol + catalogo_rol
        ↓
¿Tiene SUPERADMIN?
        ↓
No ───────────────→ roles normales
        ↓ Sí
Consulta superadmin_identidad
        ↓
Reconstruye payload
        ↓
Verifica con clave pública
        ↓
¿Firma válida?
   ↓ Sí          ↓ No
SUPERADMIN       retirar privilegio
efectivo         registrar auditoría
```

Condición definitiva:

```ts
const isSuperadmin =
  usuarioAutenticado &&
  tieneRolSuperadmin &&
  tieneRegistroEspecial &&
  firmaDigitalValida;
```

Con este diseño, modificar `usuario_rol`, copiar una firma o alterar el registro especial no es suficiente para obtener acceso total.
