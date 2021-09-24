import type { ComponentType } from "react";

export interface MdxModule {
  default: ComponentType<{}>;
  attributes: any;
  filename: any;
}

export interface MdxGlobModule {
  default: MdxModule[];
  filenames: string[];
}
