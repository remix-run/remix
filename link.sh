
rm -rf "$1/node_modules/remix-adapter-gcf-gen2"
ln -s "$(pwd)/build/node_modules/@remix-run/gcloud-functions-gen2" "$1/node_modules/remix-adapter-gcf-gen2" 