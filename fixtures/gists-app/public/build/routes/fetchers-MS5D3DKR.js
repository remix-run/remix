import"/build/_shared/chunk-ZCOVUWEY.js";import{b as u,f as d,i as f,k as c,l as g,o as l}from"/build/_shared/chunk-5GYOXAJ7.js";import"/build/_shared/chunk-JKO55VJE.js";import{b as k,d as x,e,f as i}from"/build/_shared/chunk-AKSB5QXU.js";i();i();var s=k(x());var b="/build/_assets/pending-forms-KHC4FUF6.css";function T(){return[{rel:"stylesheet",href:b}]}function y(){let r=f(),[t]=(0,l.useSearchParams)();return e.createElement("div",null,e.createElement("h2",null,"Filter Tasks"),e.createElement(v,null),e.createElement("hr",null),e.createElement("h2",null,"Tasks"),t.has("q")&&e.createElement("p",null,"Filtered by search: ",e.createElement("i",null,t.get("q"))),r.map(o=>e.createElement(q,{key:o.id,task:o})),e.createElement("p",null,e.createElement(u,{to:"/gists"},"Gists")))}function v(){let r=c(),[t]=(0,l.useSearchParams)();return e.createElement(d,{method:"get"},e.createElement("input",{type:"text",name:"q",defaultValue:t.get("q")||""})," ",e.createElement("button",{type:"submit"},"Go"),r.type==="loaderSubmission"?e.createElement("p",null,"Searching for: ",r.submission.formData.get("q"),"..."):e.createElement("p",null,"\xA0"))}function q({task:r}){let t=g(),o=t.type==="done"&&!("error"in t.data)?t.data:r;return e.createElement(t.Form,{method:"post"},e.createElement("input",{type:"hidden",name:"id",value:r.id}),e.createElement("input",{type:"hidden",name:"complete",value:String(!r.complete)}),e.createElement("button",{type:"submit","data-status":t.data&&"error"in t.data?"error":r.complete?"complete":"incomplete"},o.complete?"Mark Incomplete":"Mark Complete",t.state==="submitting"&&e.createElement(L,{key:t.submission.key,total:r.delay}))," ",r.name," ",t.type==="done"&&"error"in t.data&&e.createElement("span",{style:{color:"red"}},"Error! ",t.data.error))}function L({total:r}){let[t,o]=(0,s.useState)(0),[a,h]=(0,s.useState)(null),n=0;return a&&(n=(t-a)/r*100),(0,s.useEffect)(()=>{if(n>=100)return;let m=requestAnimationFrame(p=>{o(p),a||h(p)});return()=>cancelAnimationFrame(m)},[a,n]),e.createElement("progress",{value:n,max:"100"})}export{y as default,T as links};
