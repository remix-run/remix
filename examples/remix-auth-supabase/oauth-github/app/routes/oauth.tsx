import { useEffect } from "react";
import type { ActionFunction } from "remix";
import { useSubmit } from "remix";
import { authenticator } from "~/auth.server";
import { supabaseClient } from "~/supabase";

export const action: ActionFunction = async ({ request }) => {
  await authenticator.authenticate("sb-oauth", request, {
    successRedirect: "/private",
    failureRedirect: "/login"
  });
};

export default function OAuth() {
  const submit = useSubmit();

  useEffect(() => {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        const formData = new FormData();
        formData.append("session", JSON.stringify(session));

        submit(formData, { method: "post" });
        supabaseClient.auth.signOut();
      }
    });
  }, [submit]);

  return null;
}
