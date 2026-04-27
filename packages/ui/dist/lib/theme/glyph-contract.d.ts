import type { RemixElement } from '@remix-run/component';
export declare const glyphNames: readonly ["add", "alert", "check", "chevronDown", "chevronVertical", "chevronUp", "chevronRight", "close", "copy", "edit", "expand", "info", "menu", "open", "search", "spinner", "trash"];
export type GlyphName = (typeof glyphNames)[number];
export type GlyphSymbol = RemixElement;
export type GlyphValues = {
    readonly [key in GlyphName]: GlyphSymbol;
};
export type GlyphContract = Readonly<Record<GlyphName, {
    id: string;
}>>;
export declare const glyphContract: Readonly<Readonly<Record<"search" | "menu" | "close" | "copy" | "open" | "add" | "alert" | "check" | "chevronDown" | "chevronVertical" | "chevronUp" | "chevronRight" | "edit" | "expand" | "info" | "spinner" | "trash", {
    id: string;
}>>>;
