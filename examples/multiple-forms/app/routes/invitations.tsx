import { Form, json, useLoaderData, redirect } from "remix";
import type { LoaderFunction, ActionFunction } from "remix";
import type { Invitation} from "~/data.server";
import { sendInvitation } from "~/data.server";
import {
  getInvitations,
  resendInvitation,
  deleteInvitiation
} from "~/data.server";

type LoaderData = { invitations: Array<Invitation> };

export const loader: LoaderFunction = async () => {
  return json<LoaderData>({
    invitations: await getInvitations()
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  if (formData.get("_action") === "send") {
    const email = formData.get("email");
    if (typeof email !== "string") {
      // you'll want to handle this in a real app...
      throw new Error("make sure you implement validation");
    }

    await sendInvitation(email);
    return redirect(request.url);
  }

  const invitationId = formData.get("invitationId");
  if (!invitationId) {
    // you'll want to handle this in a real app...
    throw new Error("make sure you implement validation");
  }
  const invitiations = await getInvitations();
  const invitation = invitiations.find(i => i.id === invitationId);
  if (!invitation) {
    // you'll want to handle this in a real app...
    throw new Error("make sure you implement validation");
  }

  if (formData.get("_action") === "resend") {
    await resendInvitation(invitation);
    return redirect(request.url);
  }
  if (formData.get("_action") === "delete") {
    await deleteInvitiation(invitation);
    return redirect(request.url);
  }
};

export default function Index() {
  const data = useLoaderData<LoaderData>();

  return (
    <div>
      <h1>Invitations:</h1>
      <ul>
        {data.invitations.map(invitation => (
          <li key={invitation.id}>
            <Form method="post">
              <input type="hidden" name="invitationId" value={invitation.id} />
              {`${invitation.email} last sent ${new Date(
                invitation.sentTime
              ).toLocaleTimeString()}: `}
              <button type="submit" name="_action" value="resend">
                Resend
              </button>
              <button type="submit" name="_action" value="delete">
                Delete
              </button>
            </Form>
          </li>
        ))}
      </ul>
      <Form method="post">
        Send a new invitation:
        <br />
        <label>
          Email: <input type="email" name="email" />
        </label>
        <button type="submit" name="_action" value="send">
          Send
        </button>
      </Form>
    </div>
  );
}
