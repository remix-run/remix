// in @remix-run/express
// function createExpressRequestHandler({ getLoadContext }) {
//   let runRemix = createRemix({ getLoadContext })

//   return (req, res) => {
//     runRemix({
//       getLoadContextArgs() {
//         return [req, res];
//       },
//       getUrl() {
//         return req.url
//       },
//       sendJson(json) {
//         res.json(json);
//       }
//     })
//   }
// }

// end user api
// import remix from "@remix-run/express"
// app.use(remix({
//   getLoadContext(req, res) {
//     return { userId: 4 }
//   }
// }))

import { matchAndLoadData } from "./match";
import readRemixConfig from "./readRemixConfig";

export interface CreateRemixOptions {
  getLoadContext?: (...args: any[]) => any;
  root?: string;
}

export interface RunRemix {
  (platformDelegate: PlatformDelegate): Promise<void>;
}

// export interface ExpressRemixOptions extends RemixOptions {
//   getLoadContext: (req: express.Request, res: express.Response) => any;
// }

export interface PlatformDelegate {
  getLoadContextArgs: () => any[];
  getUrl: () => string;
  sendJson: (json: any) => void;
}

export default function createPlatform({
  getLoadContext,
  root
}: CreateRemixOptions): RunRemix {
  let remixConfigPromise = readRemixConfig(root);

  return async platformDelegate => {
    let remixConfig = await remixConfigPromise;

    let url = platformDelegate.getUrl();
    let loadContextArgs = platformDelegate.getLoadContextArgs();
    let loadContext = getLoadContext
      ? getLoadContext(...loadContextArgs)
      : null;

    let result = await matchAndLoadData(remixConfig, url, loadContext);

    platformDelegate.sendJson(result);
  };
}
