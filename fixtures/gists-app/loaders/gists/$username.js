import { NotFound } from "@remix-run/core";

module.exports = async function ({ params }) {
  let { username } = params;

  if (process.env.NODE_ENV === "test") {
    if (username === "_why") {
      return new NotFound();
    }

    return Promise.resolve(fakeGists);
  } else {
    let res = await fetch(`https://api.github.com/users/${username}/gists`);

    // if (res.status === 404) {
    //   throw new Error("boom!"); // global 500.js

    //   return new StatusCode(404); // global 404.js
    //   return statusCode(404); // global 404.js

    //   return new Redirect("/some/other/place", 301);
    //   return redirect("/some/other/place", 301);
    // }

    return res.json();
  }
};

let fakeGists = [
  {
    url: "https://api.github.com/gists/610613b54e5b34f8122d1ba4a3da21a9",
    id: "610613b54e5b34f8122d1ba4a3da21a9",
    files: {
      "remix-server.jsx": {
        filename: "remix-server.jsx"
      }
    },
    owner: {
      login: "ryanflorence",
      id: 100200,
      avatar_url: "https://avatars0.githubusercontent.com/u/100200?v=4"
    }
  }
];
