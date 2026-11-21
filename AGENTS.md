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
- src/features/home: Panel de inicio (lobby) en `/`: resumen de inmuebles y bienes.
- src/features/search: Búsqueda global (Ctrl+K) de inmuebles, inquilinos y bienes.
- src/features/backup: Copia de seguridad JSON y exportaciones CSV (fiscal, inventario).
- src/features/collections: Management of assets (photos, tags, categories).
- src/features/properties: Property management, rent rates, expenses.
- src/features/properties/contracts: Contract management, PDF handling, and addenda.
- src/features/tenants: Independent tenant directory, documents and property links.
- src/features/trash: Papelera (borrado suave), purga manual y página `/papelera`.
- src/features/privacy: Modo incógnito (PrivacyProvider) y formato central de importes (`useMoney`).
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
- **UX conventions (obligatorio):** dark slate theme everywhere — no light `bg-white` cards; user feedback goes through `useToast()` (never `alert()`); money figures always through `useMoney()`.
- **Modelo de gastos (importante):** the *fixed* monthly cost is the **recurring schedules** (`recurringExpenseSchedules` + occurrences): `recurringMonthlyAverage()` (`src/features/properties/recurringExpensesLogic.ts`, shared by KPIs, hero and panel) prorates each active schedule (comunidad monthly, yearly IBI / 12). One-off expenses are a separate thing and never enter «Gastos Periódicos / Mes». The fiscal summary and the fiscal CSV add **both** deductible one-offs and recurring due amounts. Marking a recurring occurrence as paid auto-marks its invoice (when the schedule requires one). The old manual `fixedExpensesMonthly` field has no UI anymore.
- **Modo incógnito (obligatorio):** every money figure in the app is formatted through `useMoney()` (`src/features/privacy/money.ts`), never a local `Intl.NumberFormat`. The sidebar toggle (`PrivacyProvider`) masks amounts as `▓#%§ €` — 3–4 random symbols followed by the currency symbol of the figure (`€`, `ptas`, `$`…), Trade Republic style — on every page at once. Editing forms keep showing real numbers. The preference persists in `localStorage` (`legacy-manager:modo-incognito`).
- **Firebase Rules (important):**
    - The GitHub Pages workflow deploys only the frontend. `firestore.rules` and `storage.rules` are **never** deployed automatically.
    - Firestore: a single wildcard rule (`/{collection}/{document=**}`) covers all app collections, so new collections such as `tenants` and `tenantDocuments` need no rule change.
    - Storage: each path needs its own explicit `match` block. Current paths: `contracts/{propertyId}` (PDF ≤ 100 MiB, **nunca se sobrescribe**, borrado permitido a usuarios autorizados), `assets/{assetId}` (webp/jpeg/png ≤ 2 MiB), `tenants/{tenantId}` (PDF, images, Word/Excel/ODT, TXT, ZIP/RAR ≤ 25 MiB).
    - `storage.rules` is the source of truth; after editing it, publish it in Firebase Console → Storage → Rules (or `firebase deploy --only storage`). Without the `tenants/` block, tenant uploads fail with `storage/unauthorized`.
    - Full rules table, copy-paste block and publishing steps: README → "Reglas de Firebase (Firestore y Storage)".

## Assets Module (Bienes)
- **Entry Point:** `/bienes` shows **only the collection cards** — no asset previews: **Todos**, Numismática, Arte, Relojes, Electrónica y electrodomésticos and Objetos, each with its count and valoración. Clicking a card opens `/bienes/categoria/:collectionKey` (`todos`, `numismatica`, `arte`, `relojes`, `electronica`, `objetos`).
- **Todos:** pseudo-collection with every asset; it can group by **Categoría** and **Tipo de objeto** (moneda/medalla/categoría) and sort by category. Default grouping there is `category`.
- **Vistas:** every collection defaults to the compact row list (`AssetList`, the old numismática list, memoized, 200-per-page, ↑/↓ focus navigation). A **Lista / Cuadrícula** selector switches to the card grid (big photo); the choice is saved per collection in `localStorage` and travels in the URL as `vista=cuadricula`.
- **Fichas:** clicking any asset (row, card or group) opens the floating detail sheet (`AssetDetailModal`) with all data, images, prev/next navigation, print, **Editar/Borrar at the top** (delete asks to type BORRAR — double confirmation) and its own URL `/bienes/categoria/:coleccion/:slug`.
- **Numismática:** Monedas **y medallas** de todas las épocas. Rows view (not cards) with a tiny thumbnail on the right. The form uses a **Moneda / Medalla** selector at the top:
    - **Moneda:** dedicated numismática form. Fields: denomination, inventory_number, catalog_reference, material, conservationState, era, creation_year_range, empire_reign, ruler, country, mint (ciudad/taller), mint_mark (marca de ceca/ensayador), manufacturing_place (legacy), weight_grams, diameter_mm, obverse_info, reverse_info, value, market_value, value_source, purchase_price, purchase_price_original, purchase_currency, acquisition_source, purchase_year, reference_book, reference_book_value, reference_book_value_original, reference_book_currency, case_location, case_number, added_date. Years are stored as signed numbers (negative = a.C.) plus `creation_year_range` for intervals; the form toggles between concrete year and range with d.C./a.C. selects and auto-fills era and ruler (Roman Empire / Spain) from the year.
    - **Medalla:** simplified form with motive, year, material, size (free text), conservation, country, inventory number, catalog code, weight, obverse, reverse, original purchase price + currency, acquisition operation/source, purchase year and location. Stored in the same `assets` collection with `numismatica_type: 'medalla'`; fields: `medal_motive`, `medal_size_mm` (text: `60`, `50x30`, `varios tamaños`…), `acquisition_operation`, `acquisition_source`, `medal_location`, reusing `obverse_info`, `reverse_info`, `material`, `conservationState`, `country`, `purchase_price`, `purchase_price_original`, `purchase_currency`, `year`. The name is auto-generated as `Medalla de <motivo>` (editable via `medal_name_override`).
    - **País y ceca:** `country` es el país o territorio de emisión (se puede inferir del título del documento o de la cabecera); `mint` es la ciudad o taller y `mint_mark` la marca de ceca/ensayador. Son campos distintos para no perder información.
    - **Divisas:** `purchase_price_original` + `purchase_currency` and `reference_book_value_original` + `reference_book_currency` keep the original amount; the euro fields (`purchase_price`, `reference_book_value`) are auto-converted and remain editable. Peseta (166,386) and French franc (6,55957) use fixed rates; CHF/USD/GBP use editable approximate defaults.
    - **Etiquetas en numismática:** defects, rarities, variants and sets use tags/comments (e.g. `RARA`, `AGUJERO`, `CANTO ESTRIADO`, `CONJUNTO`) instead of dedicated fields.
    - Documents without `numismatica_type` are treated as `moneda`; legacy `medals`/`medallas` categories normalize to `numismatica` and infer `medalla`. The list shows 🪙/🏅, the catalog code next to the name, and the filter row has a **Tipo** selector (todo / monedas / medallas).
    - **Lista y ficha:** agrupación por defecto por contenedor y orden por número del archivador, con selectores de agrupar/ordenar; cada fila muestra dos líneas (datos + anverso, reverso, notas y etiquetas) y el estado de conservación va coloreado (rojo → naranja → amarillo → verde → azul, de peor a mejor). Al pulsar una pieza se abre una ficha flotante con todos los datos e imágenes, navegación anterior/siguiente, impresión, botones de editar/borrar y URL propia `/bienes/categoria/:coleccion/:slug` para compartirla.
    - **Preferencias y URL:** agrupar, ordenar, vista y filtros se guardan por colección en `localStorage` y también viajan en la URL (`agrupar`, `orden`, `vista`, `propietario`, `material`, `estado`, `epoca`, `tipo`, `etiquetas`, `revisar`), así que se puede compartir una vista filtrada.
    - **Rendimiento:** la lista pinta 200 filas y ofrece «Mostrar 200 más» / «Mostrar todo»; las flechas ↑/↓ mueven el foco entre piezas; la búsqueda usa `useDeferredValue`.
    - **Impresión de listas:** «Imprimir vista» y el icono 🖨 de cada grupo generan una tabla en blanco y negro (Nº, pieza, año, material, ceca, conservación, ubicación y valor), no una ficha por página.
- **Relojes:** no dedicated form; the generic asset form is enough: nombre, **marca/modelo/autor** (campo propio guardado en `brandOrAuthor`), año, lugar de origen, valores, fotos y etiquetas.
- **Electrónica y electrodomésticos:** same generic form; no special fields for now.
- **Fotos:** el botón «Añadir fotos» del formulario abre en móvil un menú para **hacer la foto** (cámara trasera) o **elegir de la galería**; en escritorio abre el selector de archivos. Las dos vías comprimen a WebP (1280 px) y se suben a Storage al guardar.
- **Common fields:** name, owner, category, tags, description, brandOrAuthor, year, historicalEra, country, placeOfOrigin, ruler, mint, mint_mark, denomination, conservationState, material, acquisitionYear, acquisitionPrice, currentValue, notes, photos, photoSizesBytes. `location` was removed; coin location is `case_location`/`case_number` in advanced details.

## Acceso a datos (obligatorio)

- **Suscripciones**: todas pasan por `subscribeToCollection` (`src/lib/firestoreSubscriptions.ts`), que aplica mapeo, filtro de papelera, orden y errores en un solo sitio. No volver a escribir `onSnapshot` + `snapshot.docs.map` en cada servicio; si hace falta una consulta nueva, se le pasan `constraints` (`where`, `orderBy`…).
- **Conversión**: los mappers usan `src/utils/coerce.ts` (`asString`, `asNumber`, `asNumberOr`, `asBoolean`, `asStringArray`, `asIsoDate`). Nunca `Number(valor)` directo sobre un campo de Firestore sin comprobar finitud: un documento antiguo o corrupto no debe pintar `NaN €` en fiscal ni romper una comparación.
- **Papelera**: el filtro va en la suscripción (`filter: (data) => !data.deletedAt`, o `!data.isDeleted` en contratos), no en cada componente.

## Modales y accesibilidad

- Todos los diálogos usan `useFocusTrap` (`src/hooks/useFocusTrap.ts`): encierra el tabulador, respeta `autoFocus`, `Escape` cierra cuando el componente lo permite y el foco vuelve al elemento que abrió el diálogo. La pila interna evita que dos modales abiertos a la vez (ficha + confirmación) se peleen por el foco.
- Si se añade un modal nuevo: `const trapRef = useFocusTrap<HTMLDivElement>(abierto, cerrar)` y `ref={trapRef} tabIndex={-1}` en el panel con `role="dialog"`. No pasar `onEscape` si el componente ya gestiona `Escape`.

## Papelera (borrado suave, obligatorio)

- **Nada se borra al instante desde la interfaz**: los documentos reciben `deletedAt` (ISO) y los mappers de cada servicio los ignoran (`if (!data.deletedAt)`). Retención: **30 días** (`TRASH_RETENTION_DAYS` en `src/features/trash/trashService.ts`).
- **Alcance**: inmuebles, bienes, contratos, inquilinos y documentos de inquilino. Los gastos puntuales y los cobros no tienen entrada propia en la papelera, pero **se ocultan en cascada** con su inmueble.
- **Cascada de inmueble**: `softDeleteProperty` marca el inmueble y sus `expenses`, `rentPayments`, `recurringExpenseSchedules`, `recurringExpenseOccurrences` y sus `contracts` con **el mismo `deletedAt`**. Restaurar devuelve solo los hijos con esa marca exacta (no resucita algo borrado antes). Purgar borra todos los documentos de esas colecciones del inmueble.
- **Inquilinos**: mover a la papelera guarda ficha y `tenantDocuments` y **conserva los vínculos** (`property.tenantIds`) para que restaurar sea exacto; al purgar se borran documentos, archivos `tenants/` y los vínculos de los inmuebles.
- **Contratos**: borrar un contrato lo mueve a la papelera (`isDeleted: true` + `deletedAt` ISO) y lo oculta del inmueble. Restaurar lo devuelve **inactivo** (hay que marcarlo como vigente). Purgar borra el contrato, sus `contractAddenda` y todas sus `contractFileVersions`, incluidos los PDFs de `contracts/{propertyId}/...`. Las reglas de Storage permiten `delete` a usuarios autorizados y siguen prohibiendo `update` (nunca se sobrescribe un PDF). Si la regla no está publicada, la purga avisa de los archivos que no pudo borrar.
- **PDFs legacy (soporte retirado en 1.19.0)**: las versiones antiguas vivían en Firestore `contractFileContents/{versionId}` (campo `pdf` en Bytes o subcolección `chunks`, a veces gzip). La app ya **solo** lee `storagePath` de Storage; las versiones sin `storagePath` se filtran y `getContractPdfBlob` lanza un error claro. Los datos de `contractFileContents` son residuo de pruebas y pueden borrarse desde la consola (recordando eliminar también la subcolección `chunks`).
- **Purga**: se hace **desde la app**, nunca con Cloud Functions (sin plan Blaze): al abrir `/papelera` se eliminan los elementos con **más de 30 días** y el resto espera a «Eliminar ya» o «Vaciar papelera». Si nadie abre la papelera, nada se borra solo.
- **Lectura**: `loadTrash()` es una lectura puntual sin listeners (`where('deletedAt','>','')`, válido para los ISO que escribe la app y excluye documentos sin el campo); las listas normales filtran en el mapper, así que Inicio, fiscal, búsqueda y KPIs no cuentan lo borrado.
- **Nueva colección hija de inmuebles**: añadirla a `PROPERTY_CHILD_COLLECTIONS` para que se oculte y se purgue con el inmueble.
- **Restaurar/purgar**: siempre con `restoreTrashEntry` / `purgeTrashEntry`; no duplicar esa lógica en componentes.

## Archivos y caché (importante)

- `uploadPrivateStorageBlob` sube con `Cache-Control: private, max-age=31536000, immutable`: los nombres llevan UUID y las reglas impiden sobrescribir. **Solo afecta a subidas nuevas**; las fotos y PDFs antiguos conservan `no-store` porque `allow update` es `false` en Storage. Para aprovecharlo en los antiguos hay que volver a subirlos (encaja con las miniaturas pendientes).
- **Exportaciones ZIP**: `src/features/backup/documentsExport.ts` + `src/utils/zip.ts` (ZIP propio, sin dependencias, método *store*). Descarga los archivos con la sesión del usuario; nunca genera URLs públicas. Incluye `LEEME.txt` con el contexto.
- El backup JSON cubre 11 colecciones, pero **no** los archivos de Storage: para eso están los ZIP por inmueble y por bien.

## PWA y service worker

- `public/manifest.webmanifest` + `public/sw.js`. El registro ocurre solo en producción en `src/main.tsx` con `?v=__APP_VERSION__`, y al activarse borra las cachés de versiones anteriores.
- Estrategia: navegación **red primero** con copia cacheada como respaldo (nunca sirve HTML viejo estando online); `assets/` (con hash) e iconos, caché primero. Firebase y otros dominios **no se interceptan**.
- Si tras desplegar se ve una versión rara: DevTools → Application → Service Workers → *Unregister* + *Clear storage*.
- Iconos `icon-192.png` / `icon-512.png` derivados del favicon para instalar en móvil.

## Tests (Vitest)

- `npm test` (una pasada) y `npm run test:watch`. Vitest 3 usa `vite.config.ts` y el alias `@`, sin configuración extra.
- Cubierto: `recurringExpensesLogic` (prorrateo IBI/12, vencimientos, media mensual), `rentRates` (tramos, meses sin alquiler), `numbers` (miles), `csv` (escapado, BOM, decimales), `money` (formato y máscaras del modo incógnito), `zip` (cabeceras, CRC32, nombres seguros), `backupReminder` (60 días, fecha inválida, reloj adelantado), `coerce` (conversión defensiva), `propertyReminders` (ventana de 60 días, atrasos) y `annualComparison` (agregados por año).
- Son tests de **lógica pura**: no tocan Firebase, DOM ni red, y no hay E2E. Hay que lanzarlos a mano antes de commitear cambios de dinero o cálculos.
- **CI**: `.github/workflows/ci.yml` ejecuta `npm test`, `npm run lint` y `npm run build` en cada push y pull request (independiente del workflow de despliegue).
- Si un test falla tras un cambio de modelo, se actualiza junto con la lógica y se explica en el commit; nunca se borra el test para "arreglarlo".

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
    - Categories are Numismática, Arte, Relojes, Electrónica y electrodomésticos and Objetos; old categories are normalized on read (`watches`→relojes, `electronics`/`computers`→electronica, the rest→objetos).
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
    - License: MIT in `LICENSE`, copyright **Axgaldo** (https://github.com/Axgaldo, 2026); referenced in the sidebar footer and README con un icono de GitHub enlazado al perfil.
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
    - **1.8.0:** Ficha de numismática con navegación anterior/siguiente (botones y flechas del teclado) siguiendo el orden visible de la lista, botón de imprimir con hoja limpia en blanco y negro, y escala de conservación corregida de peor a mejor: rojo, naranja, ámbar, amarillo, lima, verde y azul.
    - **1.8.1:** Rendimiento al abrir fichas: el slug se resolvía recorriendo toda la colección por cada moneda (O(n²), ~15 s con 2.085 fichas). Ahora se construye un índice de slugs una vez por carga (`buildAssetSlugIndex`) y la apertura baja a 2-4 ms. La lista de numismática está memoizada para no repintarse al abrir o cerrar la ficha.
    - **1.8.2:** Búsqueda con `useDeferredValue`: el campo responde al instante y el filtrado de la lista se hace en segundo plano, con aviso «Buscando…» mientras tanto.
    - **1.9.0:** Preferencias de lista por colección (agrupar, ordenar y filtros) guardadas en `localStorage` y en la URL para compartir vistas filtradas; total de la vista visible («Mostrando X de Y · valor») con botón de limpiar filtros; pintado progresivo de 200 en 200; navegación con flechas ↑/↓ por la lista; e impresión de la vista o de un grupo como tabla compacta en blanco y negro.
    - **Medallas:** se descartan los dos archivos ingleses de 2014 por ser un subconjunto incompleto de 2012 (sin números nuevos). Las medallas inglesas de 2012 y las fichas 238-246 de «MEDALLAS VARIOS PAISES» se asignan a Elena Carter; el resto, a Gabriel Galdó.
    - **1.10.0:** Bienes reorganizado: al entrar en `/bienes` solo se ven las colecciones (sin tarjetas de bienes ni estadísticas); nuevas categorías **Relojes** y **Electrónica y electrodomésticos** (alias legacy `watches`→relojes y `electronics`/`computers`→electronica, el resto→objetos); colección **Todos** en `/bienes/categoria/todos` con agrupación por **Categoría** y **Tipo de objeto** y orden por categoría; todas las colecciones usan por defecto la vista de filas (`AssetList`, antes `NumismaticaList`) con selector **Lista / Cuadrícula** (`vista` en URL y localStorage, cuadrícula con foto grande y pintado 60 en 60); la ficha flotante con editar/borrar arriba es el único punto de detalle en todas las colecciones; el formulario genérico gana el campo **Marca / modelo / autor** (`brandOrAuthor`, antes volcado como etiqueta al editar).
    - **1.11.0:** **Modo incógnito** en la barra lateral (estilo Trade Republic): todas las cifras de dinero de la app se formatean con `useMoney()` (`src/features/privacy/money.ts`) y quedan enmascaradas como «€ ▓#%$&» con caracteres aleatorios al activarlo; se recuerda en `localStorage`. Unifica los 8 formateadores de euros duplicados en uno solo; los formularios de edición siguen mostrando los importes reales; los importes originales con divisa muestran el símbolo (ptas, $…) en vez del código. También: `eslint.config.js` nuevo (ESLint 9 flat config) para que `npm run lint` funcione, y README reescrito en español (módulos, despliegue, reglas y CORS).
    - **1.12.0:** **Panel de inicio en `/`** (antes redirigía a `/inmuebles`): tarjetas resumen de Inmuebles y Bienes; calendario del mes en curso con marcas por día (verde = cobros registrados con `paidAt`, rojo = gastos sin pagar, puntuales y periódicos); anotaciones de alquileres cobrados/pendientes, gastos sin pagar, facturas y atrasos de meses anteriores; gráfica de barras cobros vs gastos por mes del año (CSS, sin dependencias); últimos 8 bienes añadidos (foto + nombre, abren su ficha) y valoración por colección. «Inicio» en la barra lateral con `NavLink end`. Todo consciente del modo incógnito: cifras enmascaradas y gráficas/barras de valor ocultas.
    - **1.12.1:** Máscara del modo incógnito más corta y coherente con el formato real: 3–4 caracteres aleatorios seguidos del símbolo de la divisa («▓#%§ €», «▓#%§ ptas», «▓#%§ $»), en vez de 5–7 caracteres con el € delante.
    - **1.13.0:** Ronda de mejoras: **toasts** (`ToastProvider`, `useToast`) que sustituyen los `alert()` y avisan de guardados/eliminaciones/exportaciones; **tema oscuro unificado** (Inmuebles ya no mezcla tarjetas blancas: PropertiesPage, PropertyDetailPage, PropertyModal, PropertyTenantsPanel y ConfirmModal convertidos a slate); **lightbox de fotos** a pantalla completa en las fichas (`PhotoLightbox`, flechas y Esc); **«⧉ Duplicar»** en la ficha de un bien (`duplicateAsset` copia datos sin fotos ni `import_key`, nombre con «(copia)», y abre la copia para editarla); **copia de seguridad y exportaciones** en el panel (`src/features/backup`: JSON completo de 11 colecciones, CSV fiscal anual por inmueble y CSV de inventario; se generan en el dispositivo con lecturas puntuales); y **búsqueda global Ctrl+K** (`GlobalSearch`) con inmuebles, inquilinos y bienes, listeners solo mientras está abierta y botones en la barra lateral y el header móvil. ESLint: `ignoreRestSiblings` para el patrón `const { id, ...rest }`.
    - **1.14.0:** Modelo de gastos ordenado: el KPI «Gastos Fijos / Mes» pasa a ser **«Gastos Periódicos / Mes»**, la media mensual real de las obligaciones periódicas activas (`recurringMonthlyAverage`, prorratea IBI/12 etc.) — también en el flujo neto (KPI, panel y hero de la ficha) y en las tarjetas de inmueble; el campo manual `fixedExpensesMonthly` desaparece del formulario (nota que remite a «Gastos periódicos»). Al marcar un periódico **pagado se marca también su factura** automáticamente (si el gasto la requiere). Orden de pestañas de la ficha: periódicos antes que puntuales. Pestaña **«Gastos»** (antes «Gastos generales») con filtro «Mostrar: todos / solo periódicos / solo puntuales» que filtra el calendario y muestra una lista de periódicos con chips de meses y totales. **Resumen fiscal y CSV fiscal ahora incluyen los periódicos deducibles** (antes solo puntuales). Lógica de vencimientos unificada en `recurringExpensesLogic.ts` (antes triplicada en panel, vista general e inicio).
    - **1.15.0:** **Resumen fiscal movido a la sección general**: nueva pestaña «Fiscal» en Inmuebles (`/inmuebles/fiscal`, `TaxOverview`) con filtros de propietario, provincia y ejercicio, cajas de ingresos/deducibles/neto (con reducción 50%), desglose por categoría, detalle por inmueble con fila TOTAL y botón de **CSV fiscal que respeta los filtros** (`downloadFiscalYearCsv(year, { owner, province })`, nombre de archivo con sufijos). La pestaña «Resumen Fiscal» desaparece de la ficha individual (el IRPF se declara por contribuyente agregando sus inmuebles, no piso a piso).
    - **1.16.0:** Ajustes de UX: **miniaturas de PDF de contratos en vertical** (cuadradas en compacto, 3:4 en normal, ajustadas al ancho y sin barra) y al pulsarlas el PDF **se abre en una pestaña nueva** (antes sustituía la app); tarjetas de inquilinos del inmueble: **toda la tarjeta abre la ficha**, botón «Abrir ficha» eliminado; Bienes: «Ver colección →» retirado de las tarjetas (ya son pulsables) y en la cuadrícula el botón pasa de «Ver detalles» a **«Editar», que abre el formulario directamente**; cifras de dinero con **separador de miles siempre** («1.000 €», no «1000 €»; Intl es-ES no agrupa las 4 cifras) vía `groupThousands` en `src/utils/numbers.ts`, aplicado a euros e importes originales (CSV y años sin cambios, como debe ser).
    - **1.16.1:** Miniaturas de PDF todavía más discretas: la del contrato pasa a tamaño fijo pequeño (`w-32/36`, 3:4, columna `auto` que abraza la miniatura en vez de media tarjeta) y la de las **adendas aún más pequeña (`w-24/28`) y a la derecha** del bloque de controles (flex con `justify-between`). Panel de inicio: eliminados los «Abrir Inmuebles →» y «Abrir Bienes →» redundantes (la tarjeta entera ya es el botón).
    - **1.16.2:** Red de seguridad de navegación: ruta comodín que devuelve a Inicio en URLs desconocidas (antes quedaba la pantalla en blanco) y `ErrorBoundary` global + otro por pantalla dentro del layout (conserva la barra lateral) con mensaje de recuperación, «Recargar», «Volver al inicio» y detalles técnicos. Backlog priorizado guardado en AGENTS.md.
    - **1.17.0:** Ronda de robustez y archivo. **Papelera con borrado suave** (`deletedAt`, 30 días, `/papelera` en el pie de la barra lateral): inmuebles (con cascada de gastos, cobros y periódicos por marca de tiempo), bienes, inquilinos y documentos; restaurar y purgar desde la app, sin Cloud Functions. **ZIP de documentos** por inmueble (contratos, adendas y archivos de inquilinos) y de **fotos** por bien, con generador ZIP propio sin dependencias (`src/utils/zip.ts`, verificado con el descompresor de Windows) y `LEEME.txt`. **Cache-Control `immutable`** en Storage para subidas nuevas (las antiguas siguen `no-store` porque las reglas bloquean `update`). **Vitest** con 46 pruebas de lógica pura (gastos periódicos, tramos de renta, miles, CSV, importes/máscaras y ZIP) y scripts `npm test` / `npm run test:watch`. **PWA instalable**: manifest, iconos 192/512 e icono de app, y service worker network-first que cachea shell y assets con hash sin interceptar Firebase. **Accesibilidad**: `aria-label` en cierres de modales y avisos y `role="dialog"`/`aria-labelledby` en `ConfirmModal`. Textos de borrado actualizados a «Mover a papelera».
    - **1.18.0:** **Recordatorio de copia de seguridad cada 60 días**: `downloadFullBackup()` guarda la fecha en `localStorage` (`src/features/backup/backupReminder.ts`), Inicio muestra el estado («última copia hace X días / próximo recordatorio en Y») y avisa con un toast una vez por sesión cuando toca. No escribe nada en Firebase; si se limpian los datos del sitio, el recordatorio se reinicia. Texto de la papelera con los **30 días explícitos** y fecha exacta de borrado por elemento. La **foto de Google** del usuario tiene *fallback* a iniciales si no carga (`referrerPolicy="no-referrer"` + `onError`). Tests nuevos de `backupStatus` (0, 59, 60, 180 días, fecha inválida y reloj adelantado).
    - **1.19.0:** **Retirada del soporte de PDFs antiguos de Firestore**: `contractFileContents` y los `chunks` dejan de leerse; `contractFilesService` solo usa `storagePath` de Storage y las versiones sin archivo se filtran del panel. Desaparecen el botón «Migrar PDF(s) antiguos», `migrateContractPdfVersionToStorage`, la descompresión gzip en cliente y las dependencias asociadas. Los 3 registros de prueba sin `storagePath` y los 4 documentos de `contractFileContents` se borran desde la consola de Firebase.
    - **1.20.0:** **Contratos borrables de verdad + P1**. Reglas de Storage: `contracts/` permite `delete` a usuarios autorizados (sigue prohibido `update`; hay que publicar la regla a mano). El botón «Borrar contrato» mueve el contrato a la **papelera** (30 días, con restauración; vuelve inactivo), el borrado del inmueble lo arrastra en cascada y la purga elimina contrato, `contractAddenda`, `contractFileVersions` y los PDFs de `contracts/{propertyId}/...`, avisando de los archivos que no se pudieron borrar (regla sin publicar). **Code splitting** con `React.lazy` por ruta + `manualChunks` (react, firebase y páginas; el arranque pasa de un chunk de ~1,06 MB a chunks cacheables) y **persistencia offline** de Firestore con `persistentLocalCache` multi-pestaña. Las **miniaturas** de fotos quedan como mejora futura. README y AGENTS actualizados.
    - **1.20.1:** **Corregido el remontaje al cambiar de URL**: el `ErrorBoundary` del layout usaba `key={location.pathname}`, así que abrir o cerrar la ficha de un bien (que cambia la URL) desmontaba y remontaba toda la página, releyendo la colección y repintando la lista de 2.084 fichas. Ahora usa `resetKey` (se recupera de un error sin remontar a sus hijos). Medido en Chrome: clic → ficha en ~180 ms y el nodo de búsqueda sobrevive a la navegación. También corregidas las rutas de `favicon`, iconos y manifest en desarrollo (se pedían con `/legacy-manager/legacy-manager/...` por el doble prefijo de `%BASE_URL%`); en el build ya eran correctas.
    - **1.20.2:** **Deuda técnica barata (P3)**. CI nuevo (`.github/workflows/ci.yml`: tests + lint + build en push y PR). Los warnings de `exhaustive-deps` corregidos de verdad: `tenantNamesFor` memoizado en Inmuebles y los efectos de la ficha usan `propertyId` estable en vez del objeto completo (evita datos del inmueble anterior). Quedan 4 avisos de `react-refresh` en los providers, preexistentes y sin impacto en producción. `fixedExpensesMonthly` fuera del modelo y del mapper. Retiradas las funciones de borrado sin uso (`deleteAsset`, `deleteProperty`, `deleteTenantCompletely`, `deleteTenantDocument`) y sus imports. Al purgar un bien se borran también sus `assetPhotoBackups` legacy.
    - **1.21.0:** **Robustez de datos + producto**. Todas las suscripciones de Firestore pasan por `subscribeToCollection` (`src/lib/firestoreSubscriptions.ts`) y los mappers convierten con `src/utils/coerce.ts`, evitando `NaN` y campos corruptos. **Avisos en Inicio**: contratos que vencen y revisiones de renta en los próximos 60 días (o atrasadas), calculados con `propertyReminders` y enlazados al inmueble. **Pestaña «Evolución anual»** en la ficha del inmueble: ingresos cobrados vs gastos de los últimos 5 ejercicios con barras, totales y valor actual. **PDF resumen anual** para el gestor mediante hoja de impresión propia (blanco y negro, importes sin enmascarar, inquilinos y fecha), con CSS `#property-annual-print`. Tests nuevos de `coerce`, `propertyReminders` y `annualComparison` (79 en total).
    - **1.22.0:** **Auditoría y accesibilidad**. *Focus trap* reutilizable en todos los diálogos (confirmaciones, fichas, editores, lightbox y búsqueda global) con pila para modales anidados, respeto de `autoFocus`, cierre con `Escape` y devolución del foco al disparador. **Corrección**: la comparativa anual ahora suma también **gastos periódicos y sus ocurrencias** (antes solo puntuales). Los avisos de renta distinguen «revisión prevista» de «tocaba el» y calculan días en UTC para no desviarse con el cambio de hora. El service worker guarda una sola copia del index (no una por URL). `asIsoDate` se usa en la papelera. `npm audit fix` actualiza dependencias de desarrollo (quedan avisos que exigen React Router 7 / Vitest 5 / afectan solo a gRPC en Node; documentados en el backlog). En desarrollo, `/legacy-manager` sin barra final redirige a `/legacy-manager/` con un plugin de Vite. **80 tests**.
    - **1.22.1:** **Identidad pública**: el titular visible pasa a ser **Axgaldo** en `LICENSE`, `package.json`, README y el pie de la barra lateral, con un icono de GitHub enlazado a `https://github.com/Axgaldo`. La licencia sigue siendo MIT (año 2026). Commit de solo marca y documentación salvo el pie de la app.
    - **1.23.0:** **Fotos desde cámara y enlace al repositorio**. En el formulario de bienes, «Añadir fotos» abre un menú en móvil/tablet (`pointer: coarse`) con **Hacer una foto** (`<input capture="environment">`, cámara trasera) o **Elegir de la galería**; en escritorio va directo al selector de archivos. Ambas opciones pasan por la misma compresión WebP y el mismo flujo de guardado. El pie de la barra lateral enlaza «Build del …» al repositorio de GitHub. La detección táctil se actualiza si cambia el puntero.
    - **1.23.1:** **Acciones de la ficha de bien en móvil**. El bloque de botones (flechas, Imprimir, Copiar enlace, Fotos ZIP, Duplicar, Editar, Borrar y cerrar) ocupa ahora el ancho completo y se envuelve en varias filas en vertical; antes se quedaba en la fila del título con `shrink-0` y el `overflow-hidden` de la ficha recortaba los últimos botones. En horizontal/escritorio se mantiene en una sola fila alineada a la derecha.

---

## Backlog (ideas acordadas, pendientes de implementar)

Orden aproximado por relación impacto/esfuerzo. No implementar sin necesidad: son mejoras, no deuda que bloquee.

**P0 — sin pendientes**
- El borrado definitivo de contratos y PDFs se implementó en 1.20.0: regla de Storage con `delete` permitido, papelera individual de contratos, cascada con el inmueble y purga de versiones, adendas y archivos. No requiere más cambios.

**P1 — rendimiento y coste (cero coste)**
- **Miniaturas de fotos** (mejora futura acordada): al subir, generar un WebP de ~400 px (`thumb-*`) y usarlo en listas/cuadrículas; la imagen completa solo en la ficha y el lightbox. Reduce drásticamente el egress de Storage. Al volver a subir las antiguas heredan también la nueva `Cache-Control` immutable. **No implementado a propósito en 1.20.0.**
- Code splitting y persistencia offline: **hechos en 1.20.0** (chunks por ruta + `manualChunks`, y `persistentLocalCache` con multi-pestaña).

**P2 — producto**
- Completado en 1.17.0: papelera con borrado suave y purga desde la app, ZIP de documentos por inmueble y de fotos por bien, `aria-label` en los iconos que faltaban y PWA instalable. No repetir estas propuestas.

**P3 — mantenibilidad**
- Completado en 1.20.2, 1.21.0 y 1.22.0: CI con tests + lint + build en cada push/PR, `exhaustive-deps` corregidos de verdad, `fixedExpensesMonthly` eliminado, funciones de borrado sin uso retiradas, suscripciones unificadas en `subscribeToCollection`, conversión defensiva con `coerce` y *focus trap* en todos los diálogos. La purga de un bien borra sus `assetPhotoBackups` legacy.
- **Trocear componentes grandes** (aplazado conscientemente en 1.22.0): `CollectionsPage` (~960 líneas), `PropertyDetailPage` (~900), `AssetModal` (673). Sin tests E2E, extraer bloques con tanta lógica local tiene más riesgo de regresión que beneficio inmediato; hacerlo al tocar esas pantallas por otro motivo.
- **Pendientes menores**: llevar gastos puntuales y cobros a la papelera (descartado por decisión del usuario en 1.22.0).

**Actualizaciones de dependencias (aplazadas, sin riesgo actual)**

Estado a 2026-11-18: `npm audit` deja 9 avisos, todos en dependencias de desarrollo o en código que no se ejecuta en el navegador. No usar `npm audit fix --force` sin analizar: bajaría Firebase a v9.

- **React Router 6.30.6 → 7.x** (cambio mayor). Avisos: *open redirect* por barra invertida en `<Link>`/`useNavigate` (solo con destinos controlados por terceros; la app navega a rutas internas) e inyección en SSR (no se usa SSR). Antes de subir: probar navegación, deep links, atrás/adelante, `Ctrl+K`, rutas 404 y las redirecciones legacy (`/inquilinos`, `/bienes/importar`).
- **Vitest 3.2.7 → 5.x** (cambio mayor, solo desarrollo). Avisos de Tinypool y `@vitest/mocker` que no afectan a producción. Adaptar la configuración si cambia y verificar los 80 tests y el workflow de CI.
- **Firebase / `@grpc/grpc-js`** (aviso *high*): la cadena de gRPC solo se usa en el transporte Node; comprobado que **no entra en el bundle** del navegador. Esperar a que Firebase actualice la dependencia; no degradar de versión.
- Revisar `npm audit` distinguiendo dependencias de desarrollo, indirectas y de servidor antes de actuar.

**Ideas de producto (sin prioridad)**
- Completado en 1.21.0: avisos de contrato/renta, comparativa anual por inmueble y PDF resumen anual para el gestor. No repetir estas propuestas.

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
