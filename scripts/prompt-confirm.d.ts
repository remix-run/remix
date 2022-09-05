declare module "prompt-confirm" {
  class Confirm {
    constructor(question: string, answers?: any, rl?: any);
    run(): Promise<any>;
  }
  export = Confirm;
}
