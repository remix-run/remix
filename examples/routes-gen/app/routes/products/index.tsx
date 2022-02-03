import { Link } from "react-router-dom";
import type { LoaderFunction } from "remix";
import { useLoaderData } from "remix";
import { route } from "routes-gen";

type Post = {
  id: string;
  title: string;
};

const posts: Post[] = [
  {
    id: "1",
    title: "Cool Product"
  },
  {
    id: "2",
    title: "Best Product"
  }
];

export const loader: LoaderFunction = () => {
  return posts;
};

export default function Products() {
  const data = useLoaderData<Post[]>();

  return (
    <main>
      <h2>Products</h2>
      <ul>
        {data.map(product => (
          <li key={product.id}>
            <Link
              to={route("/products/:productId", {
                productId: product.id
              })}
            >
              {product.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
