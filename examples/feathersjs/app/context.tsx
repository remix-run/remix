import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

type ProviderProps = {
  socket: typeof Socket | undefined;
  children: ReactNode;
};

const context = createContext<typeof Socket | undefined>(undefined);

export function useSocket() {
  return useContext(context);
}

export function SocketProvider({ socket, children }: ProviderProps) {
  return <context.Provider value={socket}>{children}</context.Provider>;
}
