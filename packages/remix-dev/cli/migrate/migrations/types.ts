export type TransformArgs = {
  projectDir: string;
  flags: {
    dry?: boolean;
    force?: boolean;
    print?: boolean;
    runInBand?: boolean;
  };
};
export type Transform = (args: TransformArgs) => void | Promise<void>;
