import { Link } from "remix";

export default function IndexRoute() {
  return (
    <main>
      <h1>Infinite Scroll Demo</h1>

      <p>
        Each way of handling pagination (offset or page based) has two demos.
      </p>

      <p>
        The first shows how to do this in a simple way that's pretty standard
        for this type of user experience you have around the web.
      </p>

      <p>
        The second is a bit more advanced but a much better user experience.
      </p>

      <p>Pick your preferred method.</p>

      <h2>Offset based </h2>
      <ul>
        <li>
          <Link to="/offset/simple">Simple</Link>
        </li>

        <li>
          <Link to="/offset/advanced">Advanced</Link>
        </li>
      </ul>

      <h2>Page based</h2>
      <ul>
        <li>
          <Link to="/page/simple">Simple</Link>
        </li>

        <li>
          <Link to="/page/advanced">Advanced</Link>
        </li>

        <li>
          <Link to="/page/alternative">Alternative</Link>
        </li>
      </ul>
    </main>
  );
}
