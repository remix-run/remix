const { json, redirect, parseFormBody } = require("@remix-run/data");

exports.action = async ({ request, session }) => {
  let body = Object.fromEntries(await parseFormBody(request));

  session.flash("body", JSON.stringify(body));

  if (body.slow === "on") {
    await new Promise(res => setTimeout(res, 2000));
  }

  return redirect("/methods");
};

exports.loader = ({ session }) => {
  return json({
    body: JSON.parse(session.get("body") || null)
  });
};
