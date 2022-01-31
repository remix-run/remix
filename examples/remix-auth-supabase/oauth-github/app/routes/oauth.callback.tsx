import { useEffect } from "react";
import type { ActionFunction } from "remix";
import { useSubmit } from "remix";
import { authenticator } from "~/auth.server";
import { supabaseClient } from "~/supabase.client";

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
        // if you don't want to keep supabase session in browser, delete it
        // don't use supabaseClient.auth.signOut(), it invalidates refresh token
        localStorage.removeItem("supabase.auth.token");
      }
    });
  }, [submit]);

  return null;
}
