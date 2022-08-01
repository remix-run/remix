import { PortableText as PortableTextBase } from "@portabletext/react";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";
import type { ComponentProps, FunctionComponent } from "react";

import { config } from "./config";

export const urlFor = (source: SanityImageSource) =>
  imageUrlBuilder(config).image(source);

type PortableTextBaseProps = ComponentProps<typeof PortableTextBase>;
type PortableTextProps = Pick<PortableTextBaseProps, "value">;
export const PortableText: FunctionComponent<PortableTextProps> = ({
  value = [],
}) => <PortableTextBase {...config} value={value} />;
