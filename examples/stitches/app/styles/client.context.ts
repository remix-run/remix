import { createContext } from "react";

export interface ClientStyleContextData {
  reset: () => void;
  sheet: string;
}

const ClientStyleContext = createContext<ClientStyleContextData>({
  reset: () => {},
  sheet: ""
});

export default ClientStyleContext;
