export default function ExceptionsIndex() {
  throw new Error("GAHHHH!!! KABOOM! 🧨");
}

export function ErrorBoundary({ error }) {
  return (
    <div>
      <h2>OH NOES!</h2>
      <p>
        There was an error at this specific route. The parent still renders
        cause it was fine, but this one blew up.
      </p>
      <pre>{error.message}</pre>
    </div>
  );
}
