import { createContext } from "react";

export interface ClientStyleContextData {
  reset: () => void;
}

const ClientStyleContext = createContext<ClientStyleContextData>({
  reset: () => {},
});

export default ClientStyleContext;
