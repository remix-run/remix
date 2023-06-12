import { createServer } from "node:http";
import getPort from "get-port";

createServer(async (req, res) => {
  try {
    res.end(`${await getPort()}`);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end();
  }
}).listen(9000, () => {
  console.log(`GetPort server listening on port 9000`);
});
