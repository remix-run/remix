import * as React from "react";
import { hydrate } from "react-dom";
import { RemixBrowser } from "@remix-run/react";
import { getCssText } from "./styles/stitches.config";
import ClientStyleContext from "./styles/client.context";

interface ClientCacheProviderProps {
  children: React.ReactNode;
}

function ClientCacheProvider({ children }: ClientCacheProviderProps) {
  const [sheet, setSheet] = React.useState(getCssText());

  const reset = React.useCallback(() => {
    setSheet(getCssText());
  }, []);

  return (
    <ClientStyleContext.Provider value={{ reset, sheet }}>
      {children}
    </ClientStyleContext.Provider>
  );
}

hydrate(
  <ClientCacheProvider>
    <RemixBrowser />
  </ClientCacheProvider>,
  document
);
