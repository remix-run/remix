const { redirect } = require("@remix-run/data");

exports.loader = () => {
  return fetch("https://api.github.com/gists");
};

exports.action = async ({ request }) => {
  let body = new URLSearchParams(await request.text());

  let fileName = body.get("fileName");
  let content = body.get("content");

  await fetch("https://api.github.com/gists", {
    method: "post",
    body: JSON.stringify({
      description: "Created from Remix Form!",
      public: true,
      files: { [fileName]: { content } }
    }),
    headers: {
      "content-type": "application/json",
      authorization: "token 7dd12d0c5824ed0b42add15b296fa2d6522e870b"
    }
  });

  return redirect("/gists");
};
