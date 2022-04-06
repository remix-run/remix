var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, copyDefault, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && (copyDefault || key !== "default"))
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toESM = (module2, isNodeMode) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", !isNodeMode && module2 && module2.__esModule ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};
var __toCommonJS = /* @__PURE__ */ ((cache) => {
  return (module2, temp) => {
    return cache && cache.get(module2) || (temp = __reExport(__markAsModule({}), module2, 1), cache && cache.set(module2, temp), temp);
  };
})(typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : 0);

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  assets: () => assets_manifest_default,
  entry: () => entry,
  routes: () => routes
});

// node_modules/@remix-run/dev/compiler/shims/react.ts
var React = __toESM(require("react"));

// app/entry.server.tsx
var entry_server_exports = {};
__export(entry_server_exports, {
  default: () => handleRequest
});
var import_react = require("@remix-run/react");
var import_server = require("react-dom/server");
function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  const markup = (0, import_server.renderToString)(/* @__PURE__ */ React.createElement(import_react.RemixServer, {
    context: remixContext,
    url: request.url
  }));
  responseHeaders.set("Content-Type", "text/html");
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/root.tsx
var root_exports = {};
__export(root_exports, {
  default: () => App,
  links: () => links,
  loader: () => loader,
  meta: () => meta
});
var import_node2 = require("@remix-run/node");
var import_react2 = require("@remix-run/react");

// app/styles/tailwind.css
var tailwind_default = "/build/_assets/tailwind-PP3YSVYS.css";

// app/session.server.ts
var import_node = require("@remix-run/node");
var import_tiny_invariant = __toESM(require("tiny-invariant"));

// app/models/user.server.ts
var import_bcryptjs = __toESM(require("bcryptjs"));

// app/db.server.ts
var import_client = require("@prisma/client");
var prisma;
if (false) {
  prisma = new import_client.PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new import_client.PrismaClient();
  }
  prisma = global.__db__;
  prisma.$connect();
}

// app/models/user.server.ts
async function getUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}
async function getUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}
async function createUser(email, password) {
  const hashedPassword = await import_bcryptjs.default.hash(password, 10);
  return prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword
        }
      }
    }
  });
}
async function verifyLogin(email, password) {
  const userWithPassword = await prisma.user.findUnique({
    where: { email },
    include: {
      password: true
    }
  });
  if (!userWithPassword || !userWithPassword.password) {
    return null;
  }
  const isValid = await import_bcryptjs.default.compare(password, userWithPassword.password.hash);
  if (!isValid) {
    return null;
  }
  const _a = userWithPassword, { password: _password } = _a, userWithoutPassword = __objRest(_a, ["password"]);
  return userWithoutPassword;
}

// app/session.server.ts
(0, import_tiny_invariant.default)(process.env.SESSION_SECRET, "SESSION_SECRET must be set");
var sessionStorage = (0, import_node.createCookieSessionStorage)({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: false
  }
});
var USER_SESSION_KEY = "userId";
async function getSession(request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}
async function getUserId(request) {
  const session = await getSession(request);
  const userId = session.get(USER_SESSION_KEY);
  return userId;
}
async function getUser(request) {
  const userId = await getUserId(request);
  if (userId === void 0)
    return null;
  const user = await getUserById(userId);
  if (user)
    return user;
  throw await logout(request);
}
async function requireUserId(request, redirectTo = new URL(request.url).pathname) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw (0, import_node.redirect)(`/login?${searchParams}`);
  }
  return userId;
}
async function createUserSession({
  request,
  userId,
  remember,
  redirectTo
}) {
  const session = await getSession(request);
  session.set(USER_SESSION_KEY, userId);
  return (0, import_node.redirect)(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        maxAge: remember ? 60 * 60 * 24 * 7 : void 0
      })
    }
  });
}
async function logout(request) {
  const session = await getSession(request);
  return (0, import_node.redirect)("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/root.tsx
var links = () => {
  return [{ rel: "stylesheet", href: tailwind_default }];
};
var meta = () => ({
  charset: "utf-8",
  title: "Remix Notes",
  viewport: "width=device-width,initial-scale=1"
});
var loader = async ({ request }) => {
  return (0, import_node2.json)({
    user: await getUser(request)
  });
};
function App() {
  return /* @__PURE__ */ React.createElement("html", {
    lang: "en",
    className: "h-full"
  }, /* @__PURE__ */ React.createElement("head", null, /* @__PURE__ */ React.createElement(import_react2.Meta, null), /* @__PURE__ */ React.createElement(import_react2.Links, null)), /* @__PURE__ */ React.createElement("body", {
    className: "h-full"
  }, /* @__PURE__ */ React.createElement(import_react2.Outlet, null), /* @__PURE__ */ React.createElement(import_react2.ScrollRestoration, null), /* @__PURE__ */ React.createElement(import_react2.Scripts, null), /* @__PURE__ */ React.createElement(import_react2.LiveReload, null)));
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/logout.tsx
var logout_exports = {};
__export(logout_exports, {
  action: () => action,
  loader: () => loader2
});
var import_node3 = require("@remix-run/node");
var action = async ({ request }) => {
  return logout(request);
};
var loader2 = async () => {
  return (0, import_node3.redirect)("/");
};

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/index.tsx
var routes_exports = {};
__export(routes_exports, {
  default: () => Index
});
var import_react5 = require("@remix-run/react");

// app/utils.ts
var import_react3 = require("@remix-run/react");
var import_react4 = require("react");
function useMatchesData(id) {
  const matchingRoutes = (0, import_react3.useMatches)();
  const route = (0, import_react4.useMemo)(() => matchingRoutes.find((route2) => route2.id === id), [matchingRoutes, id]);
  return route == null ? void 0 : route.data;
}
function isUser(user) {
  return user && typeof user === "object" && typeof user.email === "string";
}
function useOptionalUser() {
  const data = useMatchesData("root");
  if (!data || !isUser(data.user)) {
    return void 0;
  }
  return data.user;
}
function useUser() {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error("No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.");
  }
  return maybeUser;
}
function validateEmail(email) {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/index.tsx
function Index() {
  const user = useOptionalUser();
  return /* @__PURE__ */ React.createElement("main", null, /* @__PURE__ */ React.createElement("div", {
    className: "flex flex-col justify-center items-center gap-12 mt-12"
  }, /* @__PURE__ */ React.createElement("h1", {
    className: "text-3xl font-bold"
  }, "Remix Playground"), /* @__PURE__ */ React.createElement("div", null, user ? /* @__PURE__ */ React.createElement(import_react5.Link, {
    to: "/notes",
    className: "rounded-md border border-transparent bg-white px-4 py-3 text-base font-medium text-blue-700 shadow-sm hover:bg-blue-50 sm:px-8"
  }, "View Notes for ", user.email) : /* @__PURE__ */ React.createElement("div", {
    className: "flex gap-5"
  }, /* @__PURE__ */ React.createElement(import_react5.Link, {
    to: "/join",
    className: "rounded-md border border-blue-500 bg-white px-4 py-3 text-base font-medium text-blue-700 shadow-sm hover:bg-blue-50 sm:px-8"
  }, "Sign up"), /* @__PURE__ */ React.createElement(import_react5.Link, {
    to: "/login",
    className: "rounded-md bg-blue-500 px-4 py-3 font-medium text-white hover:bg-blue-600"
  }, "Log In")))));
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/login.tsx
var login_exports = {};
__export(login_exports, {
  action: () => action2,
  default: () => LoginPage,
  loader: () => loader3,
  meta: () => meta2
});
var import_node4 = require("@remix-run/node");
var import_react6 = require("@remix-run/react");
var React2 = __toESM(require("react"));
var loader3 = async ({ request }) => {
  const userId = await getUserId(request);
  if (userId)
    return (0, import_node4.redirect)("/");
  return (0, import_node4.json)({});
};
var action2 = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");
  const remember = formData.get("remember");
  if (!validateEmail(email)) {
    return (0, import_node4.json)({ errors: { email: "Email is invalid" } }, { status: 400 });
  }
  if (typeof password !== "string") {
    return (0, import_node4.json)({ errors: { password: "Password is required" } }, { status: 400 });
  }
  if (password.length < 8) {
    return (0, import_node4.json)({ errors: { password: "Password is too short" } }, { status: 400 });
  }
  const user = await verifyLogin(email, password);
  if (!user) {
    return (0, import_node4.json)({ errors: { email: "Invalid email or password" } }, { status: 400 });
  }
  return createUserSession({
    request,
    userId: user.id,
    remember: remember === "on" ? true : false,
    redirectTo: typeof redirectTo === "string" ? redirectTo : "/notes"
  });
};
var meta2 = () => {
  return {
    title: "Login"
  };
};
function LoginPage() {
  var _a, _b, _c, _d;
  const [searchParams] = (0, import_react6.useSearchParams)();
  const redirectTo = searchParams.get("redirectTo") || "/notes";
  const actionData = (0, import_react6.useActionData)();
  const emailRef = React2.useRef(null);
  const passwordRef = React2.useRef(null);
  React2.useEffect(() => {
    var _a2, _b2, _c2, _d2;
    if ((_a2 = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _a2.email) {
      (_b2 = emailRef.current) == null ? void 0 : _b2.focus();
    } else if ((_c2 = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _c2.password) {
      (_d2 = passwordRef.current) == null ? void 0 : _d2.focus();
    }
  }, [actionData]);
  return /* @__PURE__ */ React2.createElement("div", {
    className: "flex min-h-full flex-col justify-center"
  }, /* @__PURE__ */ React2.createElement("div", {
    className: "mx-auto w-full max-w-md px-8"
  }, /* @__PURE__ */ React2.createElement(import_react6.Form, {
    method: "post",
    className: "space-y-6"
  }, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("label", {
    htmlFor: "email",
    className: "block text-sm font-medium text-gray-700"
  }, "Email address"), /* @__PURE__ */ React2.createElement("div", {
    className: "mt-1"
  }, /* @__PURE__ */ React2.createElement("input", {
    ref: emailRef,
    id: "email",
    required: true,
    autoFocus: true,
    name: "email",
    type: "email",
    autoComplete: "email",
    "aria-invalid": ((_a = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _a.email) ? true : void 0,
    "aria-describedby": "email-error",
    className: "w-full rounded border border-gray-500 px-2 py-1 text-lg"
  }), ((_b = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _b.email) && /* @__PURE__ */ React2.createElement("div", {
    className: "pt-1 text-red-700",
    id: "email-error"
  }, actionData.errors.email))), /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("label", {
    htmlFor: "password",
    className: "block text-sm font-medium text-gray-700"
  }, "Password"), /* @__PURE__ */ React2.createElement("div", {
    className: "mt-1"
  }, /* @__PURE__ */ React2.createElement("input", {
    id: "password",
    ref: passwordRef,
    name: "password",
    type: "password",
    autoComplete: "current-password",
    "aria-invalid": ((_c = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _c.password) ? true : void 0,
    "aria-describedby": "password-error",
    className: "w-full rounded border border-gray-500 px-2 py-1 text-lg"
  }), ((_d = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _d.password) && /* @__PURE__ */ React2.createElement("div", {
    className: "pt-1 text-red-700",
    id: "password-error"
  }, actionData.errors.password))), /* @__PURE__ */ React2.createElement("input", {
    type: "hidden",
    name: "redirectTo",
    value: redirectTo
  }), /* @__PURE__ */ React2.createElement("button", {
    type: "submit",
    className: "w-full rounded bg-blue-500  py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
  }, "Log in"), /* @__PURE__ */ React2.createElement("div", {
    className: "flex items-center justify-between"
  }, /* @__PURE__ */ React2.createElement("div", {
    className: "flex items-center"
  }, /* @__PURE__ */ React2.createElement("input", {
    id: "remember",
    name: "remember",
    type: "checkbox",
    className: "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
  }), /* @__PURE__ */ React2.createElement("label", {
    htmlFor: "remember",
    className: "ml-2 block text-sm text-gray-900"
  }, "Remember me")), /* @__PURE__ */ React2.createElement("div", {
    className: "text-center text-sm text-gray-500"
  }, "Don't have an account?", " ", /* @__PURE__ */ React2.createElement(import_react6.Link, {
    className: "text-blue-500 underline",
    to: {
      pathname: "/join",
      search: searchParams.toString()
    }
  }, "Sign up"))))));
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/notes.tsx
var notes_exports = {};
__export(notes_exports, {
  default: () => NotesPage,
  loader: () => loader4
});
var import_node5 = require("@remix-run/node");
var import_react7 = require("@remix-run/react");

// app/models/note.server.ts
function getNote({
  id,
  userId
}) {
  return prisma.note.findFirst({
    where: { id, userId }
  });
}
function getNoteListItems({ userId }) {
  return prisma.note.findMany({
    where: { userId },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" }
  });
}
function createNote({
  body,
  title,
  userId
}) {
  return prisma.note.create({
    data: {
      title,
      body,
      user: {
        connect: {
          id: userId
        }
      }
    }
  });
}
function deleteNote({
  id,
  userId
}) {
  return prisma.note.deleteMany({
    where: { id, userId }
  });
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/notes.tsx
var loader4 = async ({ request }) => {
  const userId = await requireUserId(request);
  const noteListItems = await getNoteListItems({ userId });
  return (0, import_node5.json)({ noteListItems });
};
function NotesPage() {
  const data = (0, import_react7.useLoaderData)();
  const user = useUser();
  return /* @__PURE__ */ React.createElement("div", {
    className: "flex h-full min-h-screen flex-col"
  }, /* @__PURE__ */ React.createElement("header", {
    className: "flex items-center justify-between bg-slate-800 p-4 text-white"
  }, /* @__PURE__ */ React.createElement("h1", {
    className: "text-3xl font-bold"
  }, /* @__PURE__ */ React.createElement(import_react7.Link, {
    to: "."
  }, "Notes")), /* @__PURE__ */ React.createElement("p", null, user.email), /* @__PURE__ */ React.createElement(import_react7.Form, {
    action: "/logout",
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "rounded bg-slate-600 py-2 px-4 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
  }, "Logout"))), /* @__PURE__ */ React.createElement("main", {
    className: "flex h-full bg-white"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "h-full w-80 border-r bg-gray-50"
  }, /* @__PURE__ */ React.createElement(import_react7.Link, {
    to: "new",
    className: "block p-4 text-xl text-blue-500"
  }, "+ New Note"), /* @__PURE__ */ React.createElement("hr", null), data.noteListItems.length === 0 ? /* @__PURE__ */ React.createElement("p", {
    className: "p-4"
  }, "No notes yet") : /* @__PURE__ */ React.createElement("ol", null, data.noteListItems.map((note) => /* @__PURE__ */ React.createElement("li", {
    key: note.id
  }, /* @__PURE__ */ React.createElement(import_react7.NavLink, {
    className: ({ isActive }) => `block border-b p-4 text-xl ${isActive ? "bg-white" : ""}`,
    to: note.id
  }, "\u{1F4DD} ", note.title))))), /* @__PURE__ */ React.createElement("div", {
    className: "flex-1 p-6"
  }, /* @__PURE__ */ React.createElement(import_react7.Outlet, null))));
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/notes/$noteId.tsx
var noteId_exports = {};
__export(noteId_exports, {
  CatchBoundary: () => CatchBoundary,
  ErrorBoundary: () => ErrorBoundary,
  action: () => action3,
  default: () => NoteDetailsPage,
  loader: () => loader5
});
var import_node6 = require("@remix-run/node");
var import_react8 = require("@remix-run/react");
var import_tiny_invariant2 = __toESM(require("tiny-invariant"));
var loader5 = async ({ request, params }) => {
  const userId = await requireUserId(request);
  (0, import_tiny_invariant2.default)(params.noteId, "noteId not found");
  const note = await getNote({ userId, id: params.noteId });
  if (!note) {
    throw new Response("Not Found", { status: 404 });
  }
  return (0, import_node6.json)({ note });
};
var action3 = async ({ request, params }) => {
  const userId = await requireUserId(request);
  (0, import_tiny_invariant2.default)(params.noteId, "noteId not found");
  await deleteNote({ userId, id: params.noteId });
  return (0, import_node6.redirect)("/notes");
};
function NoteDetailsPage() {
  const data = (0, import_react8.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", {
    className: "text-2xl font-bold"
  }, data.note.title), /* @__PURE__ */ React.createElement("p", {
    className: "py-6"
  }, data.note.body), /* @__PURE__ */ React.createElement("hr", {
    className: "my-4"
  }), /* @__PURE__ */ React.createElement(import_react8.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "rounded bg-blue-500  py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
  }, "Delete")));
}
function ErrorBoundary({ error }) {
  console.error(error);
  return /* @__PURE__ */ React.createElement("div", null, "An unexpected error occurred: ", error.message);
}
function CatchBoundary() {
  const caught = (0, import_react8.useCatch)();
  if (caught.status === 404) {
    return /* @__PURE__ */ React.createElement("div", null, "Note not found");
  }
  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/notes/index.tsx
var notes_exports2 = {};
__export(notes_exports2, {
  default: () => NoteIndexPage
});
var import_react9 = require("@remix-run/react");
function NoteIndexPage() {
  return /* @__PURE__ */ React.createElement("p", null, "No note selected. Select a note on the left, or", " ", /* @__PURE__ */ React.createElement(import_react9.Link, {
    to: "new",
    className: "text-blue-500 underline"
  }, "create a new note."));
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/notes/new.tsx
var new_exports = {};
__export(new_exports, {
  action: () => action4,
  default: () => NewNotePage
});
var import_node7 = require("@remix-run/node");
var import_react10 = require("@remix-run/react");
var React3 = __toESM(require("react"));
var action4 = async ({ request }) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const body = formData.get("body");
  if (typeof title !== "string" || title.length === 0) {
    return (0, import_node7.json)({ errors: { title: "Title is required" } }, { status: 400 });
  }
  if (typeof body !== "string" || body.length === 0) {
    return (0, import_node7.json)({ errors: { body: "Body is required" } }, { status: 400 });
  }
  const note = await createNote({ title, body, userId });
  return (0, import_node7.redirect)(`/notes/${note.id}`);
};
function NewNotePage() {
  var _a, _b, _c, _d, _e, _f;
  const actionData = (0, import_react10.useActionData)();
  const titleRef = React3.useRef(null);
  const bodyRef = React3.useRef(null);
  React3.useEffect(() => {
    var _a2, _b2, _c2, _d2;
    if ((_a2 = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _a2.title) {
      (_b2 = titleRef.current) == null ? void 0 : _b2.focus();
    } else if ((_c2 = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _c2.body) {
      (_d2 = bodyRef.current) == null ? void 0 : _d2.focus();
    }
  }, [actionData]);
  return /* @__PURE__ */ React3.createElement(import_react10.Form, {
    method: "post",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      width: "100%"
    }
  }, /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("label", {
    className: "flex w-full flex-col gap-1"
  }, /* @__PURE__ */ React3.createElement("span", null, "Title: "), /* @__PURE__ */ React3.createElement("input", {
    ref: titleRef,
    name: "title",
    className: "flex-1 rounded-md border-2 border-blue-500 px-3 text-lg leading-loose",
    "aria-invalid": ((_a = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _a.title) ? true : void 0,
    "aria-errormessage": ((_b = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _b.title) ? "title-error" : void 0
  })), ((_c = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _c.title) && /* @__PURE__ */ React3.createElement("div", {
    className: "pt-1 text-red-700",
    id: "title-error"
  }, actionData.errors.title)), /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("label", {
    className: "flex w-full flex-col gap-1"
  }, /* @__PURE__ */ React3.createElement("span", null, "Body: "), /* @__PURE__ */ React3.createElement("textarea", {
    ref: bodyRef,
    name: "body",
    rows: 8,
    className: "w-full flex-1 rounded-md border-2 border-blue-500 py-2 px-3 text-lg leading-6",
    "aria-invalid": ((_d = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _d.body) ? true : void 0,
    "aria-errormessage": ((_e = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _e.body) ? "body-error" : void 0
  })), ((_f = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _f.body) && /* @__PURE__ */ React3.createElement("div", {
    className: "pt-1 text-red-700",
    id: "body-error"
  }, actionData.errors.body)), /* @__PURE__ */ React3.createElement("div", {
    className: "text-right"
  }, /* @__PURE__ */ React3.createElement("button", {
    type: "submit",
    className: "rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
  }, "Save")));
}

// route:/Users/kentcdodds/code/remix/scripts/playground/template/app/routes/join.tsx
var join_exports = {};
__export(join_exports, {
  action: () => action5,
  default: () => Join,
  loader: () => loader6,
  meta: () => meta3
});
var import_node8 = require("@remix-run/node");
var import_react11 = require("@remix-run/react");
var React4 = __toESM(require("react"));
var loader6 = async ({ request }) => {
  const userId = await getUserId(request);
  if (userId)
    return (0, import_node8.redirect)("/");
  return (0, import_node8.json)({});
};
var action5 = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");
  if (!validateEmail(email)) {
    return (0, import_node8.json)({ errors: { email: "Email is invalid" } }, { status: 400 });
  }
  if (typeof password !== "string") {
    return (0, import_node8.json)({ errors: { password: "Password is required" } }, { status: 400 });
  }
  if (password.length < 8) {
    return (0, import_node8.json)({ errors: { password: "Password is too short" } }, { status: 400 });
  }
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return (0, import_node8.json)({ errors: { email: "A user already exists with this email" } }, { status: 400 });
  }
  const user = await createUser(email, password);
  return createUserSession({
    request,
    userId: user.id,
    remember: false,
    redirectTo: typeof redirectTo === "string" ? redirectTo : "/"
  });
};
var meta3 = () => {
  return {
    title: "Sign Up"
  };
};
function Join() {
  var _a, _b, _c, _d;
  const [searchParams] = (0, import_react11.useSearchParams)();
  const redirectTo = searchParams.get("redirectTo") ?? void 0;
  const actionData = (0, import_react11.useActionData)();
  const emailRef = React4.useRef(null);
  const passwordRef = React4.useRef(null);
  React4.useEffect(() => {
    var _a2, _b2, _c2, _d2;
    if ((_a2 = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _a2.email) {
      (_b2 = emailRef.current) == null ? void 0 : _b2.focus();
    } else if ((_c2 = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _c2.password) {
      (_d2 = passwordRef.current) == null ? void 0 : _d2.focus();
    }
  }, [actionData]);
  return /* @__PURE__ */ React4.createElement("div", {
    className: "flex min-h-full flex-col justify-center"
  }, /* @__PURE__ */ React4.createElement("div", {
    className: "mx-auto w-full max-w-md px-8"
  }, /* @__PURE__ */ React4.createElement(import_react11.Form, {
    method: "post",
    className: "space-y-6"
  }, /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("label", {
    htmlFor: "email",
    className: "block text-sm font-medium text-gray-700"
  }, "Email address"), /* @__PURE__ */ React4.createElement("div", {
    className: "mt-1"
  }, /* @__PURE__ */ React4.createElement("input", {
    ref: emailRef,
    id: "email",
    required: true,
    autoFocus: true,
    name: "email",
    type: "email",
    autoComplete: "email",
    "aria-invalid": ((_a = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _a.email) ? true : void 0,
    "aria-describedby": "email-error",
    className: "w-full rounded border border-gray-500 px-2 py-1 text-lg"
  }), ((_b = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _b.email) && /* @__PURE__ */ React4.createElement("div", {
    className: "pt-1 text-red-700",
    id: "email-error"
  }, actionData.errors.email))), /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("label", {
    htmlFor: "password",
    className: "block text-sm font-medium text-gray-700"
  }, "Password"), /* @__PURE__ */ React4.createElement("div", {
    className: "mt-1"
  }, /* @__PURE__ */ React4.createElement("input", {
    id: "password",
    ref: passwordRef,
    name: "password",
    type: "password",
    autoComplete: "new-password",
    "aria-invalid": ((_c = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _c.password) ? true : void 0,
    "aria-describedby": "password-error",
    className: "w-full rounded border border-gray-500 px-2 py-1 text-lg"
  }), ((_d = actionData == null ? void 0 : actionData.errors) == null ? void 0 : _d.password) && /* @__PURE__ */ React4.createElement("div", {
    className: "pt-1 text-red-700",
    id: "password-error"
  }, actionData.errors.password))), /* @__PURE__ */ React4.createElement("input", {
    type: "hidden",
    name: "redirectTo",
    value: redirectTo
  }), /* @__PURE__ */ React4.createElement("button", {
    type: "submit",
    className: "w-full rounded bg-blue-500  py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
  }, "Create Account"), /* @__PURE__ */ React4.createElement("div", {
    className: "flex items-center justify-center"
  }, /* @__PURE__ */ React4.createElement("div", {
    className: "text-center text-sm text-gray-500"
  }, "Already have an account?", " ", /* @__PURE__ */ React4.createElement(import_react11.Link, {
    className: "text-blue-500 underline",
    to: {
      pathname: "/login",
      search: searchParams.toString()
    }
  }, "Log in"))))));
}

// server-assets-manifest:@remix-run/dev/assets-manifest
var assets_manifest_default = { "version": "7e33f3f4", "entry": { "module": "/build/entry.client-3KKCFFQU.js", "imports": ["/build/_shared/chunk-WIRBID2R.js", "/build/_shared/chunk-TZRUHAEM.js"] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "module": "/build/root-DYWQDBTM.js", "imports": ["/build/_shared/chunk-NTDEHKFW.js"], "hasAction": false, "hasLoader": true, "hasCatchBoundary": false, "hasErrorBoundary": false }, "routes/index": { "id": "routes/index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "module": "/build/routes/index-4SF5HONH.js", "imports": ["/build/_shared/chunk-E5WCUGOE.js"], "hasAction": false, "hasLoader": false, "hasCatchBoundary": false, "hasErrorBoundary": false }, "routes/join": { "id": "routes/join", "parentId": "root", "path": "join", "index": void 0, "caseSensitive": void 0, "module": "/build/routes/join-WKJF42P4.js", "imports": ["/build/_shared/chunk-UZSFQ2PN.js", "/build/_shared/chunk-E5WCUGOE.js", "/build/_shared/chunk-AYKM7IVK.js"], "hasAction": true, "hasLoader": true, "hasCatchBoundary": false, "hasErrorBoundary": false }, "routes/login": { "id": "routes/login", "parentId": "root", "path": "login", "index": void 0, "caseSensitive": void 0, "module": "/build/routes/login-JLDDSY4Q.js", "imports": ["/build/_shared/chunk-UZSFQ2PN.js", "/build/_shared/chunk-E5WCUGOE.js", "/build/_shared/chunk-AYKM7IVK.js"], "hasAction": true, "hasLoader": true, "hasCatchBoundary": false, "hasErrorBoundary": false }, "routes/logout": { "id": "routes/logout", "parentId": "root", "path": "logout", "index": void 0, "caseSensitive": void 0, "module": "/build/routes/logout-BH7N2Y2V.js", "imports": ["/build/_shared/chunk-AYKM7IVK.js"], "hasAction": true, "hasLoader": true, "hasCatchBoundary": false, "hasErrorBoundary": false }, "routes/notes": { "id": "routes/notes", "parentId": "root", "path": "notes", "index": void 0, "caseSensitive": void 0, "module": "/build/routes/notes-NFONUPSV.js", "imports": ["/build/_shared/chunk-E5WCUGOE.js", "/build/_shared/chunk-7DKPWIQT.js", "/build/_shared/chunk-AYKM7IVK.js"], "hasAction": false, "hasLoader": true, "hasCatchBoundary": false, "hasErrorBoundary": false }, "routes/notes/$noteId": { "id": "routes/notes/$noteId", "parentId": "routes/notes", "path": ":noteId", "index": void 0, "caseSensitive": void 0, "module": "/build/routes/notes/$noteId-XTL75K7B.js", "imports": ["/build/_shared/chunk-NTDEHKFW.js"], "hasAction": true, "hasLoader": true, "hasCatchBoundary": true, "hasErrorBoundary": true }, "routes/notes/index": { "id": "routes/notes/index", "parentId": "routes/notes", "path": void 0, "index": true, "caseSensitive": void 0, "module": "/build/routes/notes/index-RYDGFSEW.js", "imports": void 0, "hasAction": false, "hasLoader": false, "hasCatchBoundary": false, "hasErrorBoundary": false }, "routes/notes/new": { "id": "routes/notes/new", "parentId": "routes/notes", "path": "new", "index": void 0, "caseSensitive": void 0, "module": "/build/routes/notes/new-PP6A6RLX.js", "imports": ["/build/_shared/chunk-NTDEHKFW.js"], "hasAction": true, "hasLoader": false, "hasCatchBoundary": false, "hasErrorBoundary": false } }, "url": "/build/manifest-7E33F3F4.js" };

// server-entry-module:@remix-run/dev/server-build
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
  "routes/login": {
    id: "routes/login",
    parentId: "root",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: login_exports
  },
  "routes/notes": {
    id: "routes/notes",
    parentId: "root",
    path: "notes",
    index: void 0,
    caseSensitive: void 0,
    module: notes_exports
  },
  "routes/notes/$noteId": {
    id: "routes/notes/$noteId",
    parentId: "routes/notes",
    path: ":noteId",
    index: void 0,
    caseSensitive: void 0,
    module: noteId_exports
  },
  "routes/notes/index": {
    id: "routes/notes/index",
    parentId: "routes/notes",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: notes_exports2
  },
  "routes/notes/new": {
    id: "routes/notes/new",
    parentId: "routes/notes",
    path: "new",
    index: void 0,
    caseSensitive: void 0,
    module: new_exports
  },
  "routes/join": {
    id: "routes/join",
    parentId: "root",
    path: "join",
    index: void 0,
    caseSensitive: void 0,
    module: join_exports
  }
};
module.exports = __toCommonJS(stdin_exports);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  assets,
  entry,
  routes
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiIsICIuLi9ub2RlX21vZHVsZXMvQHJlbWl4LXJ1bi9kZXYvY29tcGlsZXIvc2hpbXMvcmVhY3QudHMiLCAiLi4vYXBwL2VudHJ5LnNlcnZlci50c3giLCAicm91dGU6L1VzZXJzL2tlbnRjZG9kZHMvY29kZS9yZW1peC9zY3JpcHRzL3BsYXlncm91bmQvdGVtcGxhdGUvYXBwL3Jvb3QudHN4IiwgIi4uL2FwcC9zZXNzaW9uLnNlcnZlci50cyIsICIuLi9hcHAvbW9kZWxzL3VzZXIuc2VydmVyLnRzIiwgIi4uL2FwcC9kYi5zZXJ2ZXIudHMiLCAicm91dGU6L1VzZXJzL2tlbnRjZG9kZHMvY29kZS9yZW1peC9zY3JpcHRzL3BsYXlncm91bmQvdGVtcGxhdGUvYXBwL3JvdXRlcy9sb2dvdXQudHN4IiwgInJvdXRlOi9Vc2Vycy9rZW50Y2RvZGRzL2NvZGUvcmVtaXgvc2NyaXB0cy9wbGF5Z3JvdW5kL3RlbXBsYXRlL2FwcC9yb3V0ZXMvaW5kZXgudHN4IiwgIi4uL2FwcC91dGlscy50cyIsICJyb3V0ZTovVXNlcnMva2VudGNkb2Rkcy9jb2RlL3JlbWl4L3NjcmlwdHMvcGxheWdyb3VuZC90ZW1wbGF0ZS9hcHAvcm91dGVzL2xvZ2luLnRzeCIsICJyb3V0ZTovVXNlcnMva2VudGNkb2Rkcy9jb2RlL3JlbWl4L3NjcmlwdHMvcGxheWdyb3VuZC90ZW1wbGF0ZS9hcHAvcm91dGVzL25vdGVzLnRzeCIsICIuLi9hcHAvbW9kZWxzL25vdGUuc2VydmVyLnRzIiwgInJvdXRlOi9Vc2Vycy9rZW50Y2RvZGRzL2NvZGUvcmVtaXgvc2NyaXB0cy9wbGF5Z3JvdW5kL3RlbXBsYXRlL2FwcC9yb3V0ZXMvbm90ZXMvJG5vdGVJZC50c3giLCAicm91dGU6L1VzZXJzL2tlbnRjZG9kZHMvY29kZS9yZW1peC9zY3JpcHRzL3BsYXlncm91bmQvdGVtcGxhdGUvYXBwL3JvdXRlcy9ub3Rlcy9pbmRleC50c3giLCAicm91dGU6L1VzZXJzL2tlbnRjZG9kZHMvY29kZS9yZW1peC9zY3JpcHRzL3BsYXlncm91bmQvdGVtcGxhdGUvYXBwL3JvdXRlcy9ub3Rlcy9uZXcudHN4IiwgInJvdXRlOi9Vc2Vycy9rZW50Y2RvZGRzL2NvZGUvcmVtaXgvc2NyaXB0cy9wbGF5Z3JvdW5kL3RlbXBsYXRlL2FwcC9yb3V0ZXMvam9pbi50c3giLCAic2VydmVyLWFzc2V0cy1tYW5pZmVzdDpAcmVtaXgtcnVuL2Rldi9hc3NldHMtbWFuaWZlc3QiLCAic2VydmVyLWVudHJ5LW1vZHVsZTpAcmVtaXgtcnVuL2Rldi9zZXJ2ZXItYnVpbGQiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCAqIGZyb20gXCJAcmVtaXgtcnVuL2Rldi9zZXJ2ZXItYnVpbGRcIjsiLCAiLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSBcInJlYWN0XCI7XG5leHBvcnQgeyBSZWFjdCB9O1xuIiwgImltcG9ydCB0eXBlIHsgRW50cnlDb250ZXh0IH0gZnJvbSBcIkByZW1peC1ydW4vbm9kZVwiO1xuaW1wb3J0IHsgUmVtaXhTZXJ2ZXIgfSBmcm9tIFwiQHJlbWl4LXJ1bi9yZWFjdFwiO1xuaW1wb3J0IHsgcmVuZGVyVG9TdHJpbmcgfSBmcm9tIFwicmVhY3QtZG9tL3NlcnZlclwiO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBoYW5kbGVSZXF1ZXN0KFxuICByZXF1ZXN0OiBSZXF1ZXN0LFxuICByZXNwb25zZVN0YXR1c0NvZGU6IG51bWJlcixcbiAgcmVzcG9uc2VIZWFkZXJzOiBIZWFkZXJzLFxuICByZW1peENvbnRleHQ6IEVudHJ5Q29udGV4dFxuKSB7XG4gIGNvbnN0IG1hcmt1cCA9IHJlbmRlclRvU3RyaW5nKFxuICAgIDxSZW1peFNlcnZlciBjb250ZXh0PXtyZW1peENvbnRleHR9IHVybD17cmVxdWVzdC51cmx9IC8+XG4gICk7XG5cbiAgcmVzcG9uc2VIZWFkZXJzLnNldChcIkNvbnRlbnQtVHlwZVwiLCBcInRleHQvaHRtbFwiKTtcblxuICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiPCFET0NUWVBFIGh0bWw+XCIgKyBtYXJrdXAsIHtcbiAgICBzdGF0dXM6IHJlc3BvbnNlU3RhdHVzQ29kZSxcbiAgICBoZWFkZXJzOiByZXNwb25zZUhlYWRlcnMsXG4gIH0pO1xufVxuIiwgImltcG9ydCB0eXBlIHtcbiAgTGlua3NGdW5jdGlvbixcbiAgTG9hZGVyRnVuY3Rpb24sXG4gIE1ldGFGdW5jdGlvbixcbn0gZnJvbSBcIkByZW1peC1ydW4vbm9kZVwiO1xuaW1wb3J0IHsganNvbiB9IGZyb20gXCJAcmVtaXgtcnVuL25vZGVcIjtcbmltcG9ydCB7XG4gIExpbmtzLFxuICBMaXZlUmVsb2FkLFxuICBNZXRhLFxuICBPdXRsZXQsXG4gIFNjcmlwdHMsXG4gIFNjcm9sbFJlc3RvcmF0aW9uLFxufSBmcm9tIFwiQHJlbWl4LXJ1bi9yZWFjdFwiO1xuXG5pbXBvcnQgdGFpbHdpbmRTdHlsZXNoZWV0VXJsIGZyb20gXCIuL3N0eWxlcy90YWlsd2luZC5jc3NcIjtcbmltcG9ydCB7IGdldFVzZXIgfSBmcm9tIFwiLi9zZXNzaW9uLnNlcnZlclwiO1xuXG5leHBvcnQgY29uc3QgbGlua3M6IExpbmtzRnVuY3Rpb24gPSAoKSA9PiB7XG4gIHJldHVybiBbeyByZWw6IFwic3R5bGVzaGVldFwiLCBocmVmOiB0YWlsd2luZFN0eWxlc2hlZXRVcmwgfV07XG59O1xuXG5leHBvcnQgY29uc3QgbWV0YTogTWV0YUZ1bmN0aW9uID0gKCkgPT4gKHtcbiAgY2hhcnNldDogXCJ1dGYtOFwiLFxuICB0aXRsZTogXCJSZW1peCBOb3Rlc1wiLFxuICB2aWV3cG9ydDogXCJ3aWR0aD1kZXZpY2Utd2lkdGgsaW5pdGlhbC1zY2FsZT0xXCIsXG59KTtcblxudHlwZSBMb2FkZXJEYXRhID0ge1xuICB1c2VyOiBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIGdldFVzZXI+Pjtcbn07XG5cbmV4cG9ydCBjb25zdCBsb2FkZXI6IExvYWRlckZ1bmN0aW9uID0gYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gIHJldHVybiBqc29uPExvYWRlckRhdGE+KHtcbiAgICB1c2VyOiBhd2FpdCBnZXRVc2VyKHJlcXVlc3QpLFxuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEFwcCgpIHtcbiAgcmV0dXJuIChcbiAgICA8aHRtbCBsYW5nPVwiZW5cIiBjbGFzc05hbWU9XCJoLWZ1bGxcIj5cbiAgICAgIDxoZWFkPlxuICAgICAgICA8TWV0YSAvPlxuICAgICAgICA8TGlua3MgLz5cbiAgICAgIDwvaGVhZD5cbiAgICAgIDxib2R5IGNsYXNzTmFtZT1cImgtZnVsbFwiPlxuICAgICAgICA8T3V0bGV0IC8+XG4gICAgICAgIDxTY3JvbGxSZXN0b3JhdGlvbiAvPlxuICAgICAgICA8U2NyaXB0cyAvPlxuICAgICAgICA8TGl2ZVJlbG9hZCAvPlxuICAgICAgPC9ib2R5PlxuICAgIDwvaHRtbD5cbiAgKTtcbn1cbiIsICJpbXBvcnQgeyBjcmVhdGVDb29raWVTZXNzaW9uU3RvcmFnZSwgcmVkaXJlY3QgfSBmcm9tIFwiQHJlbWl4LXJ1bi9ub2RlXCI7XG5pbXBvcnQgaW52YXJpYW50IGZyb20gXCJ0aW55LWludmFyaWFudFwiO1xuXG5pbXBvcnQgdHlwZSB7IFVzZXIgfSBmcm9tIFwifi9tb2RlbHMvdXNlci5zZXJ2ZXJcIjtcbmltcG9ydCB7IGdldFVzZXJCeUlkIH0gZnJvbSBcIn4vbW9kZWxzL3VzZXIuc2VydmVyXCI7XG5cbmludmFyaWFudChwcm9jZXNzLmVudi5TRVNTSU9OX1NFQ1JFVCwgXCJTRVNTSU9OX1NFQ1JFVCBtdXN0IGJlIHNldFwiKTtcblxuZXhwb3J0IGNvbnN0IHNlc3Npb25TdG9yYWdlID0gY3JlYXRlQ29va2llU2Vzc2lvblN0b3JhZ2Uoe1xuICBjb29raWU6IHtcbiAgICBuYW1lOiBcIl9fc2Vzc2lvblwiLFxuICAgIGh0dHBPbmx5OiB0cnVlLFxuICAgIG1heEFnZTogMCxcbiAgICBwYXRoOiBcIi9cIixcbiAgICBzYW1lU2l0ZTogXCJsYXhcIixcbiAgICBzZWNyZXRzOiBbcHJvY2Vzcy5lbnYuU0VTU0lPTl9TRUNSRVRdLFxuICAgIHNlY3VyZTogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiLFxuICB9LFxufSk7XG5cbmNvbnN0IFVTRVJfU0VTU0lPTl9LRVkgPSBcInVzZXJJZFwiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2Vzc2lvbihyZXF1ZXN0OiBSZXF1ZXN0KSB7XG4gIGNvbnN0IGNvb2tpZSA9IHJlcXVlc3QuaGVhZGVycy5nZXQoXCJDb29raWVcIik7XG4gIHJldHVybiBzZXNzaW9uU3RvcmFnZS5nZXRTZXNzaW9uKGNvb2tpZSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRVc2VySWQocmVxdWVzdDogUmVxdWVzdCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBnZXRTZXNzaW9uKHJlcXVlc3QpO1xuICBjb25zdCB1c2VySWQgPSBzZXNzaW9uLmdldChVU0VSX1NFU1NJT05fS0VZKTtcbiAgcmV0dXJuIHVzZXJJZDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVzZXIocmVxdWVzdDogUmVxdWVzdCk6IFByb21pc2U8bnVsbCB8IFVzZXI+IHtcbiAgY29uc3QgdXNlcklkID0gYXdhaXQgZ2V0VXNlcklkKHJlcXVlc3QpO1xuICBpZiAodXNlcklkID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBnZXRVc2VyQnlJZCh1c2VySWQpO1xuICBpZiAodXNlcikgcmV0dXJuIHVzZXI7XG5cbiAgdGhyb3cgYXdhaXQgbG9nb3V0KHJlcXVlc3QpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVxdWlyZVVzZXJJZChcbiAgcmVxdWVzdDogUmVxdWVzdCxcbiAgcmVkaXJlY3RUbzogc3RyaW5nID0gbmV3IFVSTChyZXF1ZXN0LnVybCkucGF0aG5hbWVcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHVzZXJJZCA9IGF3YWl0IGdldFVzZXJJZChyZXF1ZXN0KTtcbiAgaWYgKCF1c2VySWQpIHtcbiAgICBjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKFtbXCJyZWRpcmVjdFRvXCIsIHJlZGlyZWN0VG9dXSk7XG4gICAgdGhyb3cgcmVkaXJlY3QoYC9sb2dpbj8ke3NlYXJjaFBhcmFtc31gKTtcbiAgfVxuICByZXR1cm4gdXNlcklkO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVxdWlyZVVzZXIocmVxdWVzdDogUmVxdWVzdCkge1xuICBjb25zdCB1c2VySWQgPSBhd2FpdCByZXF1aXJlVXNlcklkKHJlcXVlc3QpO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBnZXRVc2VyQnlJZCh1c2VySWQpO1xuICBpZiAodXNlcikgcmV0dXJuIHVzZXI7XG5cbiAgdGhyb3cgYXdhaXQgbG9nb3V0KHJlcXVlc3QpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlVXNlclNlc3Npb24oe1xuICByZXF1ZXN0LFxuICB1c2VySWQsXG4gIHJlbWVtYmVyLFxuICByZWRpcmVjdFRvLFxufToge1xuICByZXF1ZXN0OiBSZXF1ZXN0O1xuICB1c2VySWQ6IHN0cmluZztcbiAgcmVtZW1iZXI6IGJvb2xlYW47XG4gIHJlZGlyZWN0VG86IHN0cmluZztcbn0pIHtcbiAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGdldFNlc3Npb24ocmVxdWVzdCk7XG4gIHNlc3Npb24uc2V0KFVTRVJfU0VTU0lPTl9LRVksIHVzZXJJZCk7XG4gIHJldHVybiByZWRpcmVjdChyZWRpcmVjdFRvLCB7XG4gICAgaGVhZGVyczoge1xuICAgICAgXCJTZXQtQ29va2llXCI6IGF3YWl0IHNlc3Npb25TdG9yYWdlLmNvbW1pdFNlc3Npb24oc2Vzc2lvbiwge1xuICAgICAgICBtYXhBZ2U6IHJlbWVtYmVyXG4gICAgICAgICAgPyA2MCAqIDYwICogMjQgKiA3IC8vIDcgZGF5c1xuICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgfSksXG4gICAgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dvdXQocmVxdWVzdDogUmVxdWVzdCkge1xuICBjb25zdCBzZXNzaW9uID0gYXdhaXQgZ2V0U2Vzc2lvbihyZXF1ZXN0KTtcbiAgcmV0dXJuIHJlZGlyZWN0KFwiL1wiLCB7XG4gICAgaGVhZGVyczoge1xuICAgICAgXCJTZXQtQ29va2llXCI6IGF3YWl0IHNlc3Npb25TdG9yYWdlLmRlc3Ryb3lTZXNzaW9uKHNlc3Npb24pLFxuICAgIH0sXG4gIH0pO1xufVxuIiwgImltcG9ydCB0eXBlIHsgUGFzc3dvcmQsIFVzZXIgfSBmcm9tIFwiQHByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5cbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCJ+L2RiLnNlcnZlclwiO1xuXG5leHBvcnQgdHlwZSB7IFVzZXIgfSBmcm9tIFwiQHByaXNtYS9jbGllbnRcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVzZXJCeUlkKGlkOiBVc2VyW1wiaWRcIl0pIHtcbiAgcmV0dXJuIHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VXNlckJ5RW1haWwoZW1haWw6IFVzZXJbXCJlbWFpbFwiXSkge1xuICByZXR1cm4gcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVVc2VyKGVtYWlsOiBVc2VyW1wiZW1haWxcIl0sIHBhc3N3b3JkOiBzdHJpbmcpIHtcbiAgY29uc3QgaGFzaGVkUGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChwYXNzd29yZCwgMTApO1xuXG4gIHJldHVybiBwcmlzbWEudXNlci5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIGVtYWlsLFxuICAgICAgcGFzc3dvcmQ6IHtcbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgaGFzaDogaGFzaGVkUGFzc3dvcmQsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlVXNlckJ5RW1haWwoZW1haWw6IFVzZXJbXCJlbWFpbFwiXSkge1xuICByZXR1cm4gcHJpc21hLnVzZXIuZGVsZXRlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZlcmlmeUxvZ2luKFxuICBlbWFpbDogVXNlcltcImVtYWlsXCJdLFxuICBwYXNzd29yZDogUGFzc3dvcmRbXCJoYXNoXCJdXG4pIHtcbiAgY29uc3QgdXNlcldpdGhQYXNzd29yZCA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgcGFzc3dvcmQ6IHRydWUsXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyV2l0aFBhc3N3b3JkIHx8ICF1c2VyV2l0aFBhc3N3b3JkLnBhc3N3b3JkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBpc1ZhbGlkID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUoXG4gICAgcGFzc3dvcmQsXG4gICAgdXNlcldpdGhQYXNzd29yZC5wYXNzd29yZC5oYXNoXG4gICk7XG5cbiAgaWYgKCFpc1ZhbGlkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCB7IHBhc3N3b3JkOiBfcGFzc3dvcmQsIC4uLnVzZXJXaXRob3V0UGFzc3dvcmQgfSA9IHVzZXJXaXRoUGFzc3dvcmQ7XG5cbiAgcmV0dXJuIHVzZXJXaXRob3V0UGFzc3dvcmQ7XG59XG4iLCAiaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSBcIkBwcmlzbWEvY2xpZW50XCI7XG5cbmxldCBwcmlzbWE6IFByaXNtYUNsaWVudDtcblxuZGVjbGFyZSBnbG9iYWwge1xuICB2YXIgX19kYl9fOiBQcmlzbWFDbGllbnQ7XG59XG5cbi8vIHRoaXMgaXMgbmVlZGVkIGJlY2F1c2UgaW4gZGV2ZWxvcG1lbnQgd2UgZG9uJ3Qgd2FudCB0byByZXN0YXJ0XG4vLyB0aGUgc2VydmVyIHdpdGggZXZlcnkgY2hhbmdlLCBidXQgd2Ugd2FudCB0byBtYWtlIHN1cmUgd2UgZG9uJ3Rcbi8vIGNyZWF0ZSBhIG5ldyBjb25uZWN0aW9uIHRvIHRoZSBEQiB3aXRoIGV2ZXJ5IGNoYW5nZSBlaXRoZXIuXG4vLyBpbiBwcm9kdWN0aW9uIHdlJ2xsIGhhdmUgYSBzaW5nbGUgY29ubmVjdGlvbiB0byB0aGUgREIuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiKSB7XG4gIHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoKTtcbn0gZWxzZSB7XG4gIGlmICghZ2xvYmFsLl9fZGJfXykge1xuICAgIGdsb2JhbC5fX2RiX18gPSBuZXcgUHJpc21hQ2xpZW50KCk7XG4gIH1cbiAgcHJpc21hID0gZ2xvYmFsLl9fZGJfXztcbiAgcHJpc21hLiRjb25uZWN0KCk7XG59XG5cbmV4cG9ydCB7IHByaXNtYSB9O1xuIiwgImltcG9ydCB0eXBlIHsgQWN0aW9uRnVuY3Rpb24sIExvYWRlckZ1bmN0aW9uIH0gZnJvbSBcIkByZW1peC1ydW4vbm9kZVwiO1xuaW1wb3J0IHsgcmVkaXJlY3QgfSBmcm9tIFwiQHJlbWl4LXJ1bi9ub2RlXCI7XG5cbmltcG9ydCB7IGxvZ291dCB9IGZyb20gXCJ+L3Nlc3Npb24uc2VydmVyXCI7XG5cbmV4cG9ydCBjb25zdCBhY3Rpb246IEFjdGlvbkZ1bmN0aW9uID0gYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gIHJldHVybiBsb2dvdXQocmVxdWVzdCk7XG59O1xuXG5leHBvcnQgY29uc3QgbG9hZGVyOiBMb2FkZXJGdW5jdGlvbiA9IGFzeW5jICgpID0+IHtcbiAgcmV0dXJuIHJlZGlyZWN0KFwiL1wiKTtcbn07XG4iLCAiaW1wb3J0IHsgTGluayB9IGZyb20gXCJAcmVtaXgtcnVuL3JlYWN0XCI7XG5cbmltcG9ydCB7IHVzZU9wdGlvbmFsVXNlciB9IGZyb20gXCJ+L3V0aWxzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEluZGV4KCkge1xuICBjb25zdCB1c2VyID0gdXNlT3B0aW9uYWxVc2VyKCk7XG4gIHJldHVybiAoXG4gICAgPG1haW4+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wganVzdGlmeS1jZW50ZXIgaXRlbXMtY2VudGVyIGdhcC0xMiBtdC0xMlwiPlxuICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC0zeGwgZm9udC1ib2xkXCI+UmVtaXggUGxheWdyb3VuZDwvaDE+XG4gICAgICAgIDxkaXY+XG4gICAgICAgICAge3VzZXIgPyAoXG4gICAgICAgICAgICA8TGlua1xuICAgICAgICAgICAgICB0bz1cIi9ub3Rlc1wiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci10cmFuc3BhcmVudCBiZy13aGl0ZSBweC00IHB5LTMgdGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtYmx1ZS03MDAgc2hhZG93LXNtIGhvdmVyOmJnLWJsdWUtNTAgc206cHgtOFwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFZpZXcgTm90ZXMgZm9yIHt1c2VyLmVtYWlsfVxuICAgICAgICAgICAgPC9MaW5rPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZ2FwLTVcIj5cbiAgICAgICAgICAgICAgPExpbmtcbiAgICAgICAgICAgICAgICB0bz1cIi9qb2luXCJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJyb3VuZGVkLW1kIGJvcmRlciBib3JkZXItYmx1ZS01MDAgYmctd2hpdGUgcHgtNCBweS0zIHRleHQtYmFzZSBmb250LW1lZGl1bSB0ZXh0LWJsdWUtNzAwIHNoYWRvdy1zbSBob3ZlcjpiZy1ibHVlLTUwIHNtOnB4LThcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgU2lnbiB1cFxuICAgICAgICAgICAgICA8L0xpbms+XG4gICAgICAgICAgICAgIDxMaW5rXG4gICAgICAgICAgICAgICAgdG89XCIvbG9naW5cIlxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQtbWQgYmctYmx1ZS01MDAgcHgtNCBweS0zIGZvbnQtbWVkaXVtIHRleHQtd2hpdGUgaG92ZXI6YmctYmx1ZS02MDBcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgTG9nIEluXG4gICAgICAgICAgICAgIDwvTGluaz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9tYWluPlxuICApO1xufVxuIiwgImltcG9ydCB7IHVzZU1hdGNoZXMgfSBmcm9tIFwiQHJlbWl4LXJ1bi9yZWFjdFwiO1xuaW1wb3J0IHsgdXNlTWVtbyB9IGZyb20gXCJyZWFjdFwiO1xuXG5pbXBvcnQgdHlwZSB7IFVzZXIgfSBmcm9tIFwifi9tb2RlbHMvdXNlci5zZXJ2ZXJcIjtcblxuLyoqXG4gKiBUaGlzIGJhc2UgaG9vayBpcyB1c2VkIGluIG90aGVyIGhvb2tzIHRvIHF1aWNrbHkgc2VhcmNoIGZvciBzcGVjaWZpYyBkYXRhXG4gKiBhY3Jvc3MgYWxsIGxvYWRlciBkYXRhIHVzaW5nIHVzZU1hdGNoZXMuXG4gKiBAcGFyYW0ge3N0cmluZ30gaWQgVGhlIHJvdXRlIGlkXG4gKiBAcmV0dXJucyB7SlNPTnx1bmRlZmluZWR9IFRoZSByb3V0ZXIgZGF0YSBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VNYXRjaGVzRGF0YShcbiAgaWQ6IHN0cmluZ1xuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQge1xuICBjb25zdCBtYXRjaGluZ1JvdXRlcyA9IHVzZU1hdGNoZXMoKTtcbiAgY29uc3Qgcm91dGUgPSB1c2VNZW1vKFxuICAgICgpID0+IG1hdGNoaW5nUm91dGVzLmZpbmQoKHJvdXRlKSA9PiByb3V0ZS5pZCA9PT0gaWQpLFxuICAgIFttYXRjaGluZ1JvdXRlcywgaWRdXG4gICk7XG4gIHJldHVybiByb3V0ZT8uZGF0YTtcbn1cblxuZnVuY3Rpb24gaXNVc2VyKHVzZXI6IGFueSk6IHVzZXIgaXMgVXNlciB7XG4gIHJldHVybiB1c2VyICYmIHR5cGVvZiB1c2VyID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiB1c2VyLmVtYWlsID09PSBcInN0cmluZ1wiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlT3B0aW9uYWxVc2VyKCk6IFVzZXIgfCB1bmRlZmluZWQge1xuICBjb25zdCBkYXRhID0gdXNlTWF0Y2hlc0RhdGEoXCJyb290XCIpO1xuICBpZiAoIWRhdGEgfHwgIWlzVXNlcihkYXRhLnVzZXIpKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gZGF0YS51c2VyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlVXNlcigpOiBVc2VyIHtcbiAgY29uc3QgbWF5YmVVc2VyID0gdXNlT3B0aW9uYWxVc2VyKCk7XG4gIGlmICghbWF5YmVVc2VyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJObyB1c2VyIGZvdW5kIGluIHJvb3QgbG9hZGVyLCBidXQgdXNlciBpcyByZXF1aXJlZCBieSB1c2VVc2VyLiBJZiB1c2VyIGlzIG9wdGlvbmFsLCB0cnkgdXNlT3B0aW9uYWxVc2VyIGluc3RlYWQuXCJcbiAgICApO1xuICB9XG4gIHJldHVybiBtYXliZVVzZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUVtYWlsKGVtYWlsOiB1bmtub3duKTogZW1haWwgaXMgc3RyaW5nIHtcbiAgcmV0dXJuIHR5cGVvZiBlbWFpbCA9PT0gXCJzdHJpbmdcIiAmJiBlbWFpbC5sZW5ndGggPiAzICYmIGVtYWlsLmluY2x1ZGVzKFwiQFwiKTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7XG4gIEFjdGlvbkZ1bmN0aW9uLFxuICBMb2FkZXJGdW5jdGlvbixcbiAgTWV0YUZ1bmN0aW9uLFxufSBmcm9tIFwiQHJlbWl4LXJ1bi9ub2RlXCI7XG5pbXBvcnQgeyBqc29uLCByZWRpcmVjdCB9IGZyb20gXCJAcmVtaXgtcnVuL25vZGVcIjtcbmltcG9ydCB7IEZvcm0sIExpbmssIHVzZUFjdGlvbkRhdGEsIHVzZVNlYXJjaFBhcmFtcyB9IGZyb20gXCJAcmVtaXgtcnVuL3JlYWN0XCI7XG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tIFwicmVhY3RcIjtcblxuaW1wb3J0IHsgY3JlYXRlVXNlclNlc3Npb24sIGdldFVzZXJJZCB9IGZyb20gXCJ+L3Nlc3Npb24uc2VydmVyXCI7XG5pbXBvcnQgeyB2ZXJpZnlMb2dpbiB9IGZyb20gXCJ+L21vZGVscy91c2VyLnNlcnZlclwiO1xuaW1wb3J0IHsgdmFsaWRhdGVFbWFpbCB9IGZyb20gXCJ+L3V0aWxzXCI7XG5cbmV4cG9ydCBjb25zdCBsb2FkZXI6IExvYWRlckZ1bmN0aW9uID0gYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gIGNvbnN0IHVzZXJJZCA9IGF3YWl0IGdldFVzZXJJZChyZXF1ZXN0KTtcbiAgaWYgKHVzZXJJZCkgcmV0dXJuIHJlZGlyZWN0KFwiL1wiKTtcbiAgcmV0dXJuIGpzb24oe30pO1xufTtcblxuaW50ZXJmYWNlIEFjdGlvbkRhdGEge1xuICBlcnJvcnM/OiB7XG4gICAgZW1haWw/OiBzdHJpbmc7XG4gICAgcGFzc3dvcmQ/OiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCBjb25zdCBhY3Rpb246IEFjdGlvbkZ1bmN0aW9uID0gYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gIGNvbnN0IGZvcm1EYXRhID0gYXdhaXQgcmVxdWVzdC5mb3JtRGF0YSgpO1xuICBjb25zdCBlbWFpbCA9IGZvcm1EYXRhLmdldChcImVtYWlsXCIpO1xuICBjb25zdCBwYXNzd29yZCA9IGZvcm1EYXRhLmdldChcInBhc3N3b3JkXCIpO1xuICBjb25zdCByZWRpcmVjdFRvID0gZm9ybURhdGEuZ2V0KFwicmVkaXJlY3RUb1wiKTtcbiAgY29uc3QgcmVtZW1iZXIgPSBmb3JtRGF0YS5nZXQoXCJyZW1lbWJlclwiKTtcblxuICBpZiAoIXZhbGlkYXRlRW1haWwoZW1haWwpKSB7XG4gICAgcmV0dXJuIGpzb248QWN0aW9uRGF0YT4oXG4gICAgICB7IGVycm9yczogeyBlbWFpbDogXCJFbWFpbCBpcyBpbnZhbGlkXCIgfSB9LFxuICAgICAgeyBzdGF0dXM6IDQwMCB9XG4gICAgKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGFzc3dvcmQgIT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4ganNvbjxBY3Rpb25EYXRhPihcbiAgICAgIHsgZXJyb3JzOiB7IHBhc3N3b3JkOiBcIlBhc3N3b3JkIGlzIHJlcXVpcmVkXCIgfSB9LFxuICAgICAgeyBzdGF0dXM6IDQwMCB9XG4gICAgKTtcbiAgfVxuXG4gIGlmIChwYXNzd29yZC5sZW5ndGggPCA4KSB7XG4gICAgcmV0dXJuIGpzb248QWN0aW9uRGF0YT4oXG4gICAgICB7IGVycm9yczogeyBwYXNzd29yZDogXCJQYXNzd29yZCBpcyB0b28gc2hvcnRcIiB9IH0sXG4gICAgICB7IHN0YXR1czogNDAwIH1cbiAgICApO1xuICB9XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHZlcmlmeUxvZ2luKGVtYWlsLCBwYXNzd29yZCk7XG5cbiAgaWYgKCF1c2VyKSB7XG4gICAgcmV0dXJuIGpzb248QWN0aW9uRGF0YT4oXG4gICAgICB7IGVycm9yczogeyBlbWFpbDogXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIgfSB9LFxuICAgICAgeyBzdGF0dXM6IDQwMCB9XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBjcmVhdGVVc2VyU2Vzc2lvbih7XG4gICAgcmVxdWVzdCxcbiAgICB1c2VySWQ6IHVzZXIuaWQsXG4gICAgcmVtZW1iZXI6IHJlbWVtYmVyID09PSBcIm9uXCIgPyB0cnVlIDogZmFsc2UsXG4gICAgcmVkaXJlY3RUbzogdHlwZW9mIHJlZGlyZWN0VG8gPT09IFwic3RyaW5nXCIgPyByZWRpcmVjdFRvIDogXCIvbm90ZXNcIixcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgbWV0YTogTWV0YUZ1bmN0aW9uID0gKCkgPT4ge1xuICByZXR1cm4ge1xuICAgIHRpdGxlOiBcIkxvZ2luXCIsXG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBMb2dpblBhZ2UoKSB7XG4gIGNvbnN0IFtzZWFyY2hQYXJhbXNdID0gdXNlU2VhcmNoUGFyYW1zKCk7XG4gIGNvbnN0IHJlZGlyZWN0VG8gPSBzZWFyY2hQYXJhbXMuZ2V0KFwicmVkaXJlY3RUb1wiKSB8fCBcIi9ub3Rlc1wiO1xuICBjb25zdCBhY3Rpb25EYXRhID0gdXNlQWN0aW9uRGF0YSgpIGFzIEFjdGlvbkRhdGE7XG4gIGNvbnN0IGVtYWlsUmVmID0gUmVhY3QudXNlUmVmPEhUTUxJbnB1dEVsZW1lbnQ+KG51bGwpO1xuICBjb25zdCBwYXNzd29yZFJlZiA9IFJlYWN0LnVzZVJlZjxIVE1MSW5wdXRFbGVtZW50PihudWxsKTtcblxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChhY3Rpb25EYXRhPy5lcnJvcnM/LmVtYWlsKSB7XG4gICAgICBlbWFpbFJlZi5jdXJyZW50Py5mb2N1cygpO1xuICAgIH0gZWxzZSBpZiAoYWN0aW9uRGF0YT8uZXJyb3JzPy5wYXNzd29yZCkge1xuICAgICAgcGFzc3dvcmRSZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICB9XG4gIH0sIFthY3Rpb25EYXRhXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggbWluLWgtZnVsbCBmbGV4LWNvbCBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJteC1hdXRvIHctZnVsbCBtYXgtdy1tZCBweC04XCI+XG4gICAgICAgIDxGb3JtIG1ldGhvZD1cInBvc3RcIiBjbGFzc05hbWU9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGxhYmVsXG4gICAgICAgICAgICAgIGh0bWxGb3I9XCJlbWFpbFwiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJsb2NrIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1ncmF5LTcwMFwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIEVtYWlsIGFkZHJlc3NcbiAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTFcIj5cbiAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgcmVmPXtlbWFpbFJlZn1cbiAgICAgICAgICAgICAgICBpZD1cImVtYWlsXCJcbiAgICAgICAgICAgICAgICByZXF1aXJlZFxuICAgICAgICAgICAgICAgIGF1dG9Gb2N1cz17dHJ1ZX1cbiAgICAgICAgICAgICAgICBuYW1lPVwiZW1haWxcIlxuICAgICAgICAgICAgICAgIHR5cGU9XCJlbWFpbFwiXG4gICAgICAgICAgICAgICAgYXV0b0NvbXBsZXRlPVwiZW1haWxcIlxuICAgICAgICAgICAgICAgIGFyaWEtaW52YWxpZD17YWN0aW9uRGF0YT8uZXJyb3JzPy5lbWFpbCA/IHRydWUgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgYXJpYS1kZXNjcmliZWRieT1cImVtYWlsLWVycm9yXCJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcm91bmRlZCBib3JkZXIgYm9yZGVyLWdyYXktNTAwIHB4LTIgcHktMSB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAge2FjdGlvbkRhdGE/LmVycm9ycz8uZW1haWwgJiYgKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHQtMSB0ZXh0LXJlZC03MDBcIiBpZD1cImVtYWlsLWVycm9yXCI+XG4gICAgICAgICAgICAgICAgICB7YWN0aW9uRGF0YS5lcnJvcnMuZW1haWx9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICA8bGFiZWxcbiAgICAgICAgICAgICAgaHRtbEZvcj1cInBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LWdyYXktNzAwXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgUGFzc3dvcmRcbiAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTFcIj5cbiAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgaWQ9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgcmVmPXtwYXNzd29yZFJlZn1cbiAgICAgICAgICAgICAgICBuYW1lPVwicGFzc3dvcmRcIlxuICAgICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgYXV0b0NvbXBsZXRlPVwiY3VycmVudC1wYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgYXJpYS1pbnZhbGlkPXthY3Rpb25EYXRhPy5lcnJvcnM/LnBhc3N3b3JkID8gdHJ1ZSA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICBhcmlhLWRlc2NyaWJlZGJ5PVwicGFzc3dvcmQtZXJyb3JcIlxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCByb3VuZGVkIGJvcmRlciBib3JkZXItZ3JheS01MDAgcHgtMiBweS0xIHRleHQtbGdcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICB7YWN0aW9uRGF0YT8uZXJyb3JzPy5wYXNzd29yZCAmJiAoXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwdC0xIHRleHQtcmVkLTcwMFwiIGlkPVwicGFzc3dvcmQtZXJyb3JcIj5cbiAgICAgICAgICAgICAgICAgIHthY3Rpb25EYXRhLmVycm9ycy5wYXNzd29yZH1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgPGlucHV0IHR5cGU9XCJoaWRkZW5cIiBuYW1lPVwicmVkaXJlY3RUb1wiIHZhbHVlPXtyZWRpcmVjdFRvfSAvPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJzdWJtaXRcIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHJvdW5kZWQgYmctYmx1ZS01MDAgIHB5LTIgcHgtNCB0ZXh0LXdoaXRlIGhvdmVyOmJnLWJsdWUtNjAwIGZvY3VzOmJnLWJsdWUtNDAwXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICBMb2cgaW5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlclwiPlxuICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICBpZD1cInJlbWVtYmVyXCJcbiAgICAgICAgICAgICAgICBuYW1lPVwicmVtZW1iZXJcIlxuICAgICAgICAgICAgICAgIHR5cGU9XCJjaGVja2JveFwiXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiaC00IHctNCByb3VuZGVkIGJvcmRlci1ncmF5LTMwMCB0ZXh0LWJsdWUtNjAwIGZvY3VzOnJpbmctYmx1ZS01MDBcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8bGFiZWxcbiAgICAgICAgICAgICAgICBodG1sRm9yPVwicmVtZW1iZXJcIlxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cIm1sLTIgYmxvY2sgdGV4dC1zbSB0ZXh0LWdyYXktOTAwXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIFJlbWVtYmVyIG1lXG4gICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgdGV4dC1zbSB0ZXh0LWdyYXktNTAwXCI+XG4gICAgICAgICAgICAgIERvbid0IGhhdmUgYW4gYWNjb3VudD97XCIgXCJ9XG4gICAgICAgICAgICAgIDxMaW5rXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1ibHVlLTUwMCB1bmRlcmxpbmVcIlxuICAgICAgICAgICAgICAgIHRvPXt7XG4gICAgICAgICAgICAgICAgICBwYXRobmFtZTogXCIvam9pblwiLFxuICAgICAgICAgICAgICAgICAgc2VhcmNoOiBzZWFyY2hQYXJhbXMudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgU2lnbiB1cFxuICAgICAgICAgICAgICA8L0xpbms+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9Gb3JtPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBMb2FkZXJGdW5jdGlvbiB9IGZyb20gXCJAcmVtaXgtcnVuL25vZGVcIjtcbmltcG9ydCB7IGpzb24gfSBmcm9tIFwiQHJlbWl4LXJ1bi9ub2RlXCI7XG5pbXBvcnQgeyBGb3JtLCBMaW5rLCBOYXZMaW5rLCBPdXRsZXQsIHVzZUxvYWRlckRhdGEgfSBmcm9tIFwiQHJlbWl4LXJ1bi9yZWFjdFwiO1xuXG5pbXBvcnQgeyByZXF1aXJlVXNlcklkIH0gZnJvbSBcIn4vc2Vzc2lvbi5zZXJ2ZXJcIjtcbmltcG9ydCB7IHVzZVVzZXIgfSBmcm9tIFwifi91dGlsc1wiO1xuaW1wb3J0IHsgZ2V0Tm90ZUxpc3RJdGVtcyB9IGZyb20gXCJ+L21vZGVscy9ub3RlLnNlcnZlclwiO1xuXG50eXBlIExvYWRlckRhdGEgPSB7XG4gIG5vdGVMaXN0SXRlbXM6IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgZ2V0Tm90ZUxpc3RJdGVtcz4+O1xufTtcblxuZXhwb3J0IGNvbnN0IGxvYWRlcjogTG9hZGVyRnVuY3Rpb24gPSBhc3luYyAoeyByZXF1ZXN0IH0pID0+IHtcbiAgY29uc3QgdXNlcklkID0gYXdhaXQgcmVxdWlyZVVzZXJJZChyZXF1ZXN0KTtcbiAgY29uc3Qgbm90ZUxpc3RJdGVtcyA9IGF3YWl0IGdldE5vdGVMaXN0SXRlbXMoeyB1c2VySWQgfSk7XG4gIHJldHVybiBqc29uPExvYWRlckRhdGE+KHsgbm90ZUxpc3RJdGVtcyB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIE5vdGVzUGFnZSgpIHtcbiAgY29uc3QgZGF0YSA9IHVzZUxvYWRlckRhdGEoKSBhcyBMb2FkZXJEYXRhO1xuICBjb25zdCB1c2VyID0gdXNlVXNlcigpO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGgtZnVsbCBtaW4taC1zY3JlZW4gZmxleC1jb2xcIj5cbiAgICAgIDxoZWFkZXIgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGJnLXNsYXRlLTgwMCBwLTQgdGV4dC13aGl0ZVwiPlxuICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC0zeGwgZm9udC1ib2xkXCI+XG4gICAgICAgICAgPExpbmsgdG89XCIuXCI+Tm90ZXM8L0xpbms+XG4gICAgICAgIDwvaDE+XG4gICAgICAgIDxwPnt1c2VyLmVtYWlsfTwvcD5cbiAgICAgICAgPEZvcm0gYWN0aW9uPVwiL2xvZ291dFwiIG1ldGhvZD1cInBvc3RcIj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICB0eXBlPVwic3VibWl0XCJcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQgYmctc2xhdGUtNjAwIHB5LTIgcHgtNCB0ZXh0LWJsdWUtMTAwIGhvdmVyOmJnLWJsdWUtNTAwIGFjdGl2ZTpiZy1ibHVlLTYwMFwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgTG9nb3V0XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvRm9ybT5cbiAgICAgIDwvaGVhZGVyPlxuXG4gICAgICA8bWFpbiBjbGFzc05hbWU9XCJmbGV4IGgtZnVsbCBiZy13aGl0ZVwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImgtZnVsbCB3LTgwIGJvcmRlci1yIGJnLWdyYXktNTBcIj5cbiAgICAgICAgICA8TGluayB0bz1cIm5ld1wiIGNsYXNzTmFtZT1cImJsb2NrIHAtNCB0ZXh0LXhsIHRleHQtYmx1ZS01MDBcIj5cbiAgICAgICAgICAgICsgTmV3IE5vdGVcbiAgICAgICAgICA8L0xpbms+XG5cbiAgICAgICAgICA8aHIgLz5cblxuICAgICAgICAgIHtkYXRhLm5vdGVMaXN0SXRlbXMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwicC00XCI+Tm8gbm90ZXMgeWV0PC9wPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8b2w+XG4gICAgICAgICAgICAgIHtkYXRhLm5vdGVMaXN0SXRlbXMubWFwKChub3RlKSA9PiAoXG4gICAgICAgICAgICAgICAgPGxpIGtleT17bm90ZS5pZH0+XG4gICAgICAgICAgICAgICAgICA8TmF2TGlua1xuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9eyh7IGlzQWN0aXZlIH0pID0+XG4gICAgICAgICAgICAgICAgICAgICAgYGJsb2NrIGJvcmRlci1iIHAtNCB0ZXh0LXhsICR7aXNBY3RpdmUgPyBcImJnLXdoaXRlXCIgOiBcIlwifWBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0bz17bm90ZS5pZH1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgXHVEODNEXHVEQ0REIHtub3RlLnRpdGxlfVxuICAgICAgICAgICAgICAgICAgPC9OYXZMaW5rPlxuICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgPC9vbD5cbiAgICAgICAgICApfVxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBwLTZcIj5cbiAgICAgICAgICA8T3V0bGV0IC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9tYWluPlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwgImltcG9ydCB0eXBlIHsgVXNlciwgTm90ZSB9IGZyb20gXCJAcHJpc21hL2NsaWVudFwiO1xuXG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwifi9kYi5zZXJ2ZXJcIjtcblxuZXhwb3J0IHR5cGUgeyBOb3RlIH0gZnJvbSBcIkBwcmlzbWEvY2xpZW50XCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROb3RlKHtcbiAgaWQsXG4gIHVzZXJJZCxcbn06IFBpY2s8Tm90ZSwgXCJpZFwiPiAmIHtcbiAgdXNlcklkOiBVc2VyW1wiaWRcIl07XG59KSB7XG4gIHJldHVybiBwcmlzbWEubm90ZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IGlkLCB1c2VySWQgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROb3RlTGlzdEl0ZW1zKHsgdXNlcklkIH06IHsgdXNlcklkOiBVc2VyW1wiaWRcIl0gfSkge1xuICByZXR1cm4gcHJpc21hLm5vdGUuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgdGl0bGU6IHRydWUgfSxcbiAgICBvcmRlckJ5OiB7IHVwZGF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVOb3RlKHtcbiAgYm9keSxcbiAgdGl0bGUsXG4gIHVzZXJJZCxcbn06IFBpY2s8Tm90ZSwgXCJib2R5XCIgfCBcInRpdGxlXCI+ICYge1xuICB1c2VySWQ6IFVzZXJbXCJpZFwiXTtcbn0pIHtcbiAgcmV0dXJuIHByaXNtYS5ub3RlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGUsXG4gICAgICBib2R5LFxuICAgICAgdXNlcjoge1xuICAgICAgICBjb25uZWN0OiB7XG4gICAgICAgICAgaWQ6IHVzZXJJZCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWxldGVOb3RlKHtcbiAgaWQsXG4gIHVzZXJJZCxcbn06IFBpY2s8Tm90ZSwgXCJpZFwiPiAmIHsgdXNlcklkOiBVc2VyW1wiaWRcIl0gfSkge1xuICByZXR1cm4gcHJpc21hLm5vdGUuZGVsZXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQsIHVzZXJJZCB9LFxuICB9KTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IEFjdGlvbkZ1bmN0aW9uLCBMb2FkZXJGdW5jdGlvbiB9IGZyb20gXCJAcmVtaXgtcnVuL25vZGVcIjtcbmltcG9ydCB7IGpzb24sIHJlZGlyZWN0IH0gZnJvbSBcIkByZW1peC1ydW4vbm9kZVwiO1xuaW1wb3J0IHsgRm9ybSwgdXNlQ2F0Y2gsIHVzZUxvYWRlckRhdGEgfSBmcm9tIFwiQHJlbWl4LXJ1bi9yZWFjdFwiO1xuaW1wb3J0IGludmFyaWFudCBmcm9tIFwidGlueS1pbnZhcmlhbnRcIjtcblxuaW1wb3J0IHR5cGUgeyBOb3RlIH0gZnJvbSBcIn4vbW9kZWxzL25vdGUuc2VydmVyXCI7XG5pbXBvcnQgeyBkZWxldGVOb3RlIH0gZnJvbSBcIn4vbW9kZWxzL25vdGUuc2VydmVyXCI7XG5pbXBvcnQgeyBnZXROb3RlIH0gZnJvbSBcIn4vbW9kZWxzL25vdGUuc2VydmVyXCI7XG5pbXBvcnQgeyByZXF1aXJlVXNlcklkIH0gZnJvbSBcIn4vc2Vzc2lvbi5zZXJ2ZXJcIjtcblxudHlwZSBMb2FkZXJEYXRhID0ge1xuICBub3RlOiBOb3RlO1xufTtcblxuZXhwb3J0IGNvbnN0IGxvYWRlcjogTG9hZGVyRnVuY3Rpb24gPSBhc3luYyAoeyByZXF1ZXN0LCBwYXJhbXMgfSkgPT4ge1xuICBjb25zdCB1c2VySWQgPSBhd2FpdCByZXF1aXJlVXNlcklkKHJlcXVlc3QpO1xuICBpbnZhcmlhbnQocGFyYW1zLm5vdGVJZCwgXCJub3RlSWQgbm90IGZvdW5kXCIpO1xuXG4gIGNvbnN0IG5vdGUgPSBhd2FpdCBnZXROb3RlKHsgdXNlcklkLCBpZDogcGFyYW1zLm5vdGVJZCB9KTtcbiAgaWYgKCFub3RlKSB7XG4gICAgdGhyb3cgbmV3IFJlc3BvbnNlKFwiTm90IEZvdW5kXCIsIHsgc3RhdHVzOiA0MDQgfSk7XG4gIH1cbiAgcmV0dXJuIGpzb248TG9hZGVyRGF0YT4oeyBub3RlIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGFjdGlvbjogQWN0aW9uRnVuY3Rpb24gPSBhc3luYyAoeyByZXF1ZXN0LCBwYXJhbXMgfSkgPT4ge1xuICBjb25zdCB1c2VySWQgPSBhd2FpdCByZXF1aXJlVXNlcklkKHJlcXVlc3QpO1xuICBpbnZhcmlhbnQocGFyYW1zLm5vdGVJZCwgXCJub3RlSWQgbm90IGZvdW5kXCIpO1xuXG4gIGF3YWl0IGRlbGV0ZU5vdGUoeyB1c2VySWQsIGlkOiBwYXJhbXMubm90ZUlkIH0pO1xuXG4gIHJldHVybiByZWRpcmVjdChcIi9ub3Rlc1wiKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIE5vdGVEZXRhaWxzUGFnZSgpIHtcbiAgY29uc3QgZGF0YSA9IHVzZUxvYWRlckRhdGEoKSBhcyBMb2FkZXJEYXRhO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdj5cbiAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBmb250LWJvbGRcIj57ZGF0YS5ub3RlLnRpdGxlfTwvaDM+XG4gICAgICA8cCBjbGFzc05hbWU9XCJweS02XCI+e2RhdGEubm90ZS5ib2R5fTwvcD5cbiAgICAgIDxociBjbGFzc05hbWU9XCJteS00XCIgLz5cbiAgICAgIDxGb3JtIG1ldGhvZD1cInBvc3RcIj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJzdWJtaXRcIlxuICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQgYmctYmx1ZS01MDAgIHB5LTIgcHgtNCB0ZXh0LXdoaXRlIGhvdmVyOmJnLWJsdWUtNjAwIGZvY3VzOmJnLWJsdWUtNDAwXCJcbiAgICAgICAgPlxuICAgICAgICAgIERlbGV0ZVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvRm9ybT5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEVycm9yQm91bmRhcnkoeyBlcnJvciB9OiB7IGVycm9yOiBFcnJvciB9KSB7XG4gIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuXG4gIHJldHVybiA8ZGl2PkFuIHVuZXhwZWN0ZWQgZXJyb3Igb2NjdXJyZWQ6IHtlcnJvci5tZXNzYWdlfTwvZGl2Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIENhdGNoQm91bmRhcnkoKSB7XG4gIGNvbnN0IGNhdWdodCA9IHVzZUNhdGNoKCk7XG5cbiAgaWYgKGNhdWdodC5zdGF0dXMgPT09IDQwNCkge1xuICAgIHJldHVybiA8ZGl2Pk5vdGUgbm90IGZvdW5kPC9kaXY+O1xuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGNhdWdodCByZXNwb25zZSB3aXRoIHN0YXR1czogJHtjYXVnaHQuc3RhdHVzfWApO1xufVxuIiwgImltcG9ydCB7IExpbmsgfSBmcm9tIFwiQHJlbWl4LXJ1bi9yZWFjdFwiO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBOb3RlSW5kZXhQYWdlKCkge1xuICByZXR1cm4gKFxuICAgIDxwPlxuICAgICAgTm8gbm90ZSBzZWxlY3RlZC4gU2VsZWN0IGEgbm90ZSBvbiB0aGUgbGVmdCwgb3J7XCIgXCJ9XG4gICAgICA8TGluayB0bz1cIm5ld1wiIGNsYXNzTmFtZT1cInRleHQtYmx1ZS01MDAgdW5kZXJsaW5lXCI+XG4gICAgICAgIGNyZWF0ZSBhIG5ldyBub3RlLlxuICAgICAgPC9MaW5rPlxuICAgIDwvcD5cbiAgKTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IEFjdGlvbkZ1bmN0aW9uIH0gZnJvbSBcIkByZW1peC1ydW4vbm9kZVwiO1xuaW1wb3J0IHsganNvbiwgcmVkaXJlY3QgfSBmcm9tIFwiQHJlbWl4LXJ1bi9ub2RlXCI7XG5pbXBvcnQgeyBGb3JtLCB1c2VBY3Rpb25EYXRhIH0gZnJvbSBcIkByZW1peC1ydW4vcmVhY3RcIjtcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiO1xuXG5pbXBvcnQgeyBjcmVhdGVOb3RlIH0gZnJvbSBcIn4vbW9kZWxzL25vdGUuc2VydmVyXCI7XG5pbXBvcnQgeyByZXF1aXJlVXNlcklkIH0gZnJvbSBcIn4vc2Vzc2lvbi5zZXJ2ZXJcIjtcblxudHlwZSBBY3Rpb25EYXRhID0ge1xuICBlcnJvcnM/OiB7XG4gICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgYm9keT86IHN0cmluZztcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBhY3Rpb246IEFjdGlvbkZ1bmN0aW9uID0gYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gIGNvbnN0IHVzZXJJZCA9IGF3YWl0IHJlcXVpcmVVc2VySWQocmVxdWVzdCk7XG5cbiAgY29uc3QgZm9ybURhdGEgPSBhd2FpdCByZXF1ZXN0LmZvcm1EYXRhKCk7XG4gIGNvbnN0IHRpdGxlID0gZm9ybURhdGEuZ2V0KFwidGl0bGVcIik7XG4gIGNvbnN0IGJvZHkgPSBmb3JtRGF0YS5nZXQoXCJib2R5XCIpO1xuXG4gIGlmICh0eXBlb2YgdGl0bGUgIT09IFwic3RyaW5nXCIgfHwgdGl0bGUubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGpzb248QWN0aW9uRGF0YT4oXG4gICAgICB7IGVycm9yczogeyB0aXRsZTogXCJUaXRsZSBpcyByZXF1aXJlZFwiIH0gfSxcbiAgICAgIHsgc3RhdHVzOiA0MDAgfVxuICAgICk7XG4gIH1cblxuICBpZiAodHlwZW9mIGJvZHkgIT09IFwic3RyaW5nXCIgfHwgYm9keS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4ganNvbjxBY3Rpb25EYXRhPihcbiAgICAgIHsgZXJyb3JzOiB7IGJvZHk6IFwiQm9keSBpcyByZXF1aXJlZFwiIH0gfSxcbiAgICAgIHsgc3RhdHVzOiA0MDAgfVxuICAgICk7XG4gIH1cblxuICBjb25zdCBub3RlID0gYXdhaXQgY3JlYXRlTm90ZSh7IHRpdGxlLCBib2R5LCB1c2VySWQgfSk7XG5cbiAgcmV0dXJuIHJlZGlyZWN0KGAvbm90ZXMvJHtub3RlLmlkfWApO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gTmV3Tm90ZVBhZ2UoKSB7XG4gIGNvbnN0IGFjdGlvbkRhdGEgPSB1c2VBY3Rpb25EYXRhKCkgYXMgQWN0aW9uRGF0YTtcbiAgY29uc3QgdGl0bGVSZWYgPSBSZWFjdC51c2VSZWY8SFRNTElucHV0RWxlbWVudD4obnVsbCk7XG4gIGNvbnN0IGJvZHlSZWYgPSBSZWFjdC51c2VSZWY8SFRNTFRleHRBcmVhRWxlbWVudD4obnVsbCk7XG5cbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoYWN0aW9uRGF0YT8uZXJyb3JzPy50aXRsZSkge1xuICAgICAgdGl0bGVSZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICB9IGVsc2UgaWYgKGFjdGlvbkRhdGE/LmVycm9ycz8uYm9keSkge1xuICAgICAgYm9keVJlZi5jdXJyZW50Py5mb2N1cygpO1xuICAgIH1cbiAgfSwgW2FjdGlvbkRhdGFdKTtcblxuICByZXR1cm4gKFxuICAgIDxGb3JtXG4gICAgICBtZXRob2Q9XCJwb3N0XCJcbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICBnYXA6IDgsXG4gICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgIH19XG4gICAgPlxuICAgICAgPGRpdj5cbiAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImZsZXggdy1mdWxsIGZsZXgtY29sIGdhcC0xXCI+XG4gICAgICAgICAgPHNwYW4+VGl0bGU6IDwvc3Bhbj5cbiAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgIHJlZj17dGl0bGVSZWZ9XG4gICAgICAgICAgICBuYW1lPVwidGl0bGVcIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC0xIHJvdW5kZWQtbWQgYm9yZGVyLTIgYm9yZGVyLWJsdWUtNTAwIHB4LTMgdGV4dC1sZyBsZWFkaW5nLWxvb3NlXCJcbiAgICAgICAgICAgIGFyaWEtaW52YWxpZD17YWN0aW9uRGF0YT8uZXJyb3JzPy50aXRsZSA/IHRydWUgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICBhcmlhLWVycm9ybWVzc2FnZT17XG4gICAgICAgICAgICAgIGFjdGlvbkRhdGE/LmVycm9ycz8udGl0bGUgPyBcInRpdGxlLWVycm9yXCIgOiB1bmRlZmluZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAvPlxuICAgICAgICA8L2xhYmVsPlxuICAgICAgICB7YWN0aW9uRGF0YT8uZXJyb3JzPy50aXRsZSAmJiAoXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwdC0xIHRleHQtcmVkLTcwMFwiIGlkPVwidGl0bGUtZXJyb3JcIj5cbiAgICAgICAgICAgIHthY3Rpb25EYXRhLmVycm9ycy50aXRsZX1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKX1cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2PlxuICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZmxleCB3LWZ1bGwgZmxleC1jb2wgZ2FwLTFcIj5cbiAgICAgICAgICA8c3Bhbj5Cb2R5OiA8L3NwYW4+XG4gICAgICAgICAgPHRleHRhcmVhXG4gICAgICAgICAgICByZWY9e2JvZHlSZWZ9XG4gICAgICAgICAgICBuYW1lPVwiYm9keVwiXG4gICAgICAgICAgICByb3dzPXs4fVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGZsZXgtMSByb3VuZGVkLW1kIGJvcmRlci0yIGJvcmRlci1ibHVlLTUwMCBweS0yIHB4LTMgdGV4dC1sZyBsZWFkaW5nLTZcIlxuICAgICAgICAgICAgYXJpYS1pbnZhbGlkPXthY3Rpb25EYXRhPy5lcnJvcnM/LmJvZHkgPyB0cnVlIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgYXJpYS1lcnJvcm1lc3NhZ2U9e1xuICAgICAgICAgICAgICBhY3Rpb25EYXRhPy5lcnJvcnM/LmJvZHkgPyBcImJvZHktZXJyb3JcIiA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIHthY3Rpb25EYXRhPy5lcnJvcnM/LmJvZHkgJiYgKFxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHQtMSB0ZXh0LXJlZC03MDBcIiBpZD1cImJvZHktZXJyb3JcIj5cbiAgICAgICAgICAgIHthY3Rpb25EYXRhLmVycm9ycy5ib2R5fVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1yaWdodFwiPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cInN1Ym1pdFwiXG4gICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZCBiZy1ibHVlLTUwMCBweS0yIHB4LTQgdGV4dC13aGl0ZSBob3ZlcjpiZy1ibHVlLTYwMCBmb2N1czpiZy1ibHVlLTQwMFwiXG4gICAgICAgID5cbiAgICAgICAgICBTYXZlXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9Gb3JtPlxuICApO1xufVxuIiwgImltcG9ydCB0eXBlIHtcbiAgQWN0aW9uRnVuY3Rpb24sXG4gIExvYWRlckZ1bmN0aW9uLFxuICBNZXRhRnVuY3Rpb24sXG59IGZyb20gXCJAcmVtaXgtcnVuL25vZGVcIjtcbmltcG9ydCB7IGpzb24sIHJlZGlyZWN0IH0gZnJvbSBcIkByZW1peC1ydW4vbm9kZVwiO1xuaW1wb3J0IHsgRm9ybSwgTGluaywgdXNlQWN0aW9uRGF0YSwgdXNlU2VhcmNoUGFyYW1zIH0gZnJvbSBcIkByZW1peC1ydW4vcmVhY3RcIjtcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiO1xuXG5pbXBvcnQgeyBnZXRVc2VySWQsIGNyZWF0ZVVzZXJTZXNzaW9uIH0gZnJvbSBcIn4vc2Vzc2lvbi5zZXJ2ZXJcIjtcblxuaW1wb3J0IHsgY3JlYXRlVXNlciwgZ2V0VXNlckJ5RW1haWwgfSBmcm9tIFwifi9tb2RlbHMvdXNlci5zZXJ2ZXJcIjtcbmltcG9ydCB7IHZhbGlkYXRlRW1haWwgfSBmcm9tIFwifi91dGlsc1wiO1xuXG5leHBvcnQgY29uc3QgbG9hZGVyOiBMb2FkZXJGdW5jdGlvbiA9IGFzeW5jICh7IHJlcXVlc3QgfSkgPT4ge1xuICBjb25zdCB1c2VySWQgPSBhd2FpdCBnZXRVc2VySWQocmVxdWVzdCk7XG4gIGlmICh1c2VySWQpIHJldHVybiByZWRpcmVjdChcIi9cIik7XG4gIHJldHVybiBqc29uKHt9KTtcbn07XG5cbmludGVyZmFjZSBBY3Rpb25EYXRhIHtcbiAgZXJyb3JzOiB7XG4gICAgZW1haWw/OiBzdHJpbmc7XG4gICAgcGFzc3dvcmQ/OiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCBjb25zdCBhY3Rpb246IEFjdGlvbkZ1bmN0aW9uID0gYXN5bmMgKHsgcmVxdWVzdCB9KSA9PiB7XG4gIGNvbnN0IGZvcm1EYXRhID0gYXdhaXQgcmVxdWVzdC5mb3JtRGF0YSgpO1xuICBjb25zdCBlbWFpbCA9IGZvcm1EYXRhLmdldChcImVtYWlsXCIpO1xuICBjb25zdCBwYXNzd29yZCA9IGZvcm1EYXRhLmdldChcInBhc3N3b3JkXCIpO1xuICBjb25zdCByZWRpcmVjdFRvID0gZm9ybURhdGEuZ2V0KFwicmVkaXJlY3RUb1wiKTtcblxuICBpZiAoIXZhbGlkYXRlRW1haWwoZW1haWwpKSB7XG4gICAgcmV0dXJuIGpzb248QWN0aW9uRGF0YT4oXG4gICAgICB7IGVycm9yczogeyBlbWFpbDogXCJFbWFpbCBpcyBpbnZhbGlkXCIgfSB9LFxuICAgICAgeyBzdGF0dXM6IDQwMCB9XG4gICAgKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGFzc3dvcmQgIT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4ganNvbjxBY3Rpb25EYXRhPihcbiAgICAgIHsgZXJyb3JzOiB7IHBhc3N3b3JkOiBcIlBhc3N3b3JkIGlzIHJlcXVpcmVkXCIgfSB9LFxuICAgICAgeyBzdGF0dXM6IDQwMCB9XG4gICAgKTtcbiAgfVxuXG4gIGlmIChwYXNzd29yZC5sZW5ndGggPCA4KSB7XG4gICAgcmV0dXJuIGpzb248QWN0aW9uRGF0YT4oXG4gICAgICB7IGVycm9yczogeyBwYXNzd29yZDogXCJQYXNzd29yZCBpcyB0b28gc2hvcnRcIiB9IH0sXG4gICAgICB7IHN0YXR1czogNDAwIH1cbiAgICApO1xuICB9XG5cbiAgY29uc3QgZXhpc3RpbmdVc2VyID0gYXdhaXQgZ2V0VXNlckJ5RW1haWwoZW1haWwpO1xuICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgcmV0dXJuIGpzb248QWN0aW9uRGF0YT4oXG4gICAgICB7IGVycm9yczogeyBlbWFpbDogXCJBIHVzZXIgYWxyZWFkeSBleGlzdHMgd2l0aCB0aGlzIGVtYWlsXCIgfSB9LFxuICAgICAgeyBzdGF0dXM6IDQwMCB9XG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBjcmVhdGVVc2VyKGVtYWlsLCBwYXNzd29yZCk7XG5cbiAgcmV0dXJuIGNyZWF0ZVVzZXJTZXNzaW9uKHtcbiAgICByZXF1ZXN0LFxuICAgIHVzZXJJZDogdXNlci5pZCxcbiAgICByZW1lbWJlcjogZmFsc2UsXG4gICAgcmVkaXJlY3RUbzogdHlwZW9mIHJlZGlyZWN0VG8gPT09IFwic3RyaW5nXCIgPyByZWRpcmVjdFRvIDogXCIvXCIsXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IG1ldGE6IE1ldGFGdW5jdGlvbiA9ICgpID0+IHtcbiAgcmV0dXJuIHtcbiAgICB0aXRsZTogXCJTaWduIFVwXCIsXG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBKb2luKCkge1xuICBjb25zdCBbc2VhcmNoUGFyYW1zXSA9IHVzZVNlYXJjaFBhcmFtcygpO1xuICBjb25zdCByZWRpcmVjdFRvID0gc2VhcmNoUGFyYW1zLmdldChcInJlZGlyZWN0VG9cIikgPz8gdW5kZWZpbmVkO1xuICBjb25zdCBhY3Rpb25EYXRhID0gdXNlQWN0aW9uRGF0YSgpIGFzIEFjdGlvbkRhdGE7XG4gIGNvbnN0IGVtYWlsUmVmID0gUmVhY3QudXNlUmVmPEhUTUxJbnB1dEVsZW1lbnQ+KG51bGwpO1xuICBjb25zdCBwYXNzd29yZFJlZiA9IFJlYWN0LnVzZVJlZjxIVE1MSW5wdXRFbGVtZW50PihudWxsKTtcblxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChhY3Rpb25EYXRhPy5lcnJvcnM/LmVtYWlsKSB7XG4gICAgICBlbWFpbFJlZi5jdXJyZW50Py5mb2N1cygpO1xuICAgIH0gZWxzZSBpZiAoYWN0aW9uRGF0YT8uZXJyb3JzPy5wYXNzd29yZCkge1xuICAgICAgcGFzc3dvcmRSZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICB9XG4gIH0sIFthY3Rpb25EYXRhXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggbWluLWgtZnVsbCBmbGV4LWNvbCBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJteC1hdXRvIHctZnVsbCBtYXgtdy1tZCBweC04XCI+XG4gICAgICAgIDxGb3JtIG1ldGhvZD1cInBvc3RcIiBjbGFzc05hbWU9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGxhYmVsXG4gICAgICAgICAgICAgIGh0bWxGb3I9XCJlbWFpbFwiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJsb2NrIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1ncmF5LTcwMFwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIEVtYWlsIGFkZHJlc3NcbiAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTFcIj5cbiAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgcmVmPXtlbWFpbFJlZn1cbiAgICAgICAgICAgICAgICBpZD1cImVtYWlsXCJcbiAgICAgICAgICAgICAgICByZXF1aXJlZFxuICAgICAgICAgICAgICAgIGF1dG9Gb2N1cz17dHJ1ZX1cbiAgICAgICAgICAgICAgICBuYW1lPVwiZW1haWxcIlxuICAgICAgICAgICAgICAgIHR5cGU9XCJlbWFpbFwiXG4gICAgICAgICAgICAgICAgYXV0b0NvbXBsZXRlPVwiZW1haWxcIlxuICAgICAgICAgICAgICAgIGFyaWEtaW52YWxpZD17YWN0aW9uRGF0YT8uZXJyb3JzPy5lbWFpbCA/IHRydWUgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgYXJpYS1kZXNjcmliZWRieT1cImVtYWlsLWVycm9yXCJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcm91bmRlZCBib3JkZXIgYm9yZGVyLWdyYXktNTAwIHB4LTIgcHktMSB0ZXh0LWxnXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAge2FjdGlvbkRhdGE/LmVycm9ycz8uZW1haWwgJiYgKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHQtMSB0ZXh0LXJlZC03MDBcIiBpZD1cImVtYWlsLWVycm9yXCI+XG4gICAgICAgICAgICAgICAgICB7YWN0aW9uRGF0YS5lcnJvcnMuZW1haWx9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICA8bGFiZWxcbiAgICAgICAgICAgICAgaHRtbEZvcj1cInBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LWdyYXktNzAwXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgUGFzc3dvcmRcbiAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTFcIj5cbiAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgaWQ9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgcmVmPXtwYXNzd29yZFJlZn1cbiAgICAgICAgICAgICAgICBuYW1lPVwicGFzc3dvcmRcIlxuICAgICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXG4gICAgICAgICAgICAgICAgYXV0b0NvbXBsZXRlPVwibmV3LXBhc3N3b3JkXCJcbiAgICAgICAgICAgICAgICBhcmlhLWludmFsaWQ9e2FjdGlvbkRhdGE/LmVycm9ycz8ucGFzc3dvcmQgPyB0cnVlIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICAgIGFyaWEtZGVzY3JpYmVkYnk9XCJwYXNzd29yZC1lcnJvclwiXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHJvdW5kZWQgYm9yZGVyIGJvcmRlci1ncmF5LTUwMCBweC0yIHB5LTEgdGV4dC1sZ1wiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIHthY3Rpb25EYXRhPy5lcnJvcnM/LnBhc3N3b3JkICYmIChcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB0LTEgdGV4dC1yZWQtNzAwXCIgaWQ9XCJwYXNzd29yZC1lcnJvclwiPlxuICAgICAgICAgICAgICAgICAge2FjdGlvbkRhdGEuZXJyb3JzLnBhc3N3b3JkfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8aW5wdXQgdHlwZT1cImhpZGRlblwiIG5hbWU9XCJyZWRpcmVjdFRvXCIgdmFsdWU9e3JlZGlyZWN0VG99IC8+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cInN1Ym1pdFwiXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcm91bmRlZCBiZy1ibHVlLTUwMCAgcHktMiBweC00IHRleHQtd2hpdGUgaG92ZXI6YmctYmx1ZS02MDAgZm9jdXM6YmctYmx1ZS00MDBcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIENyZWF0ZSBBY2NvdW50XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWNlbnRlciB0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5cbiAgICAgICAgICAgICAgQWxyZWFkeSBoYXZlIGFuIGFjY291bnQ/e1wiIFwifVxuICAgICAgICAgICAgICA8TGlua1xuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtYmx1ZS01MDAgdW5kZXJsaW5lXCJcbiAgICAgICAgICAgICAgICB0bz17e1xuICAgICAgICAgICAgICAgICAgcGF0aG5hbWU6IFwiL2xvZ2luXCIsXG4gICAgICAgICAgICAgICAgICBzZWFyY2g6IHNlYXJjaFBhcmFtcy50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICBMb2cgaW5cbiAgICAgICAgICAgICAgPC9MaW5rPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvRm9ybT5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwgImV4cG9ydCBkZWZhdWx0IHsndmVyc2lvbic6JzdlMzNmM2Y0JywnZW50cnknOnsnbW9kdWxlJzonL2J1aWxkL2VudHJ5LmNsaWVudC0zS0tDRkZRVS5qcycsJ2ltcG9ydHMnOlsnL2J1aWxkL19zaGFyZWQvY2h1bmstV0lSQklEMlIuanMnLCcvYnVpbGQvX3NoYXJlZC9jaHVuay1UWlJVSEFFTS5qcyddfSwncm91dGVzJzp7J3Jvb3QnOnsnaWQnOidyb290JywncGFyZW50SWQnOnVuZGVmaW5lZCwncGF0aCc6JycsJ2luZGV4Jzp1bmRlZmluZWQsJ2Nhc2VTZW5zaXRpdmUnOnVuZGVmaW5lZCwnbW9kdWxlJzonL2J1aWxkL3Jvb3QtRFlXUURCVE0uanMnLCdpbXBvcnRzJzpbJy9idWlsZC9fc2hhcmVkL2NodW5rLU5UREVIS0ZXLmpzJ10sJ2hhc0FjdGlvbic6ZmFsc2UsJ2hhc0xvYWRlcic6dHJ1ZSwnaGFzQ2F0Y2hCb3VuZGFyeSc6ZmFsc2UsJ2hhc0Vycm9yQm91bmRhcnknOmZhbHNlfSwncm91dGVzL2luZGV4Jzp7J2lkJzoncm91dGVzL2luZGV4JywncGFyZW50SWQnOidyb290JywncGF0aCc6dW5kZWZpbmVkLCdpbmRleCc6dHJ1ZSwnY2FzZVNlbnNpdGl2ZSc6dW5kZWZpbmVkLCdtb2R1bGUnOicvYnVpbGQvcm91dGVzL2luZGV4LTRTRjVIT05ILmpzJywnaW1wb3J0cyc6WycvYnVpbGQvX3NoYXJlZC9jaHVuay1FNVdDVUdPRS5qcyddLCdoYXNBY3Rpb24nOmZhbHNlLCdoYXNMb2FkZXInOmZhbHNlLCdoYXNDYXRjaEJvdW5kYXJ5JzpmYWxzZSwnaGFzRXJyb3JCb3VuZGFyeSc6ZmFsc2V9LCdyb3V0ZXMvam9pbic6eydpZCc6J3JvdXRlcy9qb2luJywncGFyZW50SWQnOidyb290JywncGF0aCc6J2pvaW4nLCdpbmRleCc6dW5kZWZpbmVkLCdjYXNlU2Vuc2l0aXZlJzp1bmRlZmluZWQsJ21vZHVsZSc6Jy9idWlsZC9yb3V0ZXMvam9pbi1XS0pGNDJQNC5qcycsJ2ltcG9ydHMnOlsnL2J1aWxkL19zaGFyZWQvY2h1bmstVVpTRlEyUE4uanMnLCcvYnVpbGQvX3NoYXJlZC9jaHVuay1FNVdDVUdPRS5qcycsJy9idWlsZC9fc2hhcmVkL2NodW5rLUFZS003SVZLLmpzJ10sJ2hhc0FjdGlvbic6dHJ1ZSwnaGFzTG9hZGVyJzp0cnVlLCdoYXNDYXRjaEJvdW5kYXJ5JzpmYWxzZSwnaGFzRXJyb3JCb3VuZGFyeSc6ZmFsc2V9LCdyb3V0ZXMvbG9naW4nOnsnaWQnOidyb3V0ZXMvbG9naW4nLCdwYXJlbnRJZCc6J3Jvb3QnLCdwYXRoJzonbG9naW4nLCdpbmRleCc6dW5kZWZpbmVkLCdjYXNlU2Vuc2l0aXZlJzp1bmRlZmluZWQsJ21vZHVsZSc6Jy9idWlsZC9yb3V0ZXMvbG9naW4tSkxERFNZNFEuanMnLCdpbXBvcnRzJzpbJy9idWlsZC9fc2hhcmVkL2NodW5rLVVaU0ZRMlBOLmpzJywnL2J1aWxkL19zaGFyZWQvY2h1bmstRTVXQ1VHT0UuanMnLCcvYnVpbGQvX3NoYXJlZC9jaHVuay1BWUtNN0lWSy5qcyddLCdoYXNBY3Rpb24nOnRydWUsJ2hhc0xvYWRlcic6dHJ1ZSwnaGFzQ2F0Y2hCb3VuZGFyeSc6ZmFsc2UsJ2hhc0Vycm9yQm91bmRhcnknOmZhbHNlfSwncm91dGVzL2xvZ291dCc6eydpZCc6J3JvdXRlcy9sb2dvdXQnLCdwYXJlbnRJZCc6J3Jvb3QnLCdwYXRoJzonbG9nb3V0JywnaW5kZXgnOnVuZGVmaW5lZCwnY2FzZVNlbnNpdGl2ZSc6dW5kZWZpbmVkLCdtb2R1bGUnOicvYnVpbGQvcm91dGVzL2xvZ291dC1CSDdOMlkyVi5qcycsJ2ltcG9ydHMnOlsnL2J1aWxkL19zaGFyZWQvY2h1bmstQVlLTTdJVksuanMnXSwnaGFzQWN0aW9uJzp0cnVlLCdoYXNMb2FkZXInOnRydWUsJ2hhc0NhdGNoQm91bmRhcnknOmZhbHNlLCdoYXNFcnJvckJvdW5kYXJ5JzpmYWxzZX0sJ3JvdXRlcy9ub3Rlcyc6eydpZCc6J3JvdXRlcy9ub3RlcycsJ3BhcmVudElkJzoncm9vdCcsJ3BhdGgnOidub3RlcycsJ2luZGV4Jzp1bmRlZmluZWQsJ2Nhc2VTZW5zaXRpdmUnOnVuZGVmaW5lZCwnbW9kdWxlJzonL2J1aWxkL3JvdXRlcy9ub3Rlcy1ORk9OVVBTVi5qcycsJ2ltcG9ydHMnOlsnL2J1aWxkL19zaGFyZWQvY2h1bmstRTVXQ1VHT0UuanMnLCcvYnVpbGQvX3NoYXJlZC9jaHVuay03REtQV0lRVC5qcycsJy9idWlsZC9fc2hhcmVkL2NodW5rLUFZS003SVZLLmpzJ10sJ2hhc0FjdGlvbic6ZmFsc2UsJ2hhc0xvYWRlcic6dHJ1ZSwnaGFzQ2F0Y2hCb3VuZGFyeSc6ZmFsc2UsJ2hhc0Vycm9yQm91bmRhcnknOmZhbHNlfSwncm91dGVzL25vdGVzLyRub3RlSWQnOnsnaWQnOidyb3V0ZXMvbm90ZXMvJG5vdGVJZCcsJ3BhcmVudElkJzoncm91dGVzL25vdGVzJywncGF0aCc6Jzpub3RlSWQnLCdpbmRleCc6dW5kZWZpbmVkLCdjYXNlU2Vuc2l0aXZlJzp1bmRlZmluZWQsJ21vZHVsZSc6Jy9idWlsZC9yb3V0ZXMvbm90ZXMvJG5vdGVJZC1YVEw3NUs3Qi5qcycsJ2ltcG9ydHMnOlsnL2J1aWxkL19zaGFyZWQvY2h1bmstTlRERUhLRlcuanMnXSwnaGFzQWN0aW9uJzp0cnVlLCdoYXNMb2FkZXInOnRydWUsJ2hhc0NhdGNoQm91bmRhcnknOnRydWUsJ2hhc0Vycm9yQm91bmRhcnknOnRydWV9LCdyb3V0ZXMvbm90ZXMvaW5kZXgnOnsnaWQnOidyb3V0ZXMvbm90ZXMvaW5kZXgnLCdwYXJlbnRJZCc6J3JvdXRlcy9ub3RlcycsJ3BhdGgnOnVuZGVmaW5lZCwnaW5kZXgnOnRydWUsJ2Nhc2VTZW5zaXRpdmUnOnVuZGVmaW5lZCwnbW9kdWxlJzonL2J1aWxkL3JvdXRlcy9ub3Rlcy9pbmRleC1SWURHRlNFVy5qcycsJ2ltcG9ydHMnOnVuZGVmaW5lZCwnaGFzQWN0aW9uJzpmYWxzZSwnaGFzTG9hZGVyJzpmYWxzZSwnaGFzQ2F0Y2hCb3VuZGFyeSc6ZmFsc2UsJ2hhc0Vycm9yQm91bmRhcnknOmZhbHNlfSwncm91dGVzL25vdGVzL25ldyc6eydpZCc6J3JvdXRlcy9ub3Rlcy9uZXcnLCdwYXJlbnRJZCc6J3JvdXRlcy9ub3RlcycsJ3BhdGgnOiduZXcnLCdpbmRleCc6dW5kZWZpbmVkLCdjYXNlU2Vuc2l0aXZlJzp1bmRlZmluZWQsJ21vZHVsZSc6Jy9idWlsZC9yb3V0ZXMvbm90ZXMvbmV3LVBQNkE2UkxYLmpzJywnaW1wb3J0cyc6WycvYnVpbGQvX3NoYXJlZC9jaHVuay1OVERFSEtGVy5qcyddLCdoYXNBY3Rpb24nOnRydWUsJ2hhc0xvYWRlcic6ZmFsc2UsJ2hhc0NhdGNoQm91bmRhcnknOmZhbHNlLCdoYXNFcnJvckJvdW5kYXJ5JzpmYWxzZX19LCd1cmwnOicvYnVpbGQvbWFuaWZlc3QtN0UzM0YzRjQuanMnfTsiLCAiXG5pbXBvcnQgKiBhcyBlbnRyeVNlcnZlciBmcm9tIFwiL1VzZXJzL2tlbnRjZG9kZHMvY29kZS9yZW1peC9zY3JpcHRzL3BsYXlncm91bmQvdGVtcGxhdGUvYXBwL2VudHJ5LnNlcnZlci50c3hcIjtcbmltcG9ydCAqIGFzIHJvdXRlMCBmcm9tIFwiL1VzZXJzL2tlbnRjZG9kZHMvY29kZS9yZW1peC9zY3JpcHRzL3BsYXlncm91bmQvdGVtcGxhdGUvYXBwL3Jvb3QudHN4XCI7XG5pbXBvcnQgKiBhcyByb3V0ZTEgZnJvbSBcIi9Vc2Vycy9rZW50Y2RvZGRzL2NvZGUvcmVtaXgvc2NyaXB0cy9wbGF5Z3JvdW5kL3RlbXBsYXRlL2FwcC9yb3V0ZXMvbG9nb3V0LnRzeFwiO1xuaW1wb3J0ICogYXMgcm91dGUyIGZyb20gXCIvVXNlcnMva2VudGNkb2Rkcy9jb2RlL3JlbWl4L3NjcmlwdHMvcGxheWdyb3VuZC90ZW1wbGF0ZS9hcHAvcm91dGVzL2luZGV4LnRzeFwiO1xuaW1wb3J0ICogYXMgcm91dGUzIGZyb20gXCIvVXNlcnMva2VudGNkb2Rkcy9jb2RlL3JlbWl4L3NjcmlwdHMvcGxheWdyb3VuZC90ZW1wbGF0ZS9hcHAvcm91dGVzL2xvZ2luLnRzeFwiO1xuaW1wb3J0ICogYXMgcm91dGU0IGZyb20gXCIvVXNlcnMva2VudGNkb2Rkcy9jb2RlL3JlbWl4L3NjcmlwdHMvcGxheWdyb3VuZC90ZW1wbGF0ZS9hcHAvcm91dGVzL25vdGVzLnRzeFwiO1xuaW1wb3J0ICogYXMgcm91dGU1IGZyb20gXCIvVXNlcnMva2VudGNkb2Rkcy9jb2RlL3JlbWl4L3NjcmlwdHMvcGxheWdyb3VuZC90ZW1wbGF0ZS9hcHAvcm91dGVzL25vdGVzLyRub3RlSWQudHN4XCI7XG5pbXBvcnQgKiBhcyByb3V0ZTYgZnJvbSBcIi9Vc2Vycy9rZW50Y2RvZGRzL2NvZGUvcmVtaXgvc2NyaXB0cy9wbGF5Z3JvdW5kL3RlbXBsYXRlL2FwcC9yb3V0ZXMvbm90ZXMvaW5kZXgudHN4XCI7XG5pbXBvcnQgKiBhcyByb3V0ZTcgZnJvbSBcIi9Vc2Vycy9rZW50Y2RvZGRzL2NvZGUvcmVtaXgvc2NyaXB0cy9wbGF5Z3JvdW5kL3RlbXBsYXRlL2FwcC9yb3V0ZXMvbm90ZXMvbmV3LnRzeFwiO1xuaW1wb3J0ICogYXMgcm91dGU4IGZyb20gXCIvVXNlcnMva2VudGNkb2Rkcy9jb2RlL3JlbWl4L3NjcmlwdHMvcGxheWdyb3VuZC90ZW1wbGF0ZS9hcHAvcm91dGVzL2pvaW4udHN4XCI7XG4gIGV4cG9ydCB7IGRlZmF1bHQgYXMgYXNzZXRzIH0gZnJvbSBcIkByZW1peC1ydW4vZGV2L2Fzc2V0cy1tYW5pZmVzdFwiO1xuICBleHBvcnQgY29uc3QgZW50cnkgPSB7IG1vZHVsZTogZW50cnlTZXJ2ZXIgfTtcbiAgZXhwb3J0IGNvbnN0IHJvdXRlcyA9IHtcbiAgICBcInJvb3RcIjoge1xuICAgICAgaWQ6IFwicm9vdFwiLFxuICAgICAgcGFyZW50SWQ6IHVuZGVmaW5lZCxcbiAgICAgIHBhdGg6IFwiXCIsXG4gICAgICBpbmRleDogdW5kZWZpbmVkLFxuICAgICAgY2FzZVNlbnNpdGl2ZTogdW5kZWZpbmVkLFxuICAgICAgbW9kdWxlOiByb3V0ZTBcbiAgICB9LFxuICBcInJvdXRlcy9sb2dvdXRcIjoge1xuICAgICAgaWQ6IFwicm91dGVzL2xvZ291dFwiLFxuICAgICAgcGFyZW50SWQ6IFwicm9vdFwiLFxuICAgICAgcGF0aDogXCJsb2dvdXRcIixcbiAgICAgIGluZGV4OiB1bmRlZmluZWQsXG4gICAgICBjYXNlU2Vuc2l0aXZlOiB1bmRlZmluZWQsXG4gICAgICBtb2R1bGU6IHJvdXRlMVxuICAgIH0sXG4gIFwicm91dGVzL2luZGV4XCI6IHtcbiAgICAgIGlkOiBcInJvdXRlcy9pbmRleFwiLFxuICAgICAgcGFyZW50SWQ6IFwicm9vdFwiLFxuICAgICAgcGF0aDogdW5kZWZpbmVkLFxuICAgICAgaW5kZXg6IHRydWUsXG4gICAgICBjYXNlU2Vuc2l0aXZlOiB1bmRlZmluZWQsXG4gICAgICBtb2R1bGU6IHJvdXRlMlxuICAgIH0sXG4gIFwicm91dGVzL2xvZ2luXCI6IHtcbiAgICAgIGlkOiBcInJvdXRlcy9sb2dpblwiLFxuICAgICAgcGFyZW50SWQ6IFwicm9vdFwiLFxuICAgICAgcGF0aDogXCJsb2dpblwiLFxuICAgICAgaW5kZXg6IHVuZGVmaW5lZCxcbiAgICAgIGNhc2VTZW5zaXRpdmU6IHVuZGVmaW5lZCxcbiAgICAgIG1vZHVsZTogcm91dGUzXG4gICAgfSxcbiAgXCJyb3V0ZXMvbm90ZXNcIjoge1xuICAgICAgaWQ6IFwicm91dGVzL25vdGVzXCIsXG4gICAgICBwYXJlbnRJZDogXCJyb290XCIsXG4gICAgICBwYXRoOiBcIm5vdGVzXCIsXG4gICAgICBpbmRleDogdW5kZWZpbmVkLFxuICAgICAgY2FzZVNlbnNpdGl2ZTogdW5kZWZpbmVkLFxuICAgICAgbW9kdWxlOiByb3V0ZTRcbiAgICB9LFxuICBcInJvdXRlcy9ub3Rlcy8kbm90ZUlkXCI6IHtcbiAgICAgIGlkOiBcInJvdXRlcy9ub3Rlcy8kbm90ZUlkXCIsXG4gICAgICBwYXJlbnRJZDogXCJyb3V0ZXMvbm90ZXNcIixcbiAgICAgIHBhdGg6IFwiOm5vdGVJZFwiLFxuICAgICAgaW5kZXg6IHVuZGVmaW5lZCxcbiAgICAgIGNhc2VTZW5zaXRpdmU6IHVuZGVmaW5lZCxcbiAgICAgIG1vZHVsZTogcm91dGU1XG4gICAgfSxcbiAgXCJyb3V0ZXMvbm90ZXMvaW5kZXhcIjoge1xuICAgICAgaWQ6IFwicm91dGVzL25vdGVzL2luZGV4XCIsXG4gICAgICBwYXJlbnRJZDogXCJyb3V0ZXMvbm90ZXNcIixcbiAgICAgIHBhdGg6IHVuZGVmaW5lZCxcbiAgICAgIGluZGV4OiB0cnVlLFxuICAgICAgY2FzZVNlbnNpdGl2ZTogdW5kZWZpbmVkLFxuICAgICAgbW9kdWxlOiByb3V0ZTZcbiAgICB9LFxuICBcInJvdXRlcy9ub3Rlcy9uZXdcIjoge1xuICAgICAgaWQ6IFwicm91dGVzL25vdGVzL25ld1wiLFxuICAgICAgcGFyZW50SWQ6IFwicm91dGVzL25vdGVzXCIsXG4gICAgICBwYXRoOiBcIm5ld1wiLFxuICAgICAgaW5kZXg6IHVuZGVmaW5lZCxcbiAgICAgIGNhc2VTZW5zaXRpdmU6IHVuZGVmaW5lZCxcbiAgICAgIG1vZHVsZTogcm91dGU3XG4gICAgfSxcbiAgXCJyb3V0ZXMvam9pblwiOiB7XG4gICAgICBpZDogXCJyb3V0ZXMvam9pblwiLFxuICAgICAgcGFyZW50SWQ6IFwicm9vdFwiLFxuICAgICAgcGF0aDogXCJqb2luXCIsXG4gICAgICBpbmRleDogdW5kZWZpbmVkLFxuICAgICAgY2FzZVNlbnNpdGl2ZTogdW5kZWZpbmVkLFxuICAgICAgbW9kdWxlOiByb3V0ZThcbiAgICB9XG4gIH07Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7O0FDQ0EsWUFBdUI7OztBQ0R2QjtBQUFBO0FBQUE7QUFBQTtBQUNBLG1CQUE0QjtBQUM1QixvQkFBK0I7QUFFaEIsdUJBQ2IsU0FDQSxvQkFDQSxpQkFDQSxjQUNBO0FBQ0EsUUFBTSxTQUFTLGtDQUNiLG9DQUFDLDBCQUFEO0FBQUEsSUFBYSxTQUFTO0FBQUEsSUFBYyxLQUFLLFFBQVE7QUFBQTtBQUduRCxrQkFBZ0IsSUFBSSxnQkFBZ0I7QUFFcEMsU0FBTyxJQUFJ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
