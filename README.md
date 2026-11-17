# legacy-manager

[![Build](https://img.shields.io/github/actions/workflow/status/Axgaldo/legacy-manager/deploy.yml?branch=main&label=build)](https://github.com/Axgaldo/legacy-manager/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/github/package-json/v/Axgaldo/legacy-manager?label=version)](https://github.com/Axgaldo/legacy-manager/blob/main/package.json)
[![License](https://img.shields.io/github/license/Axgaldo/legacy-manager?label=license)](https://github.com/Axgaldo/legacy-manager/blob/main/LICENSE)

Private family wealth management app.

## User authorization

Firebase Authentication handles Google sign-in. Access is granted only when the signed-in user's Firebase UID has an enabled document in Firestore at `authorizedUsers/{uid}`.

To authorize a user:

1. Have the user sign in once with Google so Firebase Authentication creates their account.
2. In Firebase Console, open **Firestore Database → Data** and create a document in the `authorizedUsers` collection. Use the user's Firebase Authentication UID as the document ID and set `enabled` to the boolean value `true`.
3. The user's document is readable only by that signed-in user. Firestore rules deny client-side creation, edits, and deletion of authorization records, so manage this allowlist in the Firebase Console.
4. To revoke access, set `enabled` to `false` or delete the authorization document.

When migrating from the previous UID-based rules, create enabled authorization documents for every user who should retain access before publishing the updated `firestore.rules`. The GitHub Pages workflow publishes the frontend only; Firestore rules must be published separately from Firebase Console.

## Firebase rules (Firestore and Storage)

The GitHub Pages workflow deploys **only the frontend**. Rules are never deployed by it: both `firestore.rules` and `storage.rules` must be copied into Firebase Console (or deployed with the Firebase CLI) whenever they change.

### Firestore

`firestore.rules` uses one wildcard rule that already covers every application collection, including `tenants` and `tenantDocuments`. **No Firestore change is needed for the tenants feature.**

### Storage

The source of truth is [`storage.rules`](storage.rules). The bucket has these path rules:

| Path | Used by | Max size | Allowed content | Delete |
|---|---|---|---|---|
| `contracts/{propertyId}/{fileName}` | Contract PDF versions | 100 MiB | PDF | No (archival) |
| `assets/{assetId}/{fileName}` | Asset photos | 2 MiB | `image/webp`, `image/jpeg`, `image/png` | Yes |
| `tenants/{tenantId}/{fileName}` | Tenant documents | 25 MiB | PDF, images (`jpeg`, `png`, `webp`, `gif`, `heic`), Word/Excel/ODT, TXT, ZIP/RAR | Yes |

Everything else is denied by `match /{allPaths=**} { allow read, write: if false; }`.

If the `tenants/` block is missing, uploading any tenant document fails with `storage/unauthorized` even though the rest of the app works. Current block to paste inside `service firebase.storage { ... }`:

```
    // Tenant documents: PDFs, images and office files, up to 25 MiB each.
    match /tenants/{tenantId}/{fileName} {
      allow read: if isAllowedUser();
      allow create: if isAllowedUser()
          && request.resource.size <= 25 * 1024 * 1024
          && (
            request.resource.contentType == 'application/pdf'
            || request.resource.contentType.matches('image/(jpeg|png|webp|gif|heic)')
            || request.resource.contentType.matches('application/(msword|vnd.openxmlformats-officedocument.wordprocessingml.document|vnd.ms-excel|vnd.openxmlformats-officedocument.spreadsheetml.sheet|vnd.oasis.opendocument.text|zip|vnd.rar)')
            || request.resource.contentType == 'text/plain'
          );
      allow update: if false;
      allow delete: if isAllowedUser();
    }
```

### Publishing

- **Console:** Firebase Console → Storage → Rules → paste the content of `storage.rules` → **Publish**. Same for Firestore → Rules with `firestore.rules`.
- **CLI:** `firebase deploy --only storage` (and/or `--only firestore:rules`) after `firebase login` and `firebase use <project>`.
- After changing the limits in `storage.rules`, update the client-side validation too (`src/features/tenants/tenantsService.ts`, `src/lib/storageFiles.ts`) so users get a clear message before uploading.

### Notes

- Tenant document MIME types are derived from the file **extension** first (see `resolveTenantDocumentContentType`), because browsers often report `application/octet-stream` for Office/ZIP files and Storage rules check the declared MIME type.
- Storage paths for tenant documents are `tenants/{tenantId}/{documentId}.{extension}`; the metadata lives in Firestore `tenantDocuments`.
- Any new Storage path (for example a future module) needs its own explicit `match` block; the wildcard at the end denies everything unknown.

## Versioning

The version lives in `package.json`. At build time, `vite.config.ts` injects three constants used by the sidebar footer:

| Constant | Value | Source |
|---|---|---|
| `__APP_VERSION__` | `1.0.0` | `package.json` → `version` |
| `__APP_COMMIT__` | short git hash (e.g. `a1b2c3d`) or `local` | `git rev-parse --short HEAD` |
| `__APP_BUILD_DATE__` | ISO timestamp | build time |

They are declared in `src/vite-env.d.ts` and displayed in `src/components/layout/AppLayout.tsx` above the account block, e.g. `v1.0.0 · a1b2c3d` and the build date. Nothing needs to be edited by hand.

Use [Semantic Versioning](https://semver.org/lang/es/): `MAJOR.MINOR.PATCH`.

- `npm version patch` — bug fixes (1.0.0 → 1.0.1).
- `npm version minor` — new features, backwards compatible (1.0.0 → 1.1.0).
- `npm version major` — breaking changes (1.0.0 → 2.0.0).

These commands update `package.json` and `package-lock.json`; then `git push` and, if you want a release marker, `git push --tags`. The deploy workflow does not read tags, but the commit hash and version shown in the app always identify the build.

## License

MIT — see [`LICENSE`](LICENSE).

Copyright (c) 2026 **Antonio Galdó Seiquer**.

MIT is a permissive open-source license: the copyright stays with the author, and anyone who copies or redistributes the software must keep the copyright and license notice. It does allow others to use, modify and redistribute the code. If you later prefer to reserve all rights instead, replace `LICENSE` with an "All rights reserved" notice and remove the `MIT` link in the sidebar footer (`src/components/layout/AppLayout.tsx`).
