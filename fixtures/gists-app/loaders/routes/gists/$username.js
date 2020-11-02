const { notFound } = require("@remix-run/loader");

module.exports = function ({ params }) {
  let { username } = params;

  if (username === "mjijackson") {
    return Response.redirect("/gists/mjackson");
  }

  if (username === "_why") {
    return notFound();
  }

  if (username === "DANGER") {
    throw new Error("RUN FOR IT");
  }

  if (process.env.NODE_ENV === "test") {
    return fakeGists;
  }

  return fetch(`https://api.github.com/users/${username}/gists`, {
    compress: false
  });
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
