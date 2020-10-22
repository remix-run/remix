const { json } = require("@remix-run/loader");

module.exports = () => {
  let data = {
    users: [
      { id: "ryanflorence", name: "Ryan Florence" },
      { id: "mjackson", name: "Michael Jackson" }
    ]
  };

  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
};
