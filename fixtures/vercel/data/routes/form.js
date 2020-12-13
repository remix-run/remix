const { json, redirect, parseFormBody } = require("@remix-run/data");

exports.action = async ({ request, session }) => {
  let body = await parseFormBody(request);

  if (body.slow === "on") {
    await new Promise(res => setTimeout(res, 2000));
  }

  // don't have sessions in vercel figured out yet, so use query params
  return redirect(`/form?${body.toString()}`);
};

exports.loader = ({ request }) => {
  let url = new URL(request.url);
  let body = Object.fromEntries(url.searchParams);
  return json({ body: body });
};
