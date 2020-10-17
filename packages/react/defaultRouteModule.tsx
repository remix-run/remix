import type { ReactNode } from "react";
import React from "react";

const defaultRouteModule = {
  default({ children }: { children?: ReactNode }) {
    return (
      <div>
        <h1>Error!</h1>
        <div>{children}</div>
      </div>
    );
  },
  meta() {
    return {
      title: "Remix Error: Route Not Found",
      description: "There was an error rendering this page"
    };
  }
};

export default defaultRouteModule;
