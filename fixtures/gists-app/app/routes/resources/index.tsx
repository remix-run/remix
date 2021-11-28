import { Link } from "remix";

export default function Resources() {
  return (
    <section>
      <ul>
        <li>
          <Link to="/resources/redirect">Redirect back home</Link>
        </li>
        <li>
          <Link to="/resources/settings">Settings</Link>
        </li>
        <li>
          <Link data-testid="csr" to="/resources/theme-css">
            CSR to resource
          </Link>
        </li>
        <li>
          <a href="/resources/theme-css">Theme CSS</a>
        </li>
      </ul>
    </section>
  );
}
