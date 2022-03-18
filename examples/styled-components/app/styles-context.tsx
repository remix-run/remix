import * as React from "react";
const StylesContext = React.createContext<null | React.ReactNode>(null);
export const StylesProvider = StylesContext.Provider;
export const useStyles = () => React.useContext(StylesContext);
