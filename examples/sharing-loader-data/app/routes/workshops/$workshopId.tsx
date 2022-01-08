import type { LoaderFunction } from "remix";
import { useParams, useMatches, useCatch } from "remix";
import type { Workshop } from "~/data.server";
import { getWorkshops } from "~/data.server";

export const loader: LoaderFunction = async ({ params }) => {
  const { workshopId } = params;
  const workshops = await getWorkshops();
  const workshop = workshops.find(w => w.id === workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }

  // notice that the benefit here is that even though the backend needs
  // to read into our database to handle the 404 case, we don't have to send
  // the client the workshop data in this route because we sent that to the client
  // in the parent route already and we can access that data via useMatches.
  return null;
};

export default function WorkshopRoute() {
  const parentData = useMatches().find(m => m.pathname === "/workshops")
    ?.data as {
    workshops: Array<Workshop>;
  };
  const params = useParams();
  const workshop = parentData.workshops.find(w => w.id === params.workshopId);
  if (!workshop) {
    throw new Error("This should be impossible.");
  }

  return (
    <div>
      <h2>{workshop.title}</h2>
      <p>{workshop.description}</p>
    </div>
  );
}

export function CatchBoundary() {
  const caught = useCatch();
  const params = useParams();
  if (caught.status === 404) {
    return <div>Workshop with ID "{params.workshopId}" not found.</div>;
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}
