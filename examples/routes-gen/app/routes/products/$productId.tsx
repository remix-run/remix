import { useParams } from "react-router-dom";
import type { RouteParams } from "routes-gen";

export default function Product() {
  const params = useParams<RouteParams["/products/:productId"]>();

  return (
    <main>
      <h2>Product {params.productId}</h2>
    </main>
  );
}
