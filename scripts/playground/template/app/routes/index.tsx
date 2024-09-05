import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { useOptionalUser } from "~/utils";

export const meta: MetaFunction = () => {
  return [{ title: "Remix Notes" }];
};

export default function Index() {
  let user = useOptionalUser();
  return (
    <main>
      <div className="flex flex-col items-center justify-center gap-12 mt-12">
        <h1 className="text-3xl font-bold">Remix Playground</h1>
        <div>
          {user ? (
            <Link
              to="/notes"
              className="px-4 py-3 text-base font-medium text-blue-700 bg-white border border-transparent rounded-md shadow-sm hover:bg-blue-50 sm:px-8"
            >
              View Notes for {user.email}
            </Link>
          ) : (
            <div className="flex gap-5">
              <Link
                to="/join"
                className="px-4 py-3 text-base font-medium text-blue-700 bg-white border border-blue-500 rounded-md shadow-sm hover:bg-blue-50 sm:px-8"
              >
                Sign up
              </Link>
              <Link
                to="/login"
                className="px-4 py-3 font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
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
