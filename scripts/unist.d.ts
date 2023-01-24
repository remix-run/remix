import type { Parent, Literal } from "unist";

export type Node = FlowNode | PhrasingNode | RootNode;

export interface RootNode extends Parent {
  type: "root";
  children: FlowNode[];
}

export type PhrasingNode = TextNode | EmphasisNode;

export type FlowNode =
  | BlockquoteNode
  | HeadingNode
  | ParagraphNode
  | LinkNode
  | PreNode
  | CodeNode;

export interface BlockquoteNode extends Parent {
  type: "blockquote";
  children: FlowNode[];
}

export interface HeadingNode extends Parent {
  type: "heading";
  depth: number;
  children: PhrasingNode[];
}

export interface ParagraphNode extends Parent {
  type: "paragraph";
  children: PhrasingNode[];
}

export interface PreNode extends Parent {
  type: "pre";
  children: PhrasingNode[];
}

export interface CodeNode extends Parent {
  type: "code";
  children: PhrasingNode[];
  value?: string;
  meta?: string | string[];
}

export interface EmphasisNode extends Parent {
  type: "emphasis";
  children: PhrasingNode[];
}

export interface LinkNode extends Parent {
  type: "link";
  children: FlowNode[];
  url?: string;
}

export interface TextNode extends Literal {
  type: "text";
  value: string;
}
