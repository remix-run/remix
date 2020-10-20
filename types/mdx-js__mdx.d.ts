declare module "@mdx-js/mdx" {
  import type { Compiler, Plugin } from "unified";

  export interface MdxOptions {
    /**
     * List of compilers to customize output.
     */
    compilers?: Compiler[];

    /**
     * Support footnotes.
     */
    footnotes?: boolean;

    /**
     * List of rehype plugins to use.
     *
     * @see https://github.com/rehypejs/rehype/blob/main/doc/plugins.md#list-of-plugins
     */
    rehypePlugins?: Plugin[];

    /**
     * List of remark plugins to use.
     *
     * @see https://github.com/remarkjs/remark/blob/main/doc/plugins.md#list-of-plugins
     */
    remarkPlugins?: Plugin[];
  }

  export interface MdxFunction {
    (body: string, options?: MdxOptions): Promise<string>;
  }

  const mdx: MdxFunction;

  export default mdx;
}
