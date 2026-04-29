#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd "$SCRIPT_DIR" > /dev/null

run_benchmark() {
    local server_name=$1
    local start_command=$2
    local wrk_options=("${@:3}")

    export PORT=3000

    echo -e "\nRunning benchmark for $server_name ...\n"

    # Start the server in the background
    $start_command > /dev/null &
    local server_pid=$!

    # Wait for the server to start
    sleep 2

    wrk -t12 -c400 -d30s "${wrk_options[@]}" http://127.0.0.1:3000/

    kill -SIGINT $server_pid

    wait $server_pid
}

echo $(node -e 'console.log(`Platform: ${os.type()} (${os.release()})`)')
echo $(node -e 'console.log(`CPU: ${os.cpus()[0].model}`)')
echo $(node -e 'console.log(`Date: ${new Date().toLocaleString()}`)')

NODE_VERSION=$(node -e 'console.log(process.version.slice(1))')
run_benchmark "node:http@$NODE_VERSION" \
  "node ./servers/node-http.ts"
run_benchmark "node:http-request-inspection@$NODE_VERSION" \
  "node ./servers/node-http-request-inspection.ts" \
  -s ./request-inspection.lua

NODE_FETCH_SERVER_VERSION=$(node -e 'console.log(require("../package.json").version)')
run_benchmark "node-fetch-server@$NODE_FETCH_SERVER_VERSION" \
  "node ./servers/node-fetch-server.ts"
run_benchmark "node-fetch-server-uws@$NODE_FETCH_SERVER_VERSION" \
  "node ./servers/node-fetch-server-uws.ts"
run_benchmark "node-fetch-server-request-inspection@$NODE_FETCH_SERVER_VERSION" \
  "node ./servers/node-fetch-server-request-inspection.ts" \
  -s ./request-inspection.lua
run_benchmark "node-fetch-server-uws-request-inspection@$NODE_FETCH_SERVER_VERSION" \
  "node ./servers/node-fetch-server-uws-request-inspection.ts" \
  -s ./request-inspection.lua

EXPRESS_VERSION=$(node -e 'console.log(require("express/package.json").version)')
run_benchmark "express@$EXPRESS_VERSION" \
  "node ./servers/express.ts"
run_benchmark "express-request-inspection@$EXPRESS_VERSION" \
  "node ./servers/express-request-inspection.ts" \
  -s ./request-inspection.lua

popd > /dev/null
