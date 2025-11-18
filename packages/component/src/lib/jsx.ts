import type * as dom from './dom.d.ts'

export function jsx(type: string, props: Remix.ElementProps, key?: string): Remix.Element
export function jsx(type: Function, props: Remix.ComponentProps, key?: string): Remix.Element
export function jsx(type: any, props: any, key?: any): Remix.Element {
  return { type, props, key, $rmx: true }
}

export { jsx as jsxDEV, jsx as jsxs }

declare global {
  namespace JSX {
    export interface IntrinsicAttributes {
      key?: any
    }

    export interface ElementAttributesProperty {
      props: any
    }

    export interface ElementChildrenAttribute {
      children: any
    }

    type Element = Remix.Element | any

    type LibraryManagedAttributes<C, P> = C extends Function ? Remix.ComponentProps<C> : P

    export interface IntrinsicSVGElements {
      svg: dom.SVGProps<SVGSVGElement>
      animate: dom.SVGProps<SVGAnimateElement>
      circle: dom.SVGProps<SVGCircleElement>
      animateMotion: dom.SVGProps<SVGAnimateMotionElement>
      animateTransform: dom.SVGProps<SVGAnimateTransformElement>
      clipPath: dom.SVGProps<SVGClipPathElement>
      defs: dom.SVGProps<SVGDefsElement>
      desc: dom.SVGProps<SVGDescElement>
      ellipse: dom.SVGProps<SVGEllipseElement>
      feBlend: dom.SVGProps<SVGFEBlendElement>
      feColorMatrix: dom.SVGProps<SVGFEColorMatrixElement>
      feComponentTransfer: dom.SVGProps<SVGFEComponentTransferElement>
      feComposite: dom.SVGProps<SVGFECompositeElement>
      feConvolveMatrix: dom.SVGProps<SVGFEConvolveMatrixElement>
      feDiffuseLighting: dom.SVGProps<SVGFEDiffuseLightingElement>
      feDisplacementMap: dom.SVGProps<SVGFEDisplacementMapElement>
      feDistantLight: dom.SVGProps<SVGFEDistantLightElement>
      feDropShadow: dom.SVGProps<SVGFEDropShadowElement>
      feFlood: dom.SVGProps<SVGFEFloodElement>
      feFuncA: dom.SVGProps<SVGFEFuncAElement>
      feFuncB: dom.SVGProps<SVGFEFuncBElement>
      feFuncG: dom.SVGProps<SVGFEFuncGElement>
      feFuncR: dom.SVGProps<SVGFEFuncRElement>
      feGaussianBlur: dom.SVGProps<SVGFEGaussianBlurElement>
      feImage: dom.SVGProps<SVGFEImageElement>
      feMerge: dom.SVGProps<SVGFEMergeElement>
      feMergeNode: dom.SVGProps<SVGFEMergeNodeElement>
      feMorphology: dom.SVGProps<SVGFEMorphologyElement>
      feOffset: dom.SVGProps<SVGFEOffsetElement>
      fePointLight: dom.SVGProps<SVGFEPointLightElement>
      feSpecularLighting: dom.SVGProps<SVGFESpecularLightingElement>
      feSpotLight: dom.SVGProps<SVGFESpotLightElement>
      feTile: dom.SVGProps<SVGFETileElement>
      feTurbulence: dom.SVGProps<SVGFETurbulenceElement>
      filter: dom.SVGProps<SVGFilterElement>
      foreignObject: dom.SVGProps<SVGForeignObjectElement>
      g: dom.SVGProps<SVGGElement>
      image: dom.SVGProps<SVGImageElement>
      line: dom.SVGProps<SVGLineElement>
      linearGradient: dom.SVGProps<SVGLinearGradientElement>
      marker: dom.SVGProps<SVGMarkerElement>
      mask: dom.SVGProps<SVGMaskElement>
      metadata: dom.SVGProps<SVGMetadataElement>
      mpath: dom.SVGProps<SVGMPathElement>
      path: dom.SVGProps<SVGPathElement>
      pattern: dom.SVGProps<SVGPatternElement>
      polygon: dom.SVGProps<SVGPolygonElement>
      polyline: dom.SVGProps<SVGPolylineElement>
      radialGradient: dom.SVGProps<SVGRadialGradientElement>
      rect: dom.SVGProps<SVGRectElement>
      set: dom.SVGProps<SVGSetElement>
      stop: dom.SVGProps<SVGStopElement>
      switch: dom.SVGProps<SVGSwitchElement>
      symbol: dom.SVGProps<SVGSymbolElement>
      text: dom.SVGProps<SVGTextElement>
      textPath: dom.SVGProps<SVGTextPathElement>
      tspan: dom.SVGProps<SVGTSpanElement>
      use: dom.SVGProps<SVGUseElement>
      view: dom.SVGProps<SVGViewElement>
    }

    export interface IntrinsicMathMLElements {
      annotation: dom.AnnotationMathMLProps<MathMLElement>
      'annotation-xml': dom.AnnotationXmlMathMLProps<MathMLElement>
      /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/maction */
      maction: dom.MActionMathMLProps<MathMLElement>
      math: dom.MathMathMLProps<MathMLElement>
      /** This feature is non-standard. See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/menclose  */
      menclose: dom.MEncloseMathMLProps<MathMLElement>
      merror: dom.MErrorMathMLProps<MathMLElement>
      /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mfenced */
      mfenced: dom.MFencedMathMLProps<MathMLElement>
      mfrac: dom.MFracMathMLProps<MathMLElement>
      mi: dom.MiMathMLProps<MathMLElement>
      mmultiscripts: dom.MmultiScriptsMathMLProps<MathMLElement>
      mn: dom.MNMathMLProps<MathMLElement>
      mo: dom.MOMathMLProps<MathMLElement>
      mover: dom.MOverMathMLProps<MathMLElement>
      mpadded: dom.MPaddedMathMLProps<MathMLElement>
      mphantom: dom.MPhantomMathMLProps<MathMLElement>
      mprescripts: dom.MPrescriptsMathMLProps<MathMLElement>
      mroot: dom.MRootMathMLProps<MathMLElement>
      mrow: dom.MRowMathMLProps<MathMLElement>
      ms: dom.MSMathMLProps<MathMLElement>
      mspace: dom.MSpaceMathMLProps<MathMLElement>
      msqrt: dom.MSqrtMathMLProps<MathMLElement>
      mstyle: dom.MStyleMathMLProps<MathMLElement>
      msub: dom.MSubMathMLProps<MathMLElement>
      msubsup: dom.MSubsupMathMLProps<MathMLElement>
      msup: dom.MSupMathMLProps<MathMLElement>
      mtable: dom.MTableMathMLProps<MathMLElement>
      mtd: dom.MTdMathMLProps<MathMLElement>
      mtext: dom.MTextMathMLProps<MathMLElement>
      mtr: dom.MTrMathMLProps<MathMLElement>
      munder: dom.MUnderMathMLProps<MathMLElement>
      munderover: dom.MUnderMathMLProps<MathMLElement>
      semantics: dom.SemanticsMathMLProps<MathMLElement>
    }

    export interface IntrinsicHTMLElements {
      a: dom.AccessibleAnchorHTMLProps<HTMLAnchorElement>
      abbr: dom.HTMLProps<HTMLElement>
      address: dom.HTMLProps<HTMLElement>
      area: dom.AccessibleAreaHTMLProps<HTMLAreaElement>
      article: dom.ArticleHTMLProps<HTMLElement>
      aside: dom.AsideHTMLProps<HTMLElement>
      audio: dom.AudioHTMLProps<HTMLAudioElement>
      b: dom.HTMLProps<HTMLElement>
      base: dom.BaseHTMLProps<HTMLBaseElement>
      bdi: dom.HTMLProps<HTMLElement>
      bdo: dom.HTMLProps<HTMLElement>
      big: dom.HTMLProps<HTMLElement>
      blockquote: dom.BlockquoteHTMLProps<HTMLQuoteElement>
      body: dom.HTMLProps<HTMLBodyElement>
      br: dom.BrHTMLProps<HTMLBRElement>
      button: dom.ButtonHTMLProps<HTMLButtonElement>
      canvas: dom.CanvasHTMLProps<HTMLCanvasElement>
      caption: dom.CaptionHTMLProps<HTMLTableCaptionElement>
      cite: dom.HTMLProps<HTMLElement>
      code: dom.HTMLProps<HTMLElement>
      col: dom.ColHTMLProps<HTMLTableColElement>
      colgroup: dom.ColgroupHTMLProps<HTMLTableColElement>
      data: dom.DataHTMLProps<HTMLDataElement>
      datalist: dom.DataListHTMLProps<HTMLDataListElement>
      dd: dom.DdHTMLProps<HTMLElement>
      del: dom.DelHTMLProps<HTMLModElement>
      details: dom.DetailsHTMLProps<HTMLDetailsElement>
      dfn: dom.HTMLProps<HTMLElement>
      dialog: dom.DialogHTMLProps<HTMLDialogElement>
      div: dom.HTMLProps<HTMLDivElement>
      dl: dom.DlHTMLProps<HTMLDListElement>
      dt: dom.DtHTMLProps<HTMLElement>
      em: dom.HTMLProps<HTMLElement>
      embed: dom.EmbedHTMLProps<HTMLEmbedElement>
      fieldset: dom.FieldsetHTMLProps<HTMLFieldSetElement>
      figcaption: dom.FigcaptionHTMLProps<HTMLElement>
      figure: dom.HTMLProps<HTMLElement>
      footer: dom.FooterHTMLProps<HTMLElement>
      form: dom.FormHTMLProps<HTMLFormElement>
      h1: dom.HeadingHTMLProps<HTMLHeadingElement>
      h2: dom.HeadingHTMLProps<HTMLHeadingElement>
      h3: dom.HeadingHTMLProps<HTMLHeadingElement>
      h4: dom.HeadingHTMLProps<HTMLHeadingElement>
      h5: dom.HeadingHTMLProps<HTMLHeadingElement>
      h6: dom.HeadingHTMLProps<HTMLHeadingElement>
      head: dom.HeadHTMLProps<HTMLHeadElement>
      header: dom.HeaderHTMLProps<HTMLElement>
      hgroup: dom.HTMLProps<HTMLElement>
      hr: dom.HrHTMLProps<HTMLHRElement>
      html: dom.HtmlHTMLProps<HTMLHtmlElement>
      i: dom.HTMLProps<HTMLElement>
      iframe: dom.IframeHTMLProps<HTMLIFrameElement>
      img: dom.AccessibleImgHTMLProps<HTMLImageElement>
      input: dom.AccessibleInputHTMLProps<HTMLInputElement>
      ins: dom.InsHTMLProps<HTMLModElement>
      kbd: dom.HTMLProps<HTMLElement>
      keygen: dom.KeygenHTMLProps<HTMLUnknownElement>
      label: dom.LabelHTMLProps<HTMLLabelElement>
      legend: dom.LegendHTMLProps<HTMLLegendElement>
      li: dom.LiHTMLProps<HTMLLIElement>
      link: dom.LinkHTMLProps<HTMLLinkElement>
      main: dom.MainHTMLProps<HTMLElement>
      map: dom.MapHTMLProps<HTMLMapElement>
      mark: dom.HTMLProps<HTMLElement>
      marquee: dom.MarqueeHTMLProps<HTMLMarqueeElement>
      menu: dom.MenuHTMLProps<HTMLMenuElement>
      menuitem: dom.HTMLProps<HTMLUnknownElement>
      meta: dom.MetaHTMLProps<HTMLMetaElement>
      meter: dom.MeterHTMLProps<HTMLMeterElement>
      nav: dom.NavHTMLProps<HTMLElement>
      noscript: dom.NoScriptHTMLProps<HTMLElement>
      object: dom.ObjectHTMLProps<HTMLObjectElement>
      ol: dom.OlHTMLProps<HTMLOListElement>
      optgroup: dom.OptgroupHTMLProps<HTMLOptGroupElement>
      option: dom.OptionHTMLProps<HTMLOptionElement>
      output: dom.OutputHTMLProps<HTMLOutputElement>
      p: dom.HTMLProps<HTMLParagraphElement>
      param: dom.ParamHTMLProps<HTMLParamElement>
      picture: dom.PictureHTMLProps<HTMLPictureElement>
      pre: dom.HTMLProps<HTMLPreElement>
      progress: dom.ProgressHTMLProps<HTMLProgressElement>
      q: dom.QuoteHTMLProps<HTMLQuoteElement>
      rp: dom.HTMLProps<HTMLElement>
      rt: dom.HTMLProps<HTMLElement>
      ruby: dom.HTMLProps<HTMLElement>
      s: dom.HTMLProps<HTMLElement>
      samp: dom.HTMLProps<HTMLElement>
      script: dom.ScriptHTMLProps<HTMLScriptElement>
      search: dom.SearchHTMLProps<HTMLElement>
      section: dom.HTMLProps<HTMLElement>
      select: dom.AccessibleSelectHTMLProps<HTMLSelectElement>
      slot: dom.SlotHTMLProps<HTMLSlotElement>
      small: dom.HTMLProps<HTMLElement>
      source: dom.SourceHTMLProps<HTMLSourceElement>
      span: dom.HTMLProps<HTMLSpanElement>
      strong: dom.HTMLProps<HTMLElement>
      style: dom.StyleHTMLProps<HTMLStyleElement>
      sub: dom.HTMLProps<HTMLElement>
      summary: dom.HTMLProps<HTMLElement>
      sup: dom.HTMLProps<HTMLElement>
      table: dom.TableHTMLProps<HTMLTableElement>
      tbody: dom.HTMLProps<HTMLTableSectionElement>
      td: dom.TdHTMLProps<HTMLTableCellElement>
      template: dom.TemplateHTMLProps<HTMLTemplateElement>
      textarea: dom.TextareaHTMLProps<HTMLTextAreaElement>
      tfoot: dom.HTMLProps<HTMLTableSectionElement>
      th: dom.ThHTMLProps<HTMLTableCellElement>
      thead: dom.HTMLProps<HTMLTableSectionElement>
      time: dom.TimeHTMLProps<HTMLTimeElement>
      title: dom.TitleHTMLProps<HTMLTitleElement>
      tr: dom.HTMLProps<HTMLTableRowElement>
      track: dom.TrackHTMLProps<HTMLTrackElement>
      u: dom.UlHTMLProps<HTMLElement>
      ul: dom.HTMLProps<HTMLUListElement>
      var: dom.HTMLProps<HTMLElement>
      video: dom.VideoHTMLProps<HTMLVideoElement>
      wbr: dom.WbrHTMLProps<HTMLElement>
    }

    export interface IntrinsicElements
      extends IntrinsicSVGElements,
        IntrinsicMathMLElements,
        IntrinsicHTMLElements {}
  }
}
