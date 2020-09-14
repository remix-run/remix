// import { Redirect, Rewrite } from '@remix-run/core'

module.exports = async function ({ params }) {
  if (process.env.NODE_ENV === "test") {
    return Promise.resolve(fakeGists);
  } else {
    let { username } = params;
    let res = await fetch(`https://api.github.com/users/${username}/gists`);

    // if (res.status === 404) {
    //   throw new Redirect('/some/other/place', 301)
    //   throw new Rewrite(`/users/${params.username}/404`, 404)
    //   throw new NotFound();
    //   throw new Error('boom!')
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
