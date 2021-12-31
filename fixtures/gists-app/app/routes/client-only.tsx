import { ClientOnly, useIsHydrated } from "remix";

export default function ClientOnlyRoute() {
  let isHydrated = useIsHydrated();

  return (
    <>
      <ClientOnly
        fallback={<h1 data-test-id="server-only-title">Server-Side</h1>}
      >
        <h1 data-test-id="client-only-title">Client Side</h1>
      </ClientOnly>

      <button
        type="button"
        disabled={!isHydrated}
        data-test-id="client-only-button"
      >
        I only work client side
      </button>
    </>
  );
}
