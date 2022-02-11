export * from "remix";
declare module "remix" {
  export function json<Data>(
    data: Data,
    init?: number | ResponseInit
  ): Response;
}
