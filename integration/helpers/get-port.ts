export async function getPort() {
  let response = await fetch("http://localhost:9000");
  if (response.status !== 200) throw new Error("Failed to get port");
  let port = await response.json();
  return port;
}
