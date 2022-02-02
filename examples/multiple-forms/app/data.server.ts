import fs from "fs/promises";

export type Invitation = { id: string; email: string; sentTime: number };
export async function getInvitations(): Promise<Array<Invitation>> {
  const data = JSON.parse(await fs.readFile("./data.json", "utf8"));
  return data.invitations;
}
export async function sendInvitation(email: Invitation["email"]) {
  const invitations = await getInvitations();
  invitations.push({
    id: Math.random().toString(32).slice(2),
    email,
    sentTime: Date.now()
  });
  console.log(`Sending invitation to ${email}`);
  await writeInvitations(invitations);
}

async function writeInvitations(invitations: Array<Invitation>) {
  return fs.writeFile("./data.json", JSON.stringify({ invitations }, null, 2));
}

export async function deleteInvitiation(invitation: Invitation) {
  const invitations = await getInvitations();
  await writeInvitations(invitations.filter(i => i.id !== invitation.id));
}

export async function resendInvitation(invite: Invitation) {
  console.log(`Resending invitation to ${invite.email}`);
  const invitations = await getInvitations();
  const invitation = invitations.find(i => i.id === invite.id);
  if (!invitation) {
    throw new Error("Missing invitation");
  }
  invitation.sentTime = Date.now();
  await writeInvitations(invitations);
}
