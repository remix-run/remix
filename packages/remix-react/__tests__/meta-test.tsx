import React from "react";
import "@testing-library/jest-dom/extend-expect";
import { processMeta } from "../components";
import type { HtmlMetaDescriptor, MetaFunction } from "../routeModules";
import { renderToString } from "react-dom/server";

describe("meta", () => {
  it(`renders proper <meta> tags`, () => {
    function meta({ data }): HtmlMetaDescriptor {
      return {
        charset: "utf-8",
        description: data.description,
        "og:image": "https://picsum.photos/200/200",
        "og:type": data.contentType, // undefined
        title: data.title,
      };
    }
    function meta2({ data }): HtmlMetaDescriptor[] {
      return [
        { name: "description", content: "override description" },
        { property: "og:image", content: "https://remix.run/logo.png" },
        { property: "og:type", content: "image/png" },
        {
          key: "http-equiv:refresh",
          httpEquiv: "refresh",
          content: "5;url=https://google.com",
        },
        { key: "title", content: "Updated title" },
        { key: "charset", content: "utf-16" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ];
    }

    let map = getMeta(
      {
        title: "test title",
        description: "test description",
      },
      [meta, meta2]
    );

    // let rendered = renderMeta(map);
    // let html = renderToString(rendered);
    // console.log(html);

    // title should override the title from the first meta function
    expect(map.get("title").content).toBe("Updated title");
    // viewport should be added
    expect(map.get("viewport").content).toBe(
      "width=device-width, initial-scale=1"
    );
  });
});

type MetaMap = Map<string, HtmlMetaDescriptor>;

function getMeta(data: any, metaFunctions: MetaFunction[]) {
  let meta: MetaMap = new Map();
  metaFunctions.forEach((metaFunction) => {
    let routeMeta = metaFunction({
      data,
      parentsData: {},
      params: {},
      location: null,
    });
    if (routeMeta) {
      processMeta(meta, routeMeta);
      //console.log(meta, routeMeta);
    }
  });

  return meta;
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function renderMeta(meta: MetaMap) {
  return (
    <>
      {[...meta.entries()].map(([key, value]) => {
        if (key === "title" && typeof value.content === "string") {
          return <title key={key}>{value.content}</title>;
        }
        if (key === "charset" && typeof value.content === "string") {
          return <meta key={key} charSet={value.content} />;
        }
        return <meta key={key} {...value} />;
      })}
    </>
  );
}
