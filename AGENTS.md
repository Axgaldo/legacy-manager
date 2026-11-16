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

## Assets Module (Bienes)
- **Entry Point:** Landing page with 3 cards (Numismática, Arte, Objetos).
- **Numismática:** Specific fields including: value, market_value, purchase_price, purchase_year, obverse_info, reverse_info, era, creation_year_range, reference_book, reference_book_value, coin_type, material, empire_reign, mint, manufacturing_place, case_location, case_number.
- **Common fields:** name, owner, category, tags, location, description, brandOrAuthor, year, historicalEra, country, placeOfOrigin, ruler, mint, denomination, conservationState, material, acquisitionYear, acquisitionPrice, currentValue, notes, photos, photoSizesBytes.

## Migration Status
- **Cleaned:** Legacy migration buttons and functions have been removed from the UI and services.
- **Legacy categories:** Old Firestore categories (`coins`, `banknotes`, `art`, `watches`, etc.) are normalized on read to the current Spanish categories. No manual data migration is required.
- **Completed:** Numismática module with all fields (denomination, coin_type, material, conservationState, era, creation_year_range, empire_reign, ruler, mint, manufacturing_place, obverse_info, reverse_info, value, market_value, purchase_price, purchase_year, reference_book, reference_book_value, case_location, case_number, added_date).

## Development Context (Vibe Coding)
- Be proactive: Make reasonable assumptions to keep the workflow moving.
- Focus on: UX, robust storage handling, and clean, modular feature code.
- Keep the 'Cero Coste' (Zero Cost) priority in mind for Firebase usage.
- **Updates Log:**
    - Updated PDF limit to 100MB.
    - Removed legacy migration UI and logic.
    - Implemented 3-card landing for Assets (Numismática, Arte, Objetos) with category routes (`/bienes/categoria/:collectionKey`).
    - Added specific fields for Numismática.
    - Reusable values (material, conservation state, coin type, era, empire/reign, mint, denomination, reference book) use saved suggestions while allowing new values.
    - Added collection filters: material, conservation state, coin type, era, owner, category, tags, plus full-text search.
    - Fixed modal lifecycle: it only opens on demand, closes after saving, and returns to the corresponding collection.
    - **VERIFIED:** `npm run build` passes after restoring strict TypeScript checks.

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
