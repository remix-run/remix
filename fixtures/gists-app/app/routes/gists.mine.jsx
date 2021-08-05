const wait = dur => new Promise(resolve => setTimeout(resolve, dur));

export async function loader({ time }) {
  const result = await time({
    name: "gists-app-routes-gists-mine-jsx-loader",
    fn: () => wait(1000).then(() => "some data")
  });

  return { result };
}

export default function Gists() {
  return (
    <div data-test-id="/gists/mine">
      <h1>My Gists</h1>
    </div>
  );
}
