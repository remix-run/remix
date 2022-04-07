export const handle = { hydrate: true };

export default function Screen() {
  return (
    <>
      <h1>Reload to see how it loaded JS</h1>
      <blockquote>Tip: Inspect the Network tab to see it has JS</blockquote>
      <button type="button" onClick={() => alert("It has JS!")}>
        Click me to see JS has loaded
      </button>
      <a href="/">Go back</a>
    </>
  );
}
