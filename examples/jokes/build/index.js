var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// <stdin>
__export(exports, {
  assets: () => import_assets.default,
  entry: () => entry,
  routes: () => routes
});

// node_modules/@remix-run/dev/compiler/shims/react.ts
var React = __toModule(require("react"));

// app/entry.server.tsx
var entry_server_exports = {};
__export(entry_server_exports, {
  default: () => handleRequest
});
var import_server = __toModule(require("react-dom/server"));
var import_remix = __toModule(require("remix"));
function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  let markup = import_server.default.renderToString(/* @__PURE__ */ React.createElement(import_remix.RemixServer, {
    context: remixContext,
    url: request.url
  }));
  responseHeaders.set("Content-Type", "text/html");
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/root.tsx
var root_exports = {};
__export(root_exports, {
  CatchBoundary: () => CatchBoundary,
  ErrorBoundary: () => ErrorBoundary,
  default: () => App,
  links: () => links
});
var import_remix2 = __toModule(require("remix"));
var import_react_router_dom = __toModule(require("react-router-dom"));

// app/styles/global.css
var global_default = "/build/_assets/global-Y2OJVJXI.css";

// app/styles/global-medium.css
var global_medium_default = "/build/_assets/global-medium-DRHJR3JT.css";

// app/styles/global-large.css
var global_large_default = "/build/_assets/global-large-NKTQAWDZ.css";

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/root.tsx
var links = () => {
  return [
    { rel: "stylesheet", href: global_default },
    {
      rel: "stylesheet",
      href: global_medium_default,
      media: "print, (min-width: 640px)"
    },
    {
      rel: "stylesheet",
      href: global_large_default,
      media: "screen and (min-width: 1024px)"
    }
  ];
};
function Document({
  children,
  title
}) {
  return /* @__PURE__ */ React.createElement("html", {
    lang: "en"
  }, /* @__PURE__ */ React.createElement("head", null, /* @__PURE__ */ React.createElement("meta", {
    charSet: "utf-8"
  }), title ? /* @__PURE__ */ React.createElement("title", null, title) : null, /* @__PURE__ */ React.createElement(import_remix2.Meta, null), /* @__PURE__ */ React.createElement(import_remix2.Links, null)), /* @__PURE__ */ React.createElement("body", null, children, /* @__PURE__ */ React.createElement(import_remix2.Scripts, null), process.env.NODE_ENV === "development" && /* @__PURE__ */ React.createElement(import_remix2.LiveReload, null)));
}
function Footer() {
  return /* @__PURE__ */ React.createElement("footer", null, /* @__PURE__ */ React.createElement(import_remix2.Link, {
    reloadDocument: true,
    to: "/jokes-rss"
  }, "RSS"));
}
function App() {
  return /* @__PURE__ */ React.createElement(Document, null, /* @__PURE__ */ React.createElement(import_react_router_dom.Outlet, null));
}
function CatchBoundary() {
  let caught = (0, import_remix2.useCatch)();
  switch (caught.status) {
    case 401:
    case 404:
      return /* @__PURE__ */ React.createElement(Document, {
        title: `${caught.status} ${caught.statusText}`
      }, /* @__PURE__ */ React.createElement("h1", null, caught.status, " ", caught.statusText), /* @__PURE__ */ React.createElement(Footer, null));
    default:
      throw new Error(`Unexpected caught response with status: ${caught.status}`);
  }
}
function ErrorBoundary({ error }) {
  console.error(error);
  return /* @__PURE__ */ React.createElement(Document, {
    title: "Uh-oh!"
  }, /* @__PURE__ */ React.createElement("h1", null, "App Error"), /* @__PURE__ */ React.createElement("pre", null, error.message), /* @__PURE__ */ React.createElement("p", null, "Replace this UI with what you want users to see when your app throws uncaught errors."), /* @__PURE__ */ React.createElement(Footer, null));
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes[.]rss.tsx
var jokes_rss_exports = {};
__export(jokes_rss_exports, {
  loader: () => loader
});

// app/utils/db.server.ts
var import_client = __toModule(require("@prisma/client"));
var db;
if (process.env.NODE_ENV === "production") {
  db = new import_client.PrismaClient();
  db.$connect();
} else {
  if (!global.__db) {
    global.__db = new import_client.PrismaClient();
    global.__db.$connect();
  }
  db = global.__db;
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes[.]rss.tsx
var loader = async ({ request }) => {
  let jokes = await db.joke.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { jokester: { select: { username: true } } }
  });
  const host = request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");
  if (!host) {
    throw new Error("Could not determine domain URL.");
  }
  const protocol = host.includes("localhost") ? "http" : "https";
  let domain = `${protocol}://${host}`;
  const jokesUrl = `${domain}/jokes`;
  let rssString = `
    <rss xmlns:blogChannel="${jokesUrl}" version="2.0">
      <channel>
        <title>Remix Jokes</title>
        <link>${jokesUrl}</link>
        <description>Some funny jokes</description>
        <language>en-us</language>
        <generator>Kody the Koala</generator>
        <ttl>40</ttl>
        ${jokes.map((joke) => `
            <item>
              <title>${joke.name}</title>
              <description>A funny joke called ${joke.name}</description>
              <author>${joke.jokester.username}</author>
              <pubDate>${joke.createdAt}</pubDate>
              <link>${jokesUrl}/${joke.id}</link>
              <guid>${jokesUrl}/${joke.id}</guid>
            </item>
          `.trim()).join("\n")}
      </channel>
    </rss>
  `.trim();
  return new Response(rssString, {
    headers: {
      "Cache-Control": `public, max-age=${60 * 10} s-maxage=${60 * 60 * 24}`,
      "Content-Type": "application/xml",
      "Content-Length": String(Buffer.byteLength(rssString))
    }
  });
};

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/logout.tsx
var logout_exports = {};
__export(logout_exports, {
  action: () => action
});

// app/utils/session.server.ts
var bcrypt = __toModule(require("bcrypt"));
var import_remix3 = __toModule(require("remix"));
async function register({ username, password }) {
  let passwordHash = await bcrypt.hash(password, 10);
  return db.user.create({
    data: { username, passwordHash }
  });
}
async function login({ username, password }) {
  const user = await db.user.findUnique({ where: { username } });
  if (!user)
    return null;
  const isCorrectPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isCorrectPassword)
    return null;
  return user;
}
var sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}
var { getSession, commitSession, destroySession } = (0, import_remix3.createCookieSessionStorage)({
  cookie: {
    name: "RJ_session",
    secure: true,
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true
  }
});
function getUserSession(request) {
  return getSession(request.headers.get("Cookie"));
}
async function getUserId(request) {
  let session = await getUserSession(request);
  let userId = session.get("userId");
  if (!userId || typeof userId !== "string")
    return null;
  return userId;
}
async function requireUserId(request) {
  let session = await getUserSession(request);
  let userId = session.get("userId");
  if (!userId || typeof userId !== "string")
    throw (0, import_remix3.redirect)("/login");
  return userId;
}
async function getUser(request) {
  let session = await getUserSession(request);
  let userId = session.get("userId");
  if (typeof userId !== "string")
    return null;
  return db.user.findUnique({ where: { id: userId } }).catch(() => Promise.reject(logout(request)));
}
async function logout(request) {
  let session = await getSession(request.headers.get("Cookie"));
  return (0, import_remix3.redirect)("/login", {
    headers: { "Set-Cookie": await destroySession(session) }
  });
}
async function createUserSession(userId, redirectTo) {
  let session = await getSession();
  session.set("userId", userId);
  return (0, import_remix3.redirect)(redirectTo, {
    headers: { "Set-Cookie": await commitSession(session) }
  });
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/logout.tsx
var action = async ({ request }) => {
  return logout(request);
};

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/index.tsx
var routes_exports = {};
__export(routes_exports, {
  default: () => Index,
  headers: () => headers,
  links: () => links2,
  meta: () => meta
});
var import_remix4 = __toModule(require("remix"));

// app/styles/index.css
var styles_default = "/build/_assets/index-LQJHUV2J.css";

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/index.tsx
var meta = () => {
  return {
    title: "Remix: It's funny!",
    description: "Remix jokes app. Learn Remix and laugh at the same time!"
  };
};
var links2 = () => {
  return [{ rel: "stylesheet", href: styles_default }];
};
var headers = () => {
  return {
    "Cache-Control": `public, max-age=${60 * 10}, s-maxage=${60 * 60 * 24 * 30}`
  };
};
function Index() {
  return /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "content"
  }, /* @__PURE__ */ React.createElement("h1", null, "Remix ", /* @__PURE__ */ React.createElement("span", null, "Jokes!")), /* @__PURE__ */ React.createElement("nav", null, /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix4.Link, {
    to: "jokes"
  }, "Read Jokes")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix4.Link, {
    reloadDocument: true,
    to: "/jokes.rss"
  }, "RSS"))))));
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes.tsx
var jokes_exports = {};
__export(jokes_exports, {
  CatchBoundary: () => CatchBoundary2,
  default: () => JokesScreen,
  links: () => links3,
  loader: () => loader2
});
var import_remix5 = __toModule(require("remix"));
var import_remix6 = __toModule(require("remix"));

// app/styles/jokes.css
var jokes_default = "/build/_assets/jokes-SL6K6US3.css";

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes.tsx
var loader2 = async ({ request }) => {
  let jokeListItems = await db.joke.findMany({
    take: 5,
    select: { id: true, name: true }
  });
  let user = await getUser(request);
  let data = {
    jokeListItems,
    user
  };
  return (0, import_remix6.json)(data);
};
var links3 = () => {
  return [{ rel: "stylesheet", href: jokes_default }];
};
function Footer2() {
  return /* @__PURE__ */ React.createElement("footer", {
    className: "jokes-footer"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, /* @__PURE__ */ React.createElement(import_remix6.Link, {
    reloadDocument: true,
    to: "/jokes.rss"
  }, "RSS")));
}
function Header({ user }) {
  return /* @__PURE__ */ React.createElement("header", {
    className: "jokes-header"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, /* @__PURE__ */ React.createElement("h1", {
    className: "home-link"
  }, /* @__PURE__ */ React.createElement(import_remix6.Link, {
    to: "/",
    title: "Remix Jokes",
    "aria-label": "Remix Jokes"
  }, /* @__PURE__ */ React.createElement("span", {
    className: "logo"
  }, "\u{1F92A}"), /* @__PURE__ */ React.createElement("span", {
    className: "logo-medium"
  }, "J\u{1F92A}KES"))), user ? /* @__PURE__ */ React.createElement("div", {
    className: "user-info"
  }, /* @__PURE__ */ React.createElement("span", null, `Hi ${user.username}`), /* @__PURE__ */ React.createElement(import_remix5.Form, {
    action: "/logout",
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "button"
  }, "Logout"))) : /* @__PURE__ */ React.createElement(import_remix6.Link, {
    to: "/login"
  }, "Login")));
}
function Layout({ children }) {
  let data = (0, import_remix6.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", {
    className: "jokes-layout"
  }, /* @__PURE__ */ React.createElement(Header, {
    user: data.user
  }), /* @__PURE__ */ React.createElement("main", {
    className: "jokes-main"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, children)), /* @__PURE__ */ React.createElement(Footer2, null));
}
function JokesScreen() {
  let data = (0, import_remix6.useLoaderData)();
  return /* @__PURE__ */ React.createElement(Layout, null, /* @__PURE__ */ React.createElement("div", {
    className: "jokes-list"
  }, data.jokeListItems.length ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(import_remix6.Link, {
    to: "."
  }, "Get a random joke"), /* @__PURE__ */ React.createElement("p", null, "Here are a few more jokes to check out:"), /* @__PURE__ */ React.createElement("ul", null, data.jokeListItems.map(({ id, name }) => /* @__PURE__ */ React.createElement("li", {
    key: id
  }, /* @__PURE__ */ React.createElement(import_remix6.Link, {
    to: id
  }, name)))), /* @__PURE__ */ React.createElement(import_remix6.Link, {
    to: "new",
    className: "button"
  }, "Add your own")) : null), /* @__PURE__ */ React.createElement("div", {
    className: "jokes-outlet"
  }, /* @__PURE__ */ React.createElement(import_remix6.Outlet, null)));
}
function CatchBoundary2() {
  let caught = (0, import_remix6.useCatch)();
  switch (caught.status) {
    case 401:
    case 404:
      return /* @__PURE__ */ React.createElement(Layout, null, /* @__PURE__ */ React.createElement("h1", null, caught.status, ": ", caught.statusText));
    default:
      throw new Error(`Unexpected caught response with status: ${caught.status}`);
  }
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes/$jokeId.tsx
var jokeId_exports = {};
__export(jokeId_exports, {
  CatchBoundary: () => CatchBoundary3,
  action: () => action2,
  default: () => JokeRoute,
  headers: () => headers2,
  loader: () => loader3,
  meta: () => meta2
});
var import_remix7 = __toModule(require("remix"));
var import_react_router_dom2 = __toModule(require("react-router-dom"));
var meta2 = ({ data }) => {
  return {
    title: `"${data.joke.name}" joke`,
    description: `Enjoy the "${data.joke.name}" joke and much more`
  };
};
var loader3 = async ({ request, params }) => {
  let userId = await getUserId(request);
  let joke = await db.joke.findUnique({ where: { id: params.jokeId } });
  if (!joke) {
    throw new Response("What a joke! Not found.", { status: 404 });
  }
  let data = { joke, isOwner: userId === joke.jokesterId };
  return (0, import_remix7.json)(data, {
    headers: {
      "Cache-Control": `private, max-age=${60 * 5}`
    }
  });
};
var headers2 = ({ loaderHeaders }) => {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control") ?? ""
  };
};
var action2 = async ({ request, params }) => {
  if (request.method === "DELETE") {
    let userId = await requireUserId(request);
    let joke = await db.joke.findUnique({ where: { id: params.jokeId } });
    if (!joke) {
      throw new Response("Can't delete what does not exist", { status: 404 });
    }
    if (joke.jokesterId !== userId) {
      throw new Response("Pssh, nice try. That's not your joke", {
        status: 401
      });
    }
    await db.joke.delete({ where: { id: params.jokeId } });
    return (0, import_remix7.redirect)("/jokes");
  }
};
function JokeRoute() {
  let data = (0, import_remix7.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "Here's your hilarious joke:"), /* @__PURE__ */ React.createElement("p", null, data.joke.content), /* @__PURE__ */ React.createElement(import_remix7.Link, {
    to: "."
  }, data.joke.name, " Permalink"), data.isOwner ? /* @__PURE__ */ React.createElement(import_remix7.Form, {
    method: "delete"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "button"
  }, "Delete")) : null);
}
function CatchBoundary3() {
  let caught = (0, import_remix7.useCatch)();
  let params = (0, import_react_router_dom2.useParams)();
  switch (caught.status) {
    case 404: {
      return /* @__PURE__ */ React.createElement("div", null, "Huh? What the heck is ", params.jokeId, "?");
    }
    case 401: {
      return /* @__PURE__ */ React.createElement("div", null, "Sorry, but ", params.jokeId, " is not your joke.");
    }
    default: {
      throw new Error(`Unhandled error: ${caught.status}`);
    }
  }
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes/index.tsx
var jokes_exports2 = {};
__export(jokes_exports2, {
  CatchBoundary: () => CatchBoundary4,
  ErrorBoundary: () => ErrorBoundary2,
  default: () => JokesIndexRoute,
  loader: () => loader4
});
var import_remix8 = __toModule(require("remix"));
var loader4 = async () => {
  const count = await db.joke.count();
  const randomRowNumber = Math.floor(Math.random() * count);
  let [randomJoke] = await db.joke.findMany({ take: 1, skip: randomRowNumber });
  if (!randomJoke) {
    throw new Response("No jokes to be found!", { status: 404 });
  }
  let data = { randomJoke };
  return (0, import_remix8.json)(data);
};
function JokesIndexRoute() {
  let data = (0, import_remix8.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "Here's a random joke:"), /* @__PURE__ */ React.createElement("p", null, data.randomJoke.content), /* @__PURE__ */ React.createElement(import_remix8.Link, {
    to: data.randomJoke.id
  }, '"', data.randomJoke.name, '" Permalink'));
}
function CatchBoundary4() {
  let caught = (0, import_remix8.useCatch)();
  switch (caught.status) {
    case 404: {
      return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "There are no jokes to display."), /* @__PURE__ */ React.createElement(import_remix8.Link, {
        to: "new"
      }, "Add your own"));
    }
    default: {
      throw new Error(`Unexpected caught response with status: ${caught.status}`);
    }
  }
}
function ErrorBoundary2({ error }) {
  console.error(error);
  return /* @__PURE__ */ React.createElement("div", null, "I did a whoopsies.");
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes/new.tsx
var new_exports = {};
__export(new_exports, {
  action: () => action3,
  default: () => JokeScreen,
  loader: () => loader5
});
var import_remix9 = __toModule(require("remix"));
var import_remix10 = __toModule(require("remix"));
var import_remix11 = __toModule(require("remix"));
function validateJokeContent(content) {
  if (typeof content !== "string" || content.length < 4) {
    return `That joke is too short`;
  }
}
function validateJokeName(name) {
  if (typeof name !== "string" || name.length < 2) {
    return `That joke's name is too short`;
  }
}
var loader5 = async ({ request }) => {
  let userId = await getUserId(request);
  let data = { loggedIn: Boolean(userId) };
  return (0, import_remix10.json)(data);
};
var action3 = async ({
  request
}) => {
  const userId = await requireUserId(request);
  let { name, content } = Object.fromEntries(await request.formData());
  if (typeof name !== "string" || typeof content !== "string") {
    return { formError: `Form not submitted correctly.` };
  }
  let fieldErrors = {
    name: validateJokeName(name),
    content: validateJokeContent(content)
  };
  let fields = { name, content };
  if (Object.values(fieldErrors).some(Boolean))
    return { fieldErrors, fields };
  let joke = await db.joke.create({ data: __spreadProps(__spreadValues({}, fields), { jokesterId: userId }) });
  return (0, import_remix11.redirect)(`/jokes/${joke.id}`);
};
function JokeScreen() {
  var _a, _b, _c, _d, _e, _f, _g;
  let data = (0, import_remix10.useLoaderData)();
  let actionData = (0, import_remix11.useActionData)();
  if (!data.loggedIn) {
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "You must be logged in to create a joke."), /* @__PURE__ */ React.createElement(import_remix9.Link, {
      to: "/login"
    }, "Login"));
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "Add your own hilarious joke"), /* @__PURE__ */ React.createElement(import_remix11.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", null, "Name:", " ", /* @__PURE__ */ React.createElement("input", {
    type: "text",
    defaultValue: (_a = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _a.name,
    name: "name",
    "aria-describedby": ((_b = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _b.name) ? "name-error" : void 0
  })), ((_c = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _c.name) ? /* @__PURE__ */ React.createElement("p", {
    className: "form-validation-error",
    role: "alert",
    id: "name-error"
  }, (_d = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _d.name) : null), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", null, "Content:", " ", /* @__PURE__ */ React.createElement("textarea", {
    defaultValue: (_e = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _e.content,
    name: "content"
  })), ((_f = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _f.content) ? /* @__PURE__ */ React.createElement("p", {
    className: "form-validation-error",
    role: "alert",
    id: "content-error"
  }, (_g = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _g.content) : null), /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "button"
  }, "Add")));
}

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/login.tsx
var login_exports = {};
__export(login_exports, {
  action: () => action4,
  default: () => Login,
  headers: () => headers3,
  links: () => links4,
  meta: () => meta3
});
var import_remix12 = __toModule(require("remix"));

// app/styles/login.css
var login_default = "/build/_assets/login-HYWVTNPH.css";

// route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/login.tsx
var meta3 = () => {
  return {
    title: "Remix Jokes | Login",
    description: "Login to submit your own jokes to Remix Jokes!"
  };
};
var links4 = () => {
  return [{ rel: "stylesheet", href: login_default }];
};
var headers3 = () => {
  return {
    "Cache-Control": `public, max-age=${60 * 10}, s-maxage=${60 * 60 * 24 * 30}`
  };
};
function validateUsername(username) {
  if (typeof username !== "string" || username.length < 3) {
    return `Usernames must be at least 3 characters long`;
  }
}
function validatePassword(password) {
  if (typeof password !== "string" || password.length < 6) {
    return `Passwords must be at least 6 characters long`;
  }
}
var action4 = async ({
  request
}) => {
  let { loginType, username, password } = Object.fromEntries(await request.formData());
  if (typeof loginType !== "string" || typeof username !== "string" || typeof password !== "string") {
    return { formError: `Form not submitted correctly.` };
  }
  let fields = { loginType, username, password };
  let fieldErrors = {
    username: validateUsername(username),
    password: validatePassword(password)
  };
  if (Object.values(fieldErrors).some(Boolean))
    return { fieldErrors, fields };
  switch (loginType) {
    case "login": {
      const user = await login({ username, password });
      if (!user) {
        return {
          fields,
          formError: `Username/Password combination is incorrect`
        };
      }
      return createUserSession(user.id, "/jokes");
    }
    case "register": {
      let userExists = await db.user.findFirst({ where: { username } });
      if (userExists) {
        return {
          fields,
          formError: `User with username ${username} already exists`
        };
      }
      const user = await register({ username, password });
      if (!user) {
        return {
          fields,
          formError: `Something went wrong trying to create a new user.`
        };
      }
      return createUserSession(user.id, "/jokes");
    }
    default: {
      return { fields, formError: `Login type invalid` };
    }
  }
};
function Login() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const actionData = (0, import_remix12.useActionData)();
  return /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "content",
    "data-light": ""
  }, /* @__PURE__ */ React.createElement("h1", null, "Login"), /* @__PURE__ */ React.createElement(import_remix12.Form, {
    method: "post",
    "aria-describedby": (actionData == null ? void 0 : actionData.formError) ? "form-error-message" : void 0
  }, /* @__PURE__ */ React.createElement("fieldset", null, /* @__PURE__ */ React.createElement("legend", {
    className: "sr-only"
  }, "Login or Register?"), /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement("input", {
    type: "radio",
    name: "loginType",
    value: "login",
    defaultChecked: !((_a = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _a.loginType) || ((_b = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _b.loginType) === "login"
  }), " ", "Login"), /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement("input", {
    type: "radio",
    name: "loginType",
    value: "register",
    defaultChecked: ((_c = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _c.loginType) === "register"
  }), " ", "Register")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", {
    htmlFor: "username-input"
  }, "Username"), /* @__PURE__ */ React.createElement("input", {
    type: "text",
    id: "username-input",
    name: "username",
    defaultValue: (_d = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _d.username,
    "aria-invalid": !!((_e = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _e.username) || void 0,
    "aria-describedby": ((_f = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _f.username) ? "username-error" : void 0
  }), ((_g = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _g.username) ? /* @__PURE__ */ React.createElement("p", {
    className: "form-validation-error",
    role: "alert",
    id: "username-error"
  }, actionData == null ? void 0 : actionData.fieldErrors.username) : null), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", {
    htmlFor: "password-input"
  }, "Password"), /* @__PURE__ */ React.createElement("input", {
    id: "password-input",
    name: "password",
    defaultValue: (_h = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _h.password,
    type: "password",
    "aria-invalid": !!((_i = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _i.password) || void 0,
    "aria-describedby": ((_j = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _j.password) ? "password-error" : void 0
  }), ((_k = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _k.password) ? /* @__PURE__ */ React.createElement("p", {
    className: "form-validation-error",
    role: "alert",
    id: "password-error"
  }, actionData == null ? void 0 : actionData.fieldErrors.password) : null), /* @__PURE__ */ React.createElement("div", {
    id: "form-error-message"
  }, (actionData == null ? void 0 : actionData.formError) ? /* @__PURE__ */ React.createElement("p", {
    className: "form-validation-error",
    role: "alert"
  }, actionData == null ? void 0 : actionData.formError) : null), /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "button"
  }, "Submit"))));
}

// <stdin>
var import_assets = __toModule(require("./assets.json"));
var entry = { module: entry_server_exports };
var routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: root_exports
  },
  "routes/jokes[.]rss": {
    id: "routes/jokes[.]rss",
    parentId: "root",
    path: "jokes.rss",
    index: void 0,
    caseSensitive: void 0,
    module: jokes_rss_exports
  },
  "routes/logout": {
    id: "routes/logout",
    parentId: "root",
    path: "logout",
    index: void 0,
    caseSensitive: void 0,
    module: logout_exports
  },
  "routes/index": {
    id: "routes/index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: routes_exports
  },
  "routes/jokes": {
    id: "routes/jokes",
    parentId: "root",
    path: "jokes",
    index: void 0,
    caseSensitive: void 0,
    module: jokes_exports
  },
  "routes/jokes/$jokeId": {
    id: "routes/jokes/$jokeId",
    parentId: "routes/jokes",
    path: ":jokeId",
    index: void 0,
    caseSensitive: void 0,
    module: jokeId_exports
  },
  "routes/jokes/index": {
    id: "routes/jokes/index",
    parentId: "routes/jokes",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: jokes_exports2
  },
  "routes/jokes/new": {
    id: "routes/jokes/new",
    parentId: "routes/jokes",
    path: "new",
    index: void 0,
    caseSensitive: void 0,
    module: new_exports
  },
  "routes/login": {
    id: "routes/login",
    parentId: "root",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: login_exports
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  assets,
  entry,
  routes
});
//# sourceMappingURL=/build/index.js.map
