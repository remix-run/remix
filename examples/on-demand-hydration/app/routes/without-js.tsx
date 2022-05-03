export default function Screen() {
  return (
    <>
      <h1>Reload to see how it didn't loaded JS</h1>
      <blockquote>
        Tip: Inspect the Network tab to see the lack of JS
      </blockquote>
      <button type="button" onClick={() => alert("It has JS!")}>
        If you click me nothing will happen
      </button>
      <a href="/">Go back</a>
    </>
  );
}
