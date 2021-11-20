import type { ActionFunction } from "remix";
import { logout } from "~/utils/session.server";

export let action: ActionFunction = async ({ request }) => {
  return logout(request);
};
