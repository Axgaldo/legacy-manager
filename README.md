# Legacy Manager

> Gestión privada del patrimonio familiar: inmuebles, alquileres, inquilinos, contratos y bienes.

[![Build](https://img.shields.io/github/actions/workflow/status/Axgaldo/legacy-manager/deploy.yml?branch=main&label=build)](https://github.com/Axgaldo/legacy-manager/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/github/package-json/v/Axgaldo/legacy-manager?label=versión)](https://github.com/Axgaldo/legacy-manager/blob/main/package.json)
[![License](https://img.shields.io/github/license/Axgaldo/legacy-manager?label=licencia)](https://github.com/Axgaldo/legacy-manager/blob/main/LICENSE)

Aplicación web **privada** para llevar el inventario patrimonial de una familia. Corre en GitHub Pages sobre Firebase (Authentication, Firestore y Cloud Storage) dentro de los límites **sin coste** del plan Spark. Incluye **búsqueda global** (Ctrl+K), **modo incógnito** que oculta los importes y **copias de seguridad** descargables.

## Módulos

### 🏛 Panel de inicio
La portada `/` resume todo el patrimonio: **avisos** de contratos que vencen y revisiones de renta (60 días o atrasadas), calendario del mes con cobros registrados y gastos sin pagar, anotaciones de alquileres, gastos y atrasos, gráfica de cobros vs gastos del año y los últimos bienes añadidos. Desde el panel se descargan la **copia de seguridad completa (JSON)** y los **exportables CSV** (resumen fiscal anual e inventario de bienes).

### 🏠 Inmuebles
- **Propiedades**: fichas con dirección, referencia catastral, inquilinos vinculados, fianza y valor estimado.
- **Alquileres**: control mensual de cobros por inmueble y año, con estados automáticos (cobrado, parcial, atraso, exceso), colores manuales y cambios de renta con histórico.
- **Gastos**: vista transversal con calendario por mes y filtro de tipo (todos, solo periódicos o solo puntuales) y facturas.
- **Fiscal**: resumen IRPF de alquileres en la sección general (`/inmuebles/fiscal`): filtros por propietario, provincia y año; ingresos íntegros, gastos deducibles (puntuales y periódicos), rendimiento neto con reducción del 50% y CSV descargable.
- **Inquilinos**: directorio independiente con documentos (DNI, contratos, nóminas…) y vinculación bidireccional con inmuebles.
- **Contratos y adendas**: PDF hasta 100 MiB por versión, en Firebase Cloud Storage; activar/deshactivar contratos sin perder el archivo. Los PDFs nunca se sobrescriben y se pueden borrar con la papelera (30 días).
- **Evolución anual**: pestaña por inmueble con ingresos cobrados vs gastos de los últimos 5 ejercicios, neto y valor actual, además de un **PDF resumen** imprimible para el gestor.

### 🪙 Bienes y Activos
- Portada con las colecciones: **Todos**, Numismática, Arte y cuadros, Relojes, Electrónica y electrodomésticos y Objetos diversos.
- Vista de **filas** (por defecto) o **cuadrícula** con foto grande; agrupación y orden configurables, filtros por propietario, material, estado, época y etiquetas.
- **Ficha flotante** al pulsar cualquier bien: todos sus datos e imágenes, navegación anterior/siguiente, impresión, editar/borrar (con doble confirmación) y URL propia para compartir.
- **Numismática** con formulario específico de monedas y medallas (ceca, ensayador, peso, catálogo, divisas originales convertidas a euros…).
- Listas imprimibles en blanco y negro y vistas filtradas compartibles por URL.

### 🙈 Modo incógnito
Un interruptor en la barra lateral oculta **todas las cifras de dinero** de la app (rentas, gastos, valoraciones, totales…) sustituyéndolas por caracteres especiales aleatorios, al estilo de las apps de banca. El resto de la app sigue funcionando con normalidad; la preferencia se recuerda entre sesiones.

### Papelera
Inmuebles, bienes, contratos, inquilinos y sus documentos no se borran al instante: se guardan **30 días** en `/papelera` y se pueden restaurar. La purga definitiva se hace desde la app (al abrir la papelera o con «Eliminar ya» / «Vaciar papelera»), sin Cloud Functions. Al purgar un inmueble se borran también sus gastos, cobros, contratos, adendas y PDFs.

### PWA y sin conexión
La app se puede instalar desde el navegador (manifest + service worker). El *shell* y los archivos estáticos quedan cacheados y Firestore usa caché persistente, así que la segunda apertura es instantánea y se puede consultar con mala cobertura; los cambios hechos sin red se sincronizan al volver la conexión.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS |
| Router | React Router (rutas por pestaña, fichas con slug) |
| Backend | Firebase Authentication (Google) · Firestore · Cloud Storage |
| Despliegue | GitHub Actions → GitHub Pages |

## Empezar

Requisitos: Node 20+ y un proyecto de Firebase.

```bash
git clone https://github.com/Axgaldo/legacy-manager.git
cd legacy-manager
npm install
cp .env.example .env.local   # y rellena los valores de tu proyecto Firebase
npm run dev                  # http://localhost:5173
```

Scripts: `npm run dev` (desarrollo) · `npm run build` (TypeScript + build de producción) · `npm run preview` · `npm run lint`.

Las variables `VITE_FIREBASE_*` se configuran también como **secretos del repositorio** para el despliegue (ver abajo).

## Autorización de usuarios

El acceso se concede solo a usuarios de una lista de permitidos gestionada en Firestore:

1. El usuario inicia sesión una vez con Google para que Firebase Authentication cree su cuenta.
2. En Firebase Console → **Firestore Database → Data**, crea un documento en la colección `authorizedUsers` con el **UID de autenticación** como ID y `enabled: true`.
3. Las reglas deniegan crear/editar/borrar esos documentos desde el cliente, así que la lista se administra solo desde la consola. Para revocar el acceso, pon `enabled: false` o borra el documento.

## Reglas de Firebase (Firestore y Storage)

El workflow de GitHub Pages despliega **solo el frontend**; las reglas **nunca** se publican solas. Cuando cambien `firestore.rules` o `storage.rules`, publícalas en Firebase Console o con la CLI de Firebase.

- **Firestore**: una regla wildcard `/{collection}/{document=**}` cubre todas las colecciones de la app (`properties`, `assets`, `tenants`, `tenantDocuments`…). Las colecciones nuevas no necesitan cambios.
- **Storage**: cada ruta necesita su propio bloque `match`. El origen de la verdad es [`storage.rules`](storage.rules):

| Ruta | Uso | Máx. | Contenido permitido | Borrar |
|---|---|---|---|---|
| `contracts/{propertyId}/{fileName}` | PDF de contratos/adendas | 100 MiB | PDF | Sí (nunca se sobrescribe) |
| `assets/{assetId}/{fileName}` | Fotos de bienes | 2 MiB | webp, jpeg, png | Sí |
| `tenants/{tenantId}/{fileName}` | Documentos de inquilinos | 25 MiB | PDF, imágenes, Word/Excel/ODT, TXT, ZIP/RAR | Sí |

Los PDFs de contratos **nunca se sobrescriben** (`update: false`), pero sí se pueden borrar: la app los guarda 30 días en la papelera antes de purgarlos, y solo al vaciar un inmueble o un contrato. Sin el bloque `tenants/`, subir cualquier documento de inquilino falla con `storage/unauthorized`. El bloque actual está en `storage.rules`; la validación cliente equivalente vive en `src/features/tenants/tenantsService.ts` y `src/lib/storageFiles.ts` (mantenlas sincronizadas con los límites).

### Publicación de reglas y CORS

```bash
firebase login
firebase use <project>
firebase deploy --only firestore:rules,storage
```

O pega el contenido de cada `.rules` en Firebase Console → Firestore/Storage → Reglas → **Publicar**.

La configuración CORS de Storage está en [`storage.cors.json`](storage.cors.json) (GitHub Pages, `localhost:5173` y `127.0.0.1:5173`) y se aplica con:

```bash
gsutil cors set storage.cors.json gs://<bucket>
```

## Despliegue (GitHub Pages)

1. Configura Pages en el repositorio con la opción **GitHub Actions**.
2. Añade los secretos `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID`.
3. Cada push a `main` ejecuta [`deploy.yml`](.github/workflows/deploy.yml): `npm ci` → `npm run build` → publica `dist/`.

## Estructura del proyecto

```
src/
├── components/            # Layout (barra lateral) y UI compartida
├── features/
│   ├── auth/              # Login con Google y ruta privada
│   ├── collections/       # Bienes: colecciones, listas, fichas, formulario
│   ├── privacy/           # Modo incógnito y formato central de importes
│   ├── properties/        # Inmuebles: fichas, alquileres, gastos, contratos
│   └── tenants/           # Inquilinos y sus documentos
├── hooks/ lib/ utils/     # Firebase, Storage y utilidades (slugs, compresión…)
└── types/                 # Modelos compartidos de Firestore
```

El contexto del proyecto para agentes de IA (convenciones, reglas de negocio y registro de versiones) está en [`AGENTS.md`](AGENTS.md).

## Versionado

[SemVer](https://semver.org/lang/es/) en `package.json`; la versión, el commit y la fecha de build se inyectan automáticamente en `vite.config.ts` y se muestran en la barra lateral — no se escriben a mano en componentes. `npm version minor --no-git-tag-version` en el mismo commit del cambio (`patch` para correcciones, `minor` para funciones, `major` si rompe algo).

## Licencia

MIT — ver [`LICENSE`](LICENSE). Copyright (c) 2026 **[Axgaldo](https://github.com/Axgaldo)**.
