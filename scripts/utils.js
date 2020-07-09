import childProcess from "child_process";
import util from "util";

export const exec = util.promisify(childProcess.exec);
