import { Link, Outlet, json, useLoaderData } from "remix";
import type { LoaderFunction } from "remix";
import type { Workshop } from "~/data.server";
import { getWorkshops } from "~/data.server";

type LoaderData = { workshops: Array<Workshop> };

export const loader: LoaderFunction = async () => {
  return json<LoaderData>({
    workshops: await getWorkshops()
  });
};

export default function Workshops() {
  const data = useLoaderData<LoaderData>();

  return (
    <div>
      <h1>There are {data.workshops.length} workshops</h1>
      <ul>
        {data.workshops.map(workshop => (
          <li key={workshop.id}>
            <Link to={workshop.id}>{workshop.title}</Link>
          </li>
        ))}
      </ul>
      <Outlet />
      <Link to="/">Go home</Link>
    </div>
  );
}
