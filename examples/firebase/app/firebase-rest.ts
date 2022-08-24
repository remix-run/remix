interface RestError {
  error: {
    code: number;
    message: string;
    errors: any[];
  };
}

export const isError = (input: unknown): input is RestError =>
  !!input && typeof input === "object" && "error" in input;

// https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
interface SignInWithPasswordResponse extends Response {
  json(): Promise<
    | RestError
    | {
        /**
         * A Firebase Auth ID token for the authenticated user.
         */
        idToken: string;
        /**
         * The email for the authenticated user.
         */
        email: string;
        /**
         * A Firebase Auth refresh token for the authenticated user.
         */
        refreshToken: string;
        /**
         * The number of seconds in which the ID token expires.
         */
        expiresIn: string;
        /**
         * The uid of the authenticated user.
         */
        localId: string;
        /**
         * Whether the email is for an existing account.
         */
        registered: boolean;
      }
  >;
}

export const signInWithPassword = async (
  body: {
    email: string;
    password: string;
    returnSecureToken: true;
  },
  restConfig: {
    apiKey: string;
    domain: string;
  }
) => {
  const response: SignInWithPasswordResponse = await fetch(
    `${restConfig.domain}/v1/accounts:signInWithPassword?key=${restConfig.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return response.json();
};

// https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
interface SignInWithIdpResponse extends Response {
  json(): Promise<
    | RestError
    | {
        /**
         * 	The unique ID identifies the IdP account.
         */
        federatedId: string;
        /**
         * 	The linked provider ID (e.g. "google.com" for the Google provider).
         */
        providerId: string;
        /**
         * 	The uid of the authenticated user.
         */
        localId: string;
        /**
         * 	Whether the sign-in email is verified.
         */
        emailVerified: boolean;
        /**
         * 	The email of the account.
         */
        email: string;
        /**
         * 	The OIDC id token if available.
         */
        oauthIdToken: string;
        /**
         * 	The OAuth access token if available.
         */
        oauthAccessToken: string;
        /**
         * 	The OAuth 1.0 token secret if available.
         */
        oauthTokenSecret: string;
        /**
         * 	The stringified JSON response containing all the IdP data corresponding to the provided OAuth credential.
         */
        rawUserInfo: string;
        /**
         * 	The first name for the account.
         */
        firstName: string;
        /**
         * 	The last name for the account.
         */
        lastName: string;
        /**
         * 	The full name for the account.
         */
        fullName: string;
        /**
         * 	The display name for the account.
         */
        displayName: string;
        /**
         * 	The photo Url for the account.
         */
        photoUrl: string;
        /**
         * 	A Firebase Auth ID token for the authenticated user.
         */
        idToken: string;
        /**
         * 	A Firebase Auth refresh token for the authenticated user.
         */
        refreshToken: string;
        /**
         * 	The number of seconds in which the ID token expires.
         */
        expiresIn: string;
        /**
         * 	Whether another account with the same credential already exists. The user will need to sign in to the original account and then link the current credential to it.
         */
        needConfirmation: boolean;
      }
  >;
}
export const signInWithIdp = async (
  idToken: string,
  providerId: string,
  restConfig: {
    apiKey: string;
    domain: string;
  }
) => {
  const body = {
    postBody: "id_token=" + idToken + "&providerId=" + providerId,
    requestUri: "http://localhost",
    returnIdpCredential: true,
    returnSecureToken: true,
  };
  const response: SignInWithIdpResponse = await fetch(
    `${restConfig.domain}/v1/accounts:signInWithIdp?key=${restConfig.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return response.json();
};
