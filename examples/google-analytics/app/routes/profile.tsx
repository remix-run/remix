import type { MetaFunction } from "remix";

export const meta: MetaFunction = () => {
  return { title: "Profile" };
};

export default function Profile() {
  return (
    <div>
      <h1>This is a profile page</h1>
    </div>
  );
}
