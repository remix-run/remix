import {
  useOptionalUser
} from "/build/_shared/chunk-L7NQLBEK.js";
import {
  Link
} from "/build/_shared/chunk-DOPJ42JF.js";
import {
  React,
  init_react
} from "/build/_shared/chunk-O6YYFGCX.js";

// browser-route-module:/Users/johnhooks/Projects/remix/examples/blog-tutorial/app/routes/index.tsx?browser
init_react();

// app/routes/index.tsx
init_react();
function Index() {
  const user = useOptionalUser();
  return /* @__PURE__ */ React.createElement("main", {
    className: "relative min-h-screen bg-white sm:flex sm:items-center sm:justify-center"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "relative sm:pb-16 sm:pt-8"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "mx-auto max-w-7xl sm:px-6 lg:px-8"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "relative shadow-xl sm:overflow-hidden sm:rounded-2xl"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "absolute inset-0"
  }, /* @__PURE__ */ React.createElement("img", {
    className: "h-full w-full object-cover",
    src: "https://user-images.githubusercontent.com/1500684/157774694-99820c51-8165-4908-a031-34fc371ac0d6.jpg",
    alt: "Sonic Youth On Stage"
  }), /* @__PURE__ */ React.createElement("div", {
    className: "absolute inset-0 bg-[color:rgba(254,204,27,0.5)] mix-blend-multiply"
  })), /* @__PURE__ */ React.createElement("div", {
    className: "lg:pb-18 relative px-4 pt-16 pb-8 sm:px-6 sm:pt-24 sm:pb-14 lg:px-8 lg:pt-32"
  }, /* @__PURE__ */ React.createElement("h1", {
    className: "text-center text-6xl font-extrabold tracking-tight sm:text-8xl lg:text-9xl"
  }, /* @__PURE__ */ React.createElement("span", {
    className: "block uppercase text-yellow-500 drop-shadow-md"
  }, "Indie Stack")), /* @__PURE__ */ React.createElement("p", {
    className: "mx-auto mt-6 max-w-lg text-center text-xl text-white sm:max-w-3xl"
  }, "Check the README.md file for instructions on how to get this project deployed."), /* @__PURE__ */ React.createElement("div", {
    className: "mx-auto mt-10 max-w-sm sm:flex sm:max-w-none sm:justify-center"
  }, user ? /* @__PURE__ */ React.createElement(Link, {
    to: "/notes",
    className: "flex items-center justify-center rounded-md border border-transparent bg-white px-4 py-3 text-base font-medium text-yellow-700 shadow-sm hover:bg-yellow-50 sm:px-8"
  }, "View Notes for ", user.email) : /* @__PURE__ */ React.createElement("div", {
    className: "space-y-4 sm:mx-auto sm:inline-grid sm:grid-cols-2 sm:gap-5 sm:space-y-0"
  }, /* @__PURE__ */ React.createElement(Link, {
    to: "/join",
    className: "flex items-center justify-center rounded-md border border-transparent bg-white px-4 py-3 text-base font-medium text-yellow-700 shadow-sm hover:bg-yellow-50 sm:px-8"
  }, "Sign up"), /* @__PURE__ */ React.createElement(Link, {
    to: "/login",
    className: "flex items-center justify-center rounded-md bg-yellow-500 px-4 py-3 font-medium text-white hover:bg-yellow-600  "
  }, "Log In"))), /* @__PURE__ */ React.createElement("a", {
    href: "https://remix.run"
  }, /* @__PURE__ */ React.createElement("img", {
    src: "https://user-images.githubusercontent.com/1500684/158298926-e45dafff-3544-4b69-96d6-d3bcc33fc76a.svg",
    alt: "Remix",
    className: "mx-auto mt-16 w-full max-w-[12rem] md:max-w-[16rem]"
  }))))), /* @__PURE__ */ React.createElement("div", {
    className: "mx-auto mt-16 max-w-7xl text-center"
  }, /* @__PURE__ */ React.createElement(Link, {
    to: "/posts",
    className: "text-xl text-blue-600 underline"
  }, "Blog Posts")), /* @__PURE__ */ React.createElement("div", {
    className: "mx-auto max-w-7xl py-2 px-4 sm:px-6 lg:px-8"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "mt-6 flex flex-wrap justify-center gap-8"
  }, [
    {
      src: "https://user-images.githubusercontent.com/1500684/157764397-ccd8ea10-b8aa-4772-a99b-35de937319e1.svg",
      alt: "Fly.io",
      href: "https://fly.io"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157764395-137ec949-382c-43bd-a3c0-0cb8cb22e22d.svg",
      alt: "SQLite",
      href: "https://sqlite.org"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157764484-ad64a21a-d7fb-47e3-8669-ec046da20c1f.svg",
      alt: "Prisma",
      href: "https://prisma.io"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157764276-a516a239-e377-4a20-b44a-0ac7b65c8c14.svg",
      alt: "Tailwind",
      href: "https://tailwindcss.com"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157764454-48ac8c71-a2a9-4b5e-b19c-edef8b8953d6.svg",
      alt: "Cypress",
      href: "https://www.cypress.io"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157772386-75444196-0604-4340-af28-53b236faa182.svg",
      alt: "MSW",
      href: "https://mswjs.io"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157772447-00fccdce-9d12-46a3-8bb4-fac612cdc949.svg",
      alt: "Vitest",
      href: "https://vitest.dev"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157772662-92b0dd3a-453f-4d18-b8be-9fa6efde52cf.png",
      alt: "Testing Library",
      href: "https://testing-library.com"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157772934-ce0a943d-e9d0-40f8-97f3-f464c0811643.svg",
      alt: "Prettier",
      href: "https://prettier.io"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157772990-3968ff7c-b551-4c55-a25c-046a32709a8e.svg",
      alt: "ESLint",
      href: "https://eslint.org"
    },
    {
      src: "https://user-images.githubusercontent.com/1500684/157773063-20a0ed64-b9f8-4e0b-9d1e-0b65a3d4a6db.svg",
      alt: "TypeScript",
      href: "https://typescriptlang.org"
    }
  ].map((img) => /* @__PURE__ */ React.createElement("a", {
    key: img.href,
    href: img.href,
    className: "flex h-16 w-32 justify-center p-1 grayscale transition hover:grayscale-0 focus:grayscale-0"
  }, /* @__PURE__ */ React.createElement("img", {
    alt: img.alt,
    src: img.src
  })))))));
}
export {
  Index as default
};
//# sourceMappingURL=/build/routes/index-Y6CHNV3B.js.map
