import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function authSessionsSecurityHandler({ render, request }: AppContext) {
  return render(<AuthSessionsSecurityPage requestUrl={request.url} />, docsResponseInit)
}

function AuthSessionsSecurityPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 9"
      title="Auth, Sessions, and Security"
      description="The Remix model for per-browser state, identity, authorization, and browser request safety."
      previous={{
        href: routes.docs.formsAndMutations.href(),
        title: 'Forms and Mutations',
      }}
      next={{
        href: routes.docs.filesAndAssets.href(),
        title: 'Files and Assets',
      }}
    >
      <DocsSection id="cookies-vs-sessions" title="Cookies vs sessions">
        <p>Placeholder for Cookies vs sessions.</p>
      </DocsSection>

      <DocsSection id="session-storage-strategies" title="Session storage strategies">
        <p>Placeholder for Session storage strategies.</p>
      </DocsSection>

      <DocsSection id="login-and-logout" title="Login and logout">
        <p>Placeholder for Login and logout.</p>
      </DocsSection>

      <DocsSection id="flash-messages" title="Flash messages">
        <p>Placeholder for Flash messages.</p>
      </DocsSection>

      <DocsSection id="regenerating-session-ids" title="Regenerating session IDs">
        <p>Placeholder for Regenerating session IDs.</p>
      </DocsSection>

      <DocsSection id="credentials-auth" title="Credentials auth">
        <p>Placeholder for Credentials auth.</p>
      </DocsSection>

      <DocsSection id="oauth-and-oidc-providers" title="OAuth and OIDC providers">
        <p>Placeholder for OAuth and OIDC providers.</p>
      </DocsSection>

      <DocsSection id="route-protection-with-requireauth" title="Route protection with requireAuth">
        <p>Placeholder for Route protection with requireAuth.</p>
      </DocsSection>

      <DocsSection id="authorization-checks" title="Authorization checks">
        <p>Placeholder for Authorization checks.</p>
      </DocsSection>

      <DocsSection id="csrf-protection" title="CSRF protection">
        <p>Placeholder for CSRF protection.</p>
      </DocsSection>

      <DocsSection id="cross-origin-protection" title="Cross-origin protection">
        <p>Placeholder for Cross-origin protection.</p>
      </DocsSection>
    </DocsChapter>
  )
}
