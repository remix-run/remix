/*
 * react-remark does not support cjs anymore but Remix.run will not work with esm just yet (without async imports)
 * Unfortunately, the older versions of react-remark do not implement useRemarkSync
 * Thus, right now there is no way to use react-remark in remix to render markdown server-side
 * since it will always require async code (and require a useEffect)
 *
 * Solution: Use old versions of remark, unified, and rehype directly to basically re-implement react-remark
 */
import { Fragment, createElement, useMemo } from "react";
import unified from "unified";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import type { Options as RehypeReactOptions } from "rehype-react";
import rehypeReact from "rehype-react";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type ReactOptions = PartialBy<
  RehypeReactOptions<typeof createElement>,
  "createElement"
>;

export const useRemarkSync = (
  source: string,
  rehypeReactOptions: ReactOptions
): React.ReactElement =>
  useMemo(
    () =>
      unified()
        .use(remarkParse)
        .use(remarkToRehype)
        .use(rehypeReact, {
          createElement,
          Fragment,
          ...rehypeReactOptions
        } as RehypeReactOptions<typeof createElement>)
        .processSync(source).result as React.ReactElement,
    [source, rehypeReactOptions]
  );

/**
 * Example of a custom React component for your markdown content
 */
const H1: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  ...props
}) => {
  return (
    <h1 {...props} style={{ color: "blue", fontSize: "50px" }}>
      {children}
    </h1>
  );
};

interface MarkdownContainerProps {
  source: string; // The markdown string
}

/**
 * Sync render of markdown content
 */
const MarkdownContainer: React.FC<MarkdownContainerProps> = ({ source }) => {
  const html = useRemarkSync(source, {
    // Optional: a mapping of html tags to custom React components
    components: { h1: H1 } // supports all html tags (h1, ..., p, ol, ul, li, pre, code, a, img, hr, blockquote, ...)
  });

  return html;
};

export default MarkdownContainer;
