rm -rf build/
yarn install
yarn build
cp packages/remix-gcloud-functions-gen2/package.json build/node_modules/@remix-run/gcloud-functions-gen2
echo "$(pwd)/build/node_modules/@remix-run/gcloud-functions-gen2"