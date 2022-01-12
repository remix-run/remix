import { useParams } from "react-router-dom";

export default function Product() {
  const params = useParams();

  return (
    <main>
      <h2>Product {params.productId}</h2>
    </main>
  );
}
