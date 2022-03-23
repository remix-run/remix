const tar = require("tar-fs");
const fs = require("fs");
const path = require("path");

let files = fs.readdirSync(__dirname);
let dirs = files.filter((file) =>
  fs.statSync(path.join(__dirname, file)).isDirectory()
);

let root = path.join(__dirname, "../../../../");
let date = new Date().toISOString().slice(0, 10);
let name = `remix-${date}`;
let remixTar = `${name}.tar.gz`;
tar
  .pack(root, {
    entries: ["examples/basic", "templates/arc"],
    map(header) {
      header.name = path.join(name, header.name);
      return header;
    },
  })
  .pipe(fs.createWriteStream(path.join(__dirname, remixTar)));

for (let dir of dirs) {
  let fullPath = path.join(__dirname, dir);
  console.log(`Creating archive for ${fullPath}`);
  tar
    .pack(fullPath, {
      map(header) {
        header.name = dir + "/" + header.name;
        return header;
      },
    })
    .pipe(fs.createWriteStream(path.join(__dirname, `${dir}.tar.gz`)));
}
