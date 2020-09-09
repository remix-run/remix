import * as babel from "@babel/core";

export default function babelTransform(
  code: string,
  options: babel.TransformOptions
): Promise<babel.BabelFileResult> {
  return new Promise((accept, reject) => {
    babel.transform(code, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        accept(result!);
      }
    });
  });
}
