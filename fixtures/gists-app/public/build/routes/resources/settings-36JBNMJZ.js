import"/build/_shared/chunk-XCTGKEWA.js";import"/build/_shared/chunk-MXBYS5UE.js";import{b as a,f as m,i as u,k as l}from"/build/_shared/chunk-3FICFDS2.js";import"/build/_shared/chunk-JKO55VJE.js";import{b as g,d as f,e,f as i}from"/build/_shared/chunk-AKSB5QXU.js";i();i();var n=g(f());var c={breadcrumb:()=>e.createElement(a,{to:"/resources"},"Resources")};function h(){var s=document.getElementsByTagName("link");for(var r in s){var t=s[r];t.rel==="stylesheet"&&(t.href+="")}}function d(){let s=u(),{state:r,submission:t}=l();return(0,n.useEffect)(()=>{r==="loading"&&t&&h()},[r,t]),e.createElement("section",null,e.createElement("h1",null,"Edit theme settings"),e.createElement(m,{method:"post",action:"/resources/theme-css"},e.createElement("input",{name:"event",type:"hidden",value:"reset"}),e.createElement("button",{"data-testid":"reset",type:"submit"},"Reset")),e.createElement(m,{method:"post",action:"/resources/theme-css"},Object.entries(s).map(([o,p])=>e.createElement(n.Fragment,{key:o},e.createElement("label",{htmlFor:o},o,":",e.createElement("input",{name:o,type:"color",defaultValue:p})),e.createElement("br",null))),e.createElement("button",{"data-testid":"save",type:"submit"},"Save")))}export{d as default,c as handle};
