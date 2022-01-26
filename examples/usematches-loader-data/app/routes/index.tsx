import useUser from "~/useUser";

export default function Index() {
  const user = useUser();

  return (
    <div>
      <h1>Index Page</h1>
      <p>Current user (accessed via useMatches): {user?.name}</p>
    </div>
  );
}
