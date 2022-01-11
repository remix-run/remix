import { ClientOnly, useHydrated } from "remix-utils";
import { BrokenOnTheServer } from "~/components/broken-on-the-server.client";
import { ComplexComponent } from "~/components/complex-component";

export default function Screen() {
  const hydrated = useHydrated();
  return (
    <>
      <ClientOnly fallback={<p>Loading...</p>}>
        <BrokenOnTheServer />
      </ClientOnly>

      <ClientOnly fallback={<p>Loading...</p>}>
        <ComplexComponent />
      </ClientOnly>

      <button
        type="buttonn"
        disabled={!hydrated}
        onClick={() => alert("I has JS loaded!")}
      >
        Try me!
      </button>
    </>
  );
}
