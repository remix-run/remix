import { Link } from "react-router-dom";
import { route } from "routes-gen";

export default function Index() {
  return (
    <main>
      <h2>Homepage</h2>
      <ul>
        <li>
          <Link to={route("/products")}>Products</Link>
        </li>
      </ul>
    </main>
  );
}
