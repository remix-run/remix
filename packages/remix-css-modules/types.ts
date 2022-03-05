/**
 * Many of these types were copied from @parcel/css and modified slightly for
 * our needs. Some of this data will end up in the assets manifest but we don't
 * want more than we need.
 */

export type CssModuleExports = {
  [name: string]: CssModuleExport;
};

export interface CssModuleExport {
  name: string;
  composes: CssModuleReference[];
}

export type CssModuleReference =
  | LocalCssModuleReference
  | GlobalCssModuleReference
  | DependencyCssModuleReference;

export interface LocalCssModuleReference {
  type: "local";
  name: string;
}

export interface GlobalCssModuleReference {
  type: "global";
  name: string;
}

export interface DependencyCssModuleReference {
  type: "dependency";
  name: string;
  /** The dependency specifier for the referenced file. */
  specifier: string;
}

export type Dependency = ImportDependency | UrlDependency;

export interface ImportDependency {
  type: "import";
  /** The url of the `@import` dependency. */
  url: string;
  /** The media query for the `@import` rule. */
  media: string | null;
  /** The `supports()` query for the `@import` rule. */
  supports: string | null;
  /** The source location where the `@import` rule was found. */
  loc: SourceLocation;
}

export interface UrlDependency {
  type: "url";
  /** The url of the dependency. */
  url: string;
  /** The source location where the `url()` was found. */
  loc: SourceLocation;
  /** The placeholder that the url was replaced with. */
  placeholder: string;
}

interface SourceLocation {
  /** The file path in which the dependency exists. */
  filePath: string;
  /** The start location of the dependency. */
  start: {
    line: number;
    column: number;
  };
  /** The end location (inclusive) of the dependency. */
  end: {
    line: number;
    column: number;
  };
}
