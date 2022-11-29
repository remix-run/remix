import { installGlobals as installNodeGlobals } from "@remix-run/node";

async function loadModule(modulePath: string) {
  try {
    return await import(modulePath)
  } catch {
    throw new Error(`Unable to import module ${modulePath}`)
  }
}

export async function installGlobals() {
  installNodeGlobals()
  let JSDOM = await loadModule('jsdom');
  let jsdom = new JSDOM.JSDOM(`<!doctype html>`);
  globalThis.FormData = jsdom.window.FormData;
}