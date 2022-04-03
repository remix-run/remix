export const migrationOptions = [
  {
    name: "replace-remix-imports: Replaces `remix` package import statements with specific `@remix-run/*` package import statements.",
    value: "replace-remix-imports",
  },
] as const;
export type Migration = typeof migrationOptions[number]["value"];
