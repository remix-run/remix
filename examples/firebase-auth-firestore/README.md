# Firebase Auth & Firestore

This project demonstrates how to use Firebase (Auth and Firestore) with Remix.

## Preview


See the screen recording at `./screen_recording.gif` or Open this example on [CodeSandbox](https://codesandbox.com):

<!-- TODO: update this link to the path for your example: -->

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/firebase-auth-firestore)

## Example

To run it, you need to:

1. Create a Firebase Project
2. Enable Auth (with email) and Firestore
3. Add a Web App
4. Get the admin-sdk and client-sdk credentials
5. Save them in the `.env`-file

### Auth (`app/server/auth.server.ts`)

`signIn` returns a Firebase session-cookie-string, when sign-in is successfull. Then Remix `cookieSessionStorage` is used to set, read and destroy it.

`signUp` creates a user and calls sign-in to receive the session cookie.

`requireAuth` uses `firebase-admin` to verify the session cookie. When this check fails, it throws a `redirect` to the login page. Use this method to protect loaders and actions. The returned `UserRecord` can be handy to request or manipulate data from the Firestore for this user.

### Firestore (`app/server/db.server.ts`)

Requests to the Firestore are made using the `firebase-admin`-SDK. You need to check validity of your requests manually, since `firestore.rules` don't apply to admin requests.

`converter` and `datapoint` are utilities to allow typed Firestore data reads and writes. 

## Links

- [Firestore Data Converters](https://firebase.google.com/docs/reference/node/firebase.firestore.FirestoreDataConverter) for typing
- [Firebase Session Cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Remix `cookieSessionStorage`](https://remix.run/docs/en/v1/api/remix#createcookiesessionstorage)
