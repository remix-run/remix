const { json } = require("@remix-run/loader");

module.exports = () => {
  return json(
    {
      users: [
        { id: "ryanflorence", name: "Ryan Florence" },
        { id: "mjackson", name: "Michael Jackson" }
      ]
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60"
      }
    }
  );
};
