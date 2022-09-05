import { Link } from "@remix-run/react";

const linkClass =
  "transition-all duration-300 opacity-75 hover:(opacity-100 text-blue-500)";

export default function Index() {
  return (
    <main className="py-16 px-4 max-w-screen-md mx-auto w-full">
      <h1 className="text-4xl font-light mb-6">This works</h1>
      <Link to="/" className={linkClass}>
        Back to Home
      </Link>
    </main>
  );
}
