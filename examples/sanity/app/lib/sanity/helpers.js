import imageUrlBuilder from "@sanity/image-url";
import SanityPortableText from "@sanity/block-content-to-react";

import { config } from "./config";

export const urlFor = source => imageUrlBuilder(config).image(source);

export function PortableText({ blocks = [] }) {
  return <SanityPortableText serializers={{}} {...config} blocks={blocks} />;
}
