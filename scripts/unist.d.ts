import type { Parent, Literal } from "unist";

export type Node = FlowNode | PhrasingNode | RootNode;

export type RootNode = Parent & {
  type: "root";
  children: FlowNode[];
};

export type PhrasingNode = TextNode | EmphasisNode;

export type FlowNode =
  | BlockquoteNode
  | HeadingNode
  | ParagraphNode
  | LinkNode
  | PreNode
  | CodeNode;

export type BlockquoteNode = Parent & {
  type: "blockquote";
  children: FlowNode[];
};

export type HeadingNode = Parent & {
  type: "heading";
  depth: number;
  children: PhrasingNode[];
};

export type ParagraphNode = Parent & {
  type: "paragraph";
  children: PhrasingNode[];
};

export type PreNode = Parent & {
  type: "pre";
  children: PhrasingNode[];
};

export type CodeNode = Parent & {
  type: "code";
  children: PhrasingNode[];
  value?: string;
  meta?: string | string[];
};

export type EmphasisNode = Parent & {
  type: "emphasis";
  children: PhrasingNode[];
};

export type LinkNode = Parent & {
  type: "link";
  children: FlowNode[];
  url?: string;
};

export type TextNode = Literal & {
  type: "text";
  value: string;
};
