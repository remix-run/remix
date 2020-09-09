import fs from "fs";
import path from "path";

export function readVendorFile(filename: string): string {
  let file = path.resolve(__dirname, "./vendor", filename);
  return fs.readFileSync(file, "utf-8");
}
