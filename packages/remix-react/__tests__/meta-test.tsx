import "@testing-library/jest-dom/extend-expect";
import { processMeta } from "../components";
import { HtmlMetaDescriptor, MetaFunction } from "../routeModules";

describe("meta", () => {
  it(`renders proper <meta> tags`, () => {
    function meta({ data }): HtmlMetaDescriptor {
      return {
        charset: "utf-8",
        description: data.description,
        "og:image": "https://picsum.photos/200/200",
        "og:type": data.contentType, // undefined
        refresh: {
          httpEquiv: "refresh",
          content: "3;url=https://www.mozilla.org",
        },
        title: data.title,
      };
    }
    function meta2({ data }): HtmlMetaDescriptor[] {
      return [
        { name: "description", content: "override description" },
        { property: "og:image", content: "https://remix.run/logo.png" },
        { property: "og:type", content: "image/png" },
        {
          httpEquiv: "refresh",
          content: "5;url=https://google.com",
        },
        { title: "Updated title" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ];
    }

    const result = getMeta(
      {
        title: "test title",
        description: "test description",
      },
      [meta, meta2]
    );

    // title should override the title from the first meta function
    let titleMeta = result.find((meta) => meta.hasOwnProperty("title"));
    expect(titleMeta["title"]).toBe("Updated title");
    // viewport should be added
    let viewportMeta = result.find((meta) => meta["name"] === "viewport");
    expect(viewportMeta["content"]).toBe("width=device-width, initial-scale=1");
  });
});

function getMeta(data: any, metaFunctions: MetaFunction[]) {
  let meta: HtmlMetaDescriptor[] = [];
  metaFunctions.forEach((metaFunction) => {
    let routeMeta = metaFunction({
      data,
      parentsData: {},
      params: {},
      location: null,
    });
    if (routeMeta) {
      meta = processMeta(meta, routeMeta);
    }
  });

  return meta;
}

function renderMeta(meta: HtmlMetaDescriptor[]) {
  return meta.map((metaDescriptor) => {
    return `<meta ${Object.keys(metaDescriptor)
      .map((key) => `${key}="${metaDescriptor[key]}"`)
      .join(" ")} />`;
  });
}
