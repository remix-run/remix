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
NODE_FETCH_SERVER_VERSION=$(node -e 'console.log(require("../package.json").version)')
NODE_SERVE_VERSION=$(node -e 'console.log(require("./node_modules/@remix-run/node-serve/package.json").version)')
EXPRESS_VERSION=$(node -e 'console.log(require("express/package.json").version)')

run_benchmark "raw-throughput/node:http@$NODE_VERSION" \
  "node ./raw-throughput/servers/node-http.ts"
run_benchmark "raw-throughput/remix/node-fetch-server@$NODE_FETCH_SERVER_VERSION" \
  "node ./raw-throughput/servers/node-fetch-server.ts"
run_benchmark "raw-throughput/remix/node-serve@$NODE_SERVE_VERSION" \
  "node ./raw-throughput/servers/node-serve.ts"
run_benchmark "raw-throughput/express@$EXPRESS_VERSION" \
  "node ./raw-throughput/servers/express.ts"

run_benchmark "small-body/node:http@$NODE_VERSION" \
  "node ./small-body/servers/node-http.ts" \
  -s ./small-body/request.lua
run_benchmark "small-body/remix/node-fetch-server@$NODE_FETCH_SERVER_VERSION" \
  "node ./small-body/servers/node-fetch-server.ts" \
  -s ./small-body/request.lua
run_benchmark "small-body/remix/node-serve@$NODE_SERVE_VERSION" \
  "node ./small-body/servers/node-serve.ts" \
  -s ./small-body/request.lua
run_benchmark "small-body/express@$EXPRESS_VERSION" \
  "node ./small-body/servers/express.ts" \
  -s ./small-body/request.lua

run_benchmark "large-body/node:http@$NODE_VERSION" \
  "node ./large-body/servers/node-http.ts" \
  -s ./large-body/request.lua
run_benchmark "large-body/remix/node-fetch-server@$NODE_FETCH_SERVER_VERSION" \
  "node ./large-body/servers/node-fetch-server.ts" \
  -s ./large-body/request.lua
run_benchmark "large-body/remix/node-serve@$NODE_SERVE_VERSION" \
  "node ./large-body/servers/node-serve.ts" \
  -s ./large-body/request.lua
run_benchmark "large-body/express@$EXPRESS_VERSION" \
  "node ./large-body/servers/express.ts" \
  -s ./large-body/request.lua

popd > /dev/null
