import type { RequestContext } from '@remix-run/fetch-router';
import { Session } from '@remix-run/session';
import type { OAuthTransaction } from './provider.ts';
export declare function createCodeVerifier(): string;
export declare function createCodeChallenge(codeVerifier: string): Promise<string>;
export declare function createOAuthTransaction(provider: string, returnTo?: string): OAuthTransaction;
export declare function createRedirectResponse(location: string | URL, status?: number): Response;
export declare function getRequiredSearchParam(context: RequestContext, name: string): string;
export declare function getSession(context: RequestContext, source: 'completeAuth()' | 'finishExternalAuth()' | 'startExternalAuth()'): Session;
export declare function resolveRedirectTarget(transaction: OAuthTransaction | undefined, fallback?: string | URL): string;
export declare function sanitizeReturnTo(value: string | null): string | undefined;
//# sourceMappingURL=utils.d.ts.map