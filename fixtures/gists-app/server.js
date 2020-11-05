const express = require("express");
const morgan = require("morgan");
const session = require("express-session");
const { createRequestHandler } = require("@remix-run/express");

const port = process.env.PORT || 3000;

let app = express();

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.static("public"));
app.use(session({ secret: "remix", resave: false, saveUninitialized: false }));

// serverside redirect
app.get("/user-gists/:username", (req, res) => {
  res.redirect(301, `/gists/${req.params.username}`);
});

function createExpressRemixSession(req) {
  function set(name, value) {
    req.session[name] = value;
  }

  function get(name) {
    return req.session[name];
  }

  function destroy(name) {
    delete req.session[name];
  }

  function consume(name) {
    let value = get(name);
    destroy(name);
    return value;
  }

  return { set, get, delete: destroy, consume };
}

app.all(
  "*",
  createRequestHandler({
    getLoadContext(req, res) {
      let session = createExpressRemixSession(req);
      return { userId: 4, session };
    }
  })
);

app.listen(port, () => {
  console.log(`Gists app running on port ${port}`);
});
