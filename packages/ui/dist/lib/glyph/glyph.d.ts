import type { Props, RemixElement } from '@remix-run/component';
import { type GlyphName, type GlyphValues } from '../theme/glyph-contract.ts';
export type { GlyphName, GlyphSymbol, GlyphValues } from '../theme/glyph-contract.ts';
export type GlyphSheetProps = Omit<Props<'svg'>, 'children'>;
type GlyphSheetRenderer = () => (props?: GlyphSheetProps) => RemixElement;
export type GlyphSheetComponent = GlyphSheetRenderer & {
    ids: Readonly<Record<GlyphName, string>>;
    values: GlyphValues;
};
export type GlyphProps = Omit<Props<'svg'>, 'children'> & {
    name: GlyphName;
};
export declare function createGlyphSheet(values: GlyphValues): GlyphSheetComponent;
export declare function Glyph(): (props: GlyphProps) => RemixElement;
