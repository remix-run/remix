declare module "routes-gen" {
  export function route<
    T extends
      | ["/products/:productId", { productId: string }]
      | ["/products"]
      | ["/"]
  >(...args: T): typeof args[0];
}
