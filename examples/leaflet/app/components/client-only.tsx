import { useState, useEffect } from "react";

type Props = {
  children(): React.ReactNode;
  fallback?: React.ReactNode;
};

let hydrating = true;

export function ClientOnly({ children, fallback = null }: Props) {
  let [hydrated, setHydrated] = useState(() => !hydrating);

  useEffect(function hydrate() {
    hydrating = false;
    setHydrated(true);
  }, []);

  return hydrated ? <>{children()}</> : <>{fallback}</>;
}
