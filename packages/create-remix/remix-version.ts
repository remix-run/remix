import https from "node:https";

let _versionCache: string | null = null;
export async function getLatestRemixVersion() {
  return new Promise<string>((resolve, reject) => {
    if (_versionCache) {
      return resolve(_versionCache);
    }
    let request = https.get(
      "https://registry.npmjs.org/remix/latest",
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let { version } = JSON.parse(body);
          _versionCache = version;
          resolve(version);
        });
      }
    );

    // set a short timeout to avoid super slow initiation
    request.setTimeout(5000);

    request.on("error", (err) => reject(err));
  });
}
