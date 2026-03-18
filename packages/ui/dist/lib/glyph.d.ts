import type { Props, RemixElement, RemixNode } from '@remix-run/component';
export declare let glyphNames: readonly ["add", "alert", "check", "chevronDown", "chevronRight", "close", "expand", "info", "menu", "search", "spinner"];
export type GlyphName = (typeof glyphNames)[number];
export type GlyphDefinition = {
    content: RemixNode;
    viewBox: string;
};
export type GlyphValues = {
    readonly [key in GlyphName]: GlyphDefinition;
};
export type GlyphSheetProps = Omit<Props<'svg'>, 'children'>;
type GlyphSheetRenderer = () => (props?: GlyphSheetProps) => RemixElement;
export type GlyphSheetComponent = GlyphSheetRenderer & {
    ids: Readonly<Record<GlyphName, string>>;
    values: GlyphValues;
};
export type GlyphProps = Omit<Props<'svg'>, 'children'> & {
    name: GlyphName;
};
export declare let glyphContract: Readonly<Readonly<Record<"search" | "menu" | "close" | "add" | "alert" | "check" | "chevronDown" | "chevronRight" | "expand" | "info" | "spinner", {
    id: string;
    viewBox: string;
}>>>;
export declare let RMX_01_GLYPHS: GlyphValues;
export declare function createGlyphSheet(values: GlyphValues): GlyphSheetComponent;
export declare function Glyph(): (props: GlyphProps) => RemixElement;
export {};
