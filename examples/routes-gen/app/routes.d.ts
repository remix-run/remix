declare module "routes-gen" {
  export type RouteParams = {
    "/products/:productId": { productId: string };
    "/products": {};
    "/": {};
  };

  export function route<
    T extends
      | ["/products/:productId", RouteParams["/products/:productId"]]
      | ["/products"]
      | ["/"]
  >(...args: T): typeof args[0];
}
