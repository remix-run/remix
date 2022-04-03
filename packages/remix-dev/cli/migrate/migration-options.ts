export const migrationOptions = [
  {
    name: "replace-remix-imports: Replaces `remix` package import statements with specific `@remix-run/*` package import statements.",
    value: "replace-remix-imports",
  },
] as const;
export type Migration = typeof migrationOptions[number]["value"];
export const isMigration = (migration: string): migration is Migration => {
  return (migrationOptions.map((m) => m.value) as readonly string[]).includes(
    migration
  );
};
