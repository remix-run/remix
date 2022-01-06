export default function Index() {
  return (
    <div className="ml-6 mt-3">
      <h1 className="text-2xl mb-1">Welcome to Remix (With TailwindCSS)</h1>
      <ul>
        <li>
          <a
            className="text-blue-700 underline"
            target="_blank"
            href="https://remix.run/tutorials/blog"
            rel="noreferrer"
          >
            15m Quickstart Blog Tutorial
          </a>
        </li>
        <li>
          <a
            className="text-blue-700 underline"
            target="_blank"
            href="https://remix.run/tutorials/jokes"
            rel="noreferrer"
          >
            Deep Dive Jokes App Tutorial
          </a>
        </li>
        <li>
          <a
            className="text-blue-700 underline"
            target="_blank"
            href="https://remix.run/docs"
            rel="noreferrer"
          >
            Remix Docs
          </a>
        </li>
      </ul>
    </div>
  );
}
