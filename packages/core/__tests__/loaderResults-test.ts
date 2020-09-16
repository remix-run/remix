import {
  LoaderResultChangeStatusCode,
  LoaderResultCopy,
  LoaderResultError,
  LoaderResultRedirect,
  LoaderResultSuccess,
  stringifyLoaderResults,
  parseLoaderResults
} from "../loaderResults";

describe("stringifying and parsing loader results", () => {
  it("works", () => {
    let results = [
      new LoaderResultChangeStatusCode("changeStatusCode", 403),
      new LoaderResultCopy("copy"),
      new LoaderResultError("error", "message", "stack"),
      new LoaderResultRedirect("redirect", "location", 301),
      new LoaderResultSuccess("success", "data")
    ];

    let string = stringifyLoaderResults(results, 2);

    expect(string).toMatchInlineSnapshot(`
      "[
        {
          \\"type\\": \\"LoaderResultChangeStatusCode\\",
          \\"routeId\\": \\"changeStatusCode\\",
          \\"httpStatus\\": 403
        },
        {
          \\"type\\": \\"LoaderResultCopy\\",
          \\"routeId\\": \\"copy\\"
        },
        {
          \\"type\\": \\"LoaderResultError\\",
          \\"routeId\\": \\"error\\",
          \\"message\\": \\"message\\",
          \\"stack\\": \\"stack\\"
        },
        {
          \\"type\\": \\"LoaderResultRedirect\\",
          \\"routeId\\": \\"redirect\\",
          \\"httpStatus\\": 301,
          \\"location\\": \\"location\\"
        },
        {
          \\"type\\": \\"LoaderResultSuccess\\",
          \\"routeId\\": \\"success\\",
          \\"data\\": \\"data\\"
        }
      ]"
    `);

    let parsedResults = parseLoaderResults(string);

    expect(parsedResults).toMatchInlineSnapshot(`
      Array [
        LoaderResultChangeStatusCode {
          "httpStatus": 403,
          "routeId": "changeStatusCode",
        },
        LoaderResultCopy {
          "httpStatus": 200,
          "routeId": "copy",
        },
        LoaderResultError {
          "httpStatus": 500,
          "message": "message",
          "routeId": "error",
          "stack": "stack",
        },
        LoaderResultRedirect {
          "httpStatus": 301,
          "location": "location",
          "routeId": "redirect",
        },
        LoaderResultSuccess {
          "data": "data",
          "httpStatus": 200,
          "routeId": "success",
        },
      ]
    `);
  });
});
