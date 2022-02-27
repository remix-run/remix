import React from "react";
import { createContext, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MagicUserMetadata } from "@magic-sdk/admin";

export interface UserMetadata {
  user?: MagicUserMetadata;
  loading?: boolean;
}

interface Props {
  children: React.ReactNode;
}

type UserContextType = [UserMetadata, Dispatch<SetStateAction<UserMetadata>>];

const UserContext = createContext<UserContextType>([undefined!, undefined!]);

const UserProvider = ({ children }: Props): JSX.Element => {
  const [user, setUser] = useState<UserMetadata>({ loading: false });

  return (
    <UserContext.Provider value={[user, setUser]}>
      {children}
    </UserContext.Provider>
  );
};

const useUserContext = (): UserContextType => {
  return React.useContext(UserContext);
};

export { UserProvider, useUserContext };
