import { createCompressionFilter } from "../compression";

// it would be better to create an instance of express.request/response,
// but I don't think that's possible, so we're doing ts-expect-error
test("defaults to no compression for content-types which can be streamed", () => {
  let filter = createCompressionFilter();
  expect(
    // @ts-expect-error
    filter({}, { getHeader: () => "text/html" })
  ).toBe(false);

  expect(
    // @ts-expect-error
    filter({}, { getHeader: () => "text/remix-deferred" })
  ).toBe(false);

  expect(
    // @ts-expect-error
    filter({}, { getHeader: () => "text/event-stream" })
  ).toBe(false);

  // not considered streamed by default:
  expect(
    // @ts-expect-error
    filter({}, { getHeader: () => "applicaiton/json" })
  ).toBe(true);
});

test("allows you to define your own content-type regex for compression", () => {
  let filter = createCompressionFilter({
    noCompressContentTypes: [/text\/my-thing/],
  });

  expect(
    // @ts-expect-error
    filter({}, { getHeader: () => "text/html" })
  ).toBe(true);

  expect(
    // @ts-expect-error
    filter({}, { getHeader: () => "text/my-thing" })
  ).toBe(false);
});
