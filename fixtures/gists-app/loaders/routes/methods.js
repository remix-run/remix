const { json, redirect, parseFormBody } = require("@remix-run/loader");

exports.action = async ({ request, context: { session } }) => {
  let body = await parseFormBody(request);

  session.set("body", Object.fromEntries(body));

  if (body.slow === "on") {
    await new Promise(res => setTimeout(res, 2000));
  }

  return redirect("/methods");
};

exports.loader = ({ context: { session } }) => {
  let body = session.consume("body");
  return json({ body });
};
