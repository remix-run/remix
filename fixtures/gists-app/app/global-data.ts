export function loader({ request }) {
  return {
    enableScripts: new URL(request.url).searchParams.get("disableJs") == null
  };
}
