import type { ReactNode } from "react";
import React from "react";

const defaultRoute = {
  meta() {
    return {
      title: "Remix Error: Route Not Found",
      description: "There was an error rendering this page"
    };
  },
  default({ children }: { children: ReactNode }) {
    return (
      <div>
        <h1>Error!</h1>
        <div>{children}</div>
      </div>
    );
  }
};

export default defaultRoute;
