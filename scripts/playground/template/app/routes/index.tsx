import type { V2_MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { useOptionalUser } from "~/utils";

export const meta: V2_MetaFunction = () => {
  return [{ title: "Remix Notes" }];
};

export default function Index() {
  let user = useOptionalUser();
  return (
    <main>
      <div className="flex flex-col justify-center items-center gap-12 mt-12">
        <h1 className="text-3xl font-bold">Remix Playground</h1>
        <div>
          {user ? (
            <Link
              to="/notes"
              className="rounded-md border border-transparent bg-white px-4 py-3 text-base font-medium text-blue-700 shadow-sm hover:bg-blue-50 sm:px-8"
            >
              View Notes for {user.email}
            </Link>
          ) : (
            <div className="flex gap-5">
              <Link
                to="/join"
                className="rounded-md border border-blue-500 bg-white px-4 py-3 text-base font-medium text-blue-700 shadow-sm hover:bg-blue-50 sm:px-8"
              >
                Sign up
              </Link>
              <Link
                to="/login"
                className="rounded-md bg-blue-500 px-4 py-3 font-medium text-white hover:bg-blue-600"
              >
                Log In
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
