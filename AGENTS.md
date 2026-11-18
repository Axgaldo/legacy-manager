# Legacy Manager - Project Context

## Project Overview
- **Description:** Web application for heritage management (Gestión de Patrimonio).
- **Repository:** https://github.com/Axgaldo/legacy-manager/
- **Main Objective:** Manage assets, properties, and legal contracts (contracts/addenda).

## Tech Stack
- **Frontend:** React, Vite, TypeScript, Tailwind CSS.
- **Backend/Infra:** Firebase (Authentication, Firestore, Cloud Storage).
- **State Management & Data Fetching:** Standard React hooks, Firebase SDK.

## Directory Structure & Features
- src/features/auth: Authentication logic (login, private routes).
- src/features/collections: Management of assets (photos, tags, categories).
- src/features/properties: Property management, rent rates, expenses.
- src/features/properties/contracts: Contract management, PDF handling, and addenda.
- src/features/tenants: Independent tenant directory, documents and property links.
- src/lib: Firebase initialization and storage utilities.
- src/utils: Helper functions (compression, slug generation, etc.).

## Key Business Rules & Constraints
- **PDF Handling:** 
    - Storage: Firebase Cloud Storage.
    - Max Size: 100MB.
    - Logic: Direct upload (no fragmentation/splitting).
- **Image Handling:**
    - Storage: Firebase Cloud Storage.
    - Max Size: 2MB.
    - Format: Auto-compressed to WebP or JPEG before upload.
- **CORS & Permissions:** Configured for https://axgaldo.github.io, http://localhost:5173, and http://127.0.0.1:5173.
- **Firebase Rules (important):**
    - The GitHub Pages workflow deploys only the frontend. `firestore.rules` and `storage.rules` are **never** deployed automatically.
    - Firestore: a single wildcard rule (`/{collection}/{document=**}`) covers all app collections, so new collections such as `tenants` and `tenantDocuments` need no rule change.
    - Storage: each path needs its own explicit `match` block. Current paths: `contracts/{propertyId}` (PDF ≤ 100 MiB), `assets/{assetId}` (webp/jpeg/png ≤ 2 MiB), `tenants/{tenantId}` (PDF, images, Word/Excel/ODT, TXT, ZIP/RAR ≤ 25 MiB).
    - `storage.rules` is the source of truth; after editing it, publish it in Firebase Console → Storage → Rules (or `firebase deploy --only storage`). Without the `tenants/` block, tenant uploads fail with `storage/unauthorized`.
    - Full rules table, copy-paste block and publishing steps: README → "Firebase rules (Firestore and Storage)".

## Assets Module (Bienes)
- **Entry Point:** Landing page with 3 cards (Numismática, Arte, Objetos).
- **Numismática:** Monedas **y medallas** de todas las épocas. Rows view (not cards) with a tiny thumbnail on the right. The form uses a **Moneda / Medalla** selector at the top:
    - **Moneda:** dedicated numismática form. Fields: denomination, inventory_number, catalog_reference, material, conservationState, era, creation_year_range, empire_reign, ruler, country, mint (ciudad/taller), mint_mark (marca de ceca/ensayador), manufacturing_place (legacy), weight_grams, diameter_mm, obverse_info, reverse_info, value, market_value, value_source, purchase_price, purchase_price_original, purchase_currency, acquisition_source, purchase_year, reference_book, reference_book_value, reference_book_value_original, reference_book_currency, case_location, case_number, added_date. Years are stored as signed numbers (negative = a.C.) plus `creation_year_range` for intervals; the form toggles between concrete year and range with d.C./a.C. selects and auto-fills era and ruler (Roman Empire / Spain) from the year.
    - **Medalla:** simplified form with motive, year, material, size (free text), conservation, country, inventory number, catalog code, weight, obverse, reverse, original purchase price + currency, acquisition operation/source, purchase year and location. Stored in the same `assets` collection with `numismatica_type: 'medalla'`; fields: `medal_motive`, `medal_size_mm` (text: `60`, `50x30`, `varios tamaños`…), `acquisition_operation`, `acquisition_source`, `medal_location`, reusing `obverse_info`, `reverse_info`, `material`, `conservationState`, `country`, `purchase_price`, `purchase_price_original`, `purchase_currency`, `year`. The name is auto-generated as `Medalla de <motivo>` (editable via `medal_name_override`).
    - **País y ceca:** `country` es el país o territorio de emisión (se puede inferir del título del documento o de la cabecera); `mint` es la ciudad o taller y `mint_mark` la marca de ceca/ensayador. Son campos distintos para no perder información.
    - **Divisas:** `purchase_price_original` + `purchase_currency` and `reference_book_value_original` + `reference_book_currency` keep the original amount; the euro fields (`purchase_price`, `reference_book_value`) are auto-converted and remain editable. Peseta (166,386) and French franc (6,55957) use fixed rates; CHF/USD/GBP use editable approximate defaults.
    - **Etiquetas en numismática:** defects, rarities, variants and sets use tags/comments (e.g. `RARA`, `AGUJERO`, `CANTO ESTRIADO`, `CONJUNTO`) instead of dedicated fields.
    - Documents without `numismatica_type` are treated as `moneda`; legacy `medals`/`medallas` categories normalize to `numismatica` and infer `medalla`. The list shows 🪙/🏅, the catalog code next to the name, and the filter row has a **Tipo** selector (todo / monedas / medallas).
    - **Lista y ficha:** agrupación por defecto por contenedor y orden por número del archivador, con selectores de agrupar/ordenar; cada fila muestra dos líneas (datos + anverso, reverso, notas y etiquetas) y el estado de conservación va coloreado. Al pulsar una pieza se abre una ficha flotante con todos los datos e imágenes, botones de editar/borrar y URL propia `/bienes/categoria/:coleccion/:slug` para compartirla.
- **Relojes:** no dedicated form; the generic asset form plus photos is enough.
- **Common fields:** name, owner, category, tags, description, brandOrAuthor, year, historicalEra, country, placeOfOrigin, ruler, mint, mint_mark, denomination, conservationState, material, acquisitionYear, acquisitionPrice, currentValue, notes, photos, photoSizesBytes. `location` was removed; coin location is `case_location`/`case_number` in advanced details.

## Migration Status
- **Cleaned:** Legacy migration buttons and functions have been removed from the UI and services.
- **Legacy categories:** Old Firestore categories (`coins`, `banknotes`, `art`, `watches`, etc.) are normalized on read to the current Spanish categories. No manual data migration is required.
- **Completed:** Numismática module with all fields (denomination, inventory_number, catalog_reference, material, conservationState, era, creation_year_range, empire_reign, ruler, country, mint, mint_mark, manufacturing_place, weight_grams, diameter_mm, obverse_info, reverse_info, value, market_value, value_source, purchase_price, purchase_price_original, purchase_currency, acquisition_source, purchase_year, reference_book, reference_book_value, reference_book_value_original, reference_book_currency, case_location, case_number, added_date). `coin_type` and generic `location` were removed.

## Importación de datos (retirada)
- La pantalla temporal `/bienes/importar` y el botón «Importar datos» se han **eliminado** una vez completadas las fases de importación.
- Se conservan los campos ocultos de trazabilidad ya escritos en las fichas: `import_key`, `import_batch`, `import_source` e `import_row`.
- Los JSON y las herramientas de importación siguen en `_import/` (ignorada por git) solo como respaldo documental.

## Development Context (Vibe Coding)
- Be proactive: Make reasonable assumptions to keep the workflow moving.
- Focus on: UX, robust storage handling, and clean, modular feature code.
- Keep the 'Cero Coste' (Zero Cost) priority in mind for Firebase usage.
- **Updates Log:**
    - Updated PDF limit to 100MB.
    - Removed legacy migration UI and logic.
    - Implemented 3-card landing for Assets (Numismática, Arte, Objetos) with category routes (`/bienes/categoria/:collectionKey`).
    - Added specific fields for Numismática.
    - Numismática list uses compact rows (photo thumbnail on the right) while Arte and Objetos keep cards.
    - Categories reduced to Numismática, Arte and Objetos; old categories are normalized to `objetos` on read.
    - Coin form is special: no title/`coin_type`, generic fields derived and persisted in the same `assets` document. Year supports concrete year or interval with a.C./d.C.; era and ruler (Roman Empire / Spain) auto-fill from the year and remain editable. Conservation dropdown is ordered best→worst; ceca is free text with no predefined values.
    - Generic `location` removed from assets; coin storage location remains `case_location`/`case_number` under advanced details.
    - Reusable values (material, conservation state, era, empire/reign, ruler, denomination, reference book) use saved suggestions while allowing new values; ceca is free text with no defaults.
    - Added collection filters: material, conservation state, era, owner, category and full-text search; numismática also filters by type (moneda/medalla). Tags are available in every collection, including numismática for defects, rarities and variants.
    - Fixed modal lifecycle: it only opens on demand, closes after saving, and returns to the corresponding collection.
    - Added independent tenant entities (`tenants`), per-tenant documents (`tenantDocuments` + Storage `tenants/`), and bidirectional property links (`property.tenantIds`).
    - Inquilinos is now a tab inside the Inmuebles section; each tab has its own URL: `/inmuebles`, `/inmuebles/alquileres`, `/inmuebles/gastos`, `/inmuebles/inquilinos`. Tenant detail lives at `/inmuebles/inquilinos/:id`; old `/inquilinos` URLs redirect.
    - Legacy embedded property tenants are migrated automatically to tenant entities the first time a property or the Inquilinos page is opened.
    - Storage rules must be published (`firebase deploy --only storage`) to allow tenant documents up to 25 MiB.
    - Versioning: `package.json` version + short git commit + build date are injected by `vite.config.ts` (`__APP_VERSION__`, `__APP_COMMIT__`, `__APP_BUILD_DATE__`, declared in `src/vite-env.d.ts`) and shown in the sidebar footer above the account block. Do not hardcode versions in components; follow the mandatory rules in "Versioning (obligatorio)".
    - License: MIT in `LICENSE`, copyright Antonio Galdó Seiquer (2026); referenced in the sidebar footer and README.
    - **VERIFIED:** `npm run build` passes after restoring strict TypeScript checks.
    - Medallas dentro de Numismática: selector Moneda/Medalla, formulario simplificado de medalla, lista unificada con 🪙/🏅 y filtro por tipo.
    - Importación local de datos: los archivos originales se dejan en `_import/` (ignorada por git) y nunca se suben al repositorio.
    - **1.3.0:** Depuración del modelo de numismática antes de importar: `inventory_number`, `catalog_reference`, `acquisition_source`, `value_source`, `purchase_price_original`/`purchase_currency`, `reference_book_value_original`/`reference_book_currency`, `mint_mark`, `weight_grams`, `diameter_mm`; `medal_size_mm` pasa a texto; conversión automática a euros (ptas/francos/francos suizos/dólares/libras) manteniendo el importe original; etiquetas de defectos/rarezas para numismática; la ceca se separa en ciudad/taller (`mint`) y marca de ceca/ensayador (`mint_mark`).
    - **1.3.1:** Inventario, código de catálogo, peso y diámetro pasan a «Detalles avanzados» (moneda: después de anverso/reverso; medalla: bloque avanzado), dejando arriba los datos más frecuentes e informativos. La versión no se actualiza sola: se sube a mano con `npm version` en el mismo commit.
    - **1.3.2:** `country` se separa de `mint`: país/territorio de emisión visible en moneda y medalla, ciudad/taller en `mint` y marca de ceca en `mint_mark`. El país se puede inferir del título del documento o de la cabecera y se puede corregir en el formulario.
    - **1.4.0:** Pantalla temporal `/bienes/importar` para cargar un JSON local, previsualizar y escribir por lotes con idempotencia (`import_key`). Se añaden `import_batch`, `import_source` e `import_row` como campos ocultos de trazabilidad.
    - **1.5.0:** Orden y agrupación por ubicación/contenedor en Numismática: nueva opción «Ubicación: contenedor», agrupada por álbum/estuche/bandeja para monedas y por ubicación para medallas.
    - **1.6.0:** Filtro «Solo REVISAR» y distintivo REVISAR en la lista de Numismática. Las fichas importadas con dudas llevan la etiqueta `REVISAR` y el detalle en comentarios/notas, para poder localizarlas sin mezclarlas con el resto.
    - **1.7.0:** Lista de Numismática rediseñada: agrupación por defecto por contenedor y orden por número del archivador, con selectores de agrupar (ubicación, propietario, material, conservación, época, tipo) y ordenar (inventario, nombre, valor, año, material, conservación). Cada fila ocupa dos líneas y muestra anverso, reverso, notas y etiquetas; los estados de conservación llevan color. Al pulsar una pieza se abre una ficha flotante con todos los datos, imágenes a la derecha, botones de editar/borrar/copiar enlace, y URL propia `/bienes/categoria/:coleccion/:slug`. Se retira la pantalla de importación.
    - **Medallas:** se descartan los dos archivos ingleses de 2014 por ser un subconjunto incompleto de 2012 (sin números nuevos). Las medallas inglesas de 2012 y las fichas 238-246 de «MEDALLAS VARIOS PAISES» se asignan a Elena Carter; el resto, a Gabriel Galdó.

---

## Versioning (obligatorio)

La app usa **SemVer** (`MAJOR.MINOR.PATCH`) en `package.json`, y la versión se inyecta en el build y se muestra en el pie de la barra lateral. No se escribe la versión a mano en ningún componente.

Reglas:

- **Todo cambio de código sube la versión en el mismo commit.** No se deja para después ni se hace en un commit aparte.
- **Feature nueva o cambio funcional relevante → MINOR:** `1.1.0` → `1.2.0` (el PATCH vuelve a `0`).
- **Corrección de bug, ajuste visual o cambio menor sin funcionalidad nueva → PATCH:** `1.1.0` → `1.1.1`.
- **Cambio incompatible** (rompe datos, configuración o flujos existentes) **→ MAJOR:** `1.x.y` → `2.0.0`.
- El commit incluye el código y el `package.json`/`package-lock.json` actualizados. El título puede ser `feat:` o `fix:`; la versión va en el mismo commit.

Comando recomendado (no crea commit ni tag automático):

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

También se puede fijar una versión exacta: `npm version 1.2.0 --no-git-tag-version`.

No usar `npm version` sin `--no-git-tag-version` salvo que se quiera explícitamente un commit/tag separado.

---

## Git workflow

- Tras completar cada tarea, dejar el trabajo **commiteado** (código + subida de versión en el mismo commit).
- Los commits se revisan en GitHub Desktop → pestaña **History**: al seleccionar un commit se ven los archivos y el diff línea a línea. La pestaña **Changes** solo muestra lo que aún no está commiteado.
- **No hacer push automático:** el push lo hace el usuario desde GitHub Desktop. Publicar en `main` dispara el despliegue de GitHub Pages.
- Mensajes de commit en formato `tipo(ámbito): resumen` (`feat`, `fix`, `docs`, `chore`).
- No reescribir historia ya publicada (`--amend` o `push --force` sobre commits que ya están en `origin/main`).

---

# Autonomous Development Rules

Act as a senior autonomous software engineer.

Your job is to implement tasks, not to explain how they could be implemented.

## Execution
- Inspect the repository before making changes.
- Understand the existing architecture and conventions.
- Make reasonable decisions independently.
- Implement the complete requested functionality.
- Modify all necessary files without asking for approval for every change.
- Run builds, tests and type checks where relevant.
- Fix errors introduced by your changes.
- Verify the final result.
- Update the app version in `package.json` on every code change, in the same commit, following "Versioning (obligatorio)".

## Decision making
- Do not ask unnecessary questions.
- Do not stop to request confirmation for routine implementation decisions.
- If there are multiple reasonable approaches, choose the best one.
- Ask only when genuinely blocked or when a decision could have significant consequences.

## Code quality
- Preserve existing functionality.
- Avoid unnecessary dependencies.
- Follow existing project conventions.
- Keep changes focused and maintainable.
- Never fake successful tests or claim unverified functionality works.

## Communication
- Be concise and action-oriented.
- Avoid lengthy explanations and repetitive progress updates.
- Do not narrate every file you inspect.
- Prioritize implementation over discussion.
- At completion, provide a short summary of changes and verification results.
