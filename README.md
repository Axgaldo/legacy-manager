# legacy-manager

Private family wealth management app.

## User authorization

Firebase Authentication handles Google sign-in. Access is granted only when the signed-in user's Firebase UID has an enabled document in Firestore at `authorizedUsers/{uid}`.

To authorize a user:

1. Have the user sign in once with Google so Firebase Authentication creates their account.
2. In Firebase Console, open **Firestore Database → Data** and create a document in the `authorizedUsers` collection. Use the user's Firebase Authentication UID as the document ID and set `enabled` to the boolean value `true`.
3. The user's document is readable only by that signed-in user. Firestore rules deny client-side creation, edits, and deletion of authorization records, so manage this allowlist in the Firebase Console.
4. To revoke access, set `enabled` to `false` or delete the authorization document.

When migrating from the previous UID-based rules, create enabled authorization documents for every user who should retain access before publishing the updated `firestore.rules`. The GitHub Pages workflow publishes the frontend only; Firestore rules must be published separately from Firebase Console.
