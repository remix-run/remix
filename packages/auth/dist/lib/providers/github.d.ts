import type { OAuthProvider, OAuthStandardTokens } from '../provider.ts';
/**
 * Options for creating the built-in GitHub auth provider.
 */
export interface GitHubAuthProviderOptions {
    /** OAuth client identifier for your GitHub OAuth App. */
    clientId: string;
    /** OAuth client secret for your GitHub OAuth App. */
    clientSecret: string;
    /** Callback URL registered with GitHub. */
    redirectUri: string | URL;
    /** Requested scopes for the GitHub login flow. */
    scopes?: string[];
}
/**
 * Profile fields returned by the built-in GitHub auth provider.
 */
export interface GitHubAuthProfile {
    /** Stable GitHub user identifier. */
    id: number;
    /** GitHub login handle. */
    login: string;
    /** Display name returned by GitHub, when available. */
    name?: string | null;
    /** Primary email returned by GitHub, when available. */
    email?: string | null;
    /** Avatar image URL returned by GitHub, when available. */
    avatar_url?: string;
    /** Public GitHub profile URL, when available. */
    html_url?: string;
}
/**
 * Email records returned by GitHub's `/user/emails` endpoint.
 */
export interface GitHubAuthProviderEmail {
    /** Email address returned by the `/user/emails` endpoint. */
    email: string;
    /** Indicates whether this email is the primary address. */
    primary: boolean;
    /** Indicates whether GitHub has verified this email address. */
    verified: boolean;
    /** GitHub visibility setting for the email address, when available. */
    visibility?: string | null;
}
/**
 * Creates a GitHub OAuth App provider.
 *
 * @param options GitHub OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createGitHubAuthProvider(options: GitHubAuthProviderOptions): OAuthProvider<GitHubAuthProfile, 'github', OAuthStandardTokens>;
//# sourceMappingURL=github.d.ts.map