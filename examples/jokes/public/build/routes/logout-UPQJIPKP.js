import {
  require_session
} from "/build/_shared/chunk-JHG2B4Q5.js";
import {
  __toModule,
  init_react
} from "/build/_shared/chunk-E7VMOUYL.js";

// browser-route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/logout.tsx?browser
init_react();

// app/routes/logout.tsx
init_react();
var import_session = __toModule(require_session());
var action = async ({ request }) => {
  return (0, import_session.logout)(request);
};
export {
  action
};
//# sourceMappingURL=/build/routes/logout-UPQJIPKP.js.map
