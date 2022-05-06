import{a as l}from"/build/_shared/chunk-6TZ3VSRZ.js";import{b as m,d as r,f as a}from"/build/_shared/chunk-AKSB5QXU.js";a();var n=m(r());var o={meta:{title:"Hello, World!",description:"Isn't this fantastic?!?!?!"},headers:{"Cache-Control":"public, max-age=0, must-revalidate"},message:"Hello World!"};function h(e={}){let s=Object.assign({h1:"h1",p:"p",h2:"h2",ul:"ul",li:"li",a:"a",pre:"pre",code:"code",span:"span"},e.components),{wrapper:p}=s,t=n.default.createElement(n.default.Fragment,null,n.default.createElement(s.h1,null,"Hello Blog!"),`
`,n.default.createElement(s.p,null,"I am a MDX page. This is a message from frontmatter: ",o.message),`
`,n.default.createElement(s.h2,null,"Table of Contents"),`
`,n.default.createElement(s.ul,null,`
`,n.default.createElement(s.li,null,n.default.createElement(s.a,{href:"#stateful-jsx-component"},"Stateful JSX Component")),`
`,n.default.createElement(s.li,null,n.default.createElement(s.a,{href:"#rehype-plugin-syntax-highlighting"},"Rehype Plugin Syntax Highlighting")),`
`),`
`,n.default.createElement(s.h2,null,"Stateful JSX Component"),`
`,n.default.createElement(s.p,null,"This is stateful:"),`
`,n.default.createElement(l,null),`
`,n.default.createElement(s.h2,null,"Rehype Plugin Syntax Highlighting"),`
`,n.default.createElement(s.p,null,"Here's a code block."),`
`,n.default.createElement(s.pre,null,n.default.createElement(s.code,{className:"hljs language-js"},n.default.createElement(s.span,{className:"hljs-keyword"},"export")," ",n.default.createElement(s.span,{className:"hljs-keyword"},"default")," ",n.default.createElement(s.span,{className:"hljs-keyword"},"function")," ",n.default.createElement(s.span,{className:"hljs-title hljs-function"},"PageOne"),"(",n.default.createElement(s.span,{className:"hljs-params"}),`) {
  `,n.default.createElement(s.span,{className:"hljs-keyword"},"return")," ",n.default.createElement(s.span,{className:"xml"},n.default.createElement(s.span,{className:"hljs-tag"},"<",n.default.createElement(s.span,{className:"hljs-name"},"div"),">"),"Page One",n.default.createElement(s.span,{className:"hljs-tag"},"</",n.default.createElement(s.span,{className:"hljs-name"},"div"),">")),`;
}
`)));return p?n.default.createElement(p,{...e},t):t}var c=h;var u=typeof o!="undefined"&&o.headers,d=typeof o!="undefined"&&o.meta,_=void 0;export{c as a,d as b,_ as c};
