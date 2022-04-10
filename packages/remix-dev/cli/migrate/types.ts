export type Flags = {
  debug?: boolean;
  dry?: boolean;
  force?: boolean;
  print?: boolean;
  runInBand?: boolean;
};

export type MigrationFunction = (args: {
  projectDir: string;
  flags: Flags;
}) => Promise<void>;

export interface Migration {
  id: string;
  description: string;
  function: MigrationFunction;
}
