import"/build/_shared/chunk-ZCOVUWEY.js";import{f as l,i as d,k as p}from"/build/_shared/chunk-5GYOXAJ7.js";import"/build/_shared/chunk-JKO55VJE.js";import{b as y,d as h,f as r}from"/build/_shared/chunk-AKSB5QXU.js";r();r();var e=y(h());var u="/build/_assets/methods-JZZVQUYI.css";function w(){return[{rel:"stylesheet",href:u}]}function m(){let o=d(),[a,c]=e.useState("post"),[n,b]=e.useState("application/x-www-form-urlencoded"),s=p().submission,i=s?Object.fromEntries(s.formData):null;return e.createElement("div",{"data-test-id":"/methods"},e.createElement(l,{action:"/methods",method:a,encType:n},e.createElement("p",null,e.createElement("label",null,"Method:"," ",e.createElement("select",{value:a,name:"selectedMethod",onChange:t=>c(t.target.value)},e.createElement("option",null,"get"),e.createElement("option",null,"post"),e.createElement("option",null,"put"),e.createElement("option",null,"delete")))),e.createElement("p",null,e.createElement("label",null,"Enctype:"," ",e.createElement("select",{value:n,name:"selectedEnctype",onChange:t=>b(t.target.value)},e.createElement("option",null,"application/x-www-form-urlencoded"),e.createElement("option",null,"multipart/form-data")))),e.createElement("p",null,e.createElement("label",null,"User Input:"," ",e.createElement("input",{type:"text",name:"userInput",defaultValue:"whatever"}))),e.createElement("p",null,"Multiple",e.createElement("br",null),e.createElement("label",null,"A:"," ",e.createElement("input",{defaultChecked:!0,type:"checkbox",name:"multiple[]",defaultValue:"a"})),e.createElement("br",null),e.createElement("label",null,"B:"," ",e.createElement("input",{defaultChecked:!0,type:"checkbox",name:"multiple[]",defaultValue:"b"}))),e.createElement("p",null,e.createElement("label",null,e.createElement("input",{type:"checkbox",name:"slow"})," Go slow")),e.createElement("p",null,e.createElement("button",{type:"submit",id:"submit-with-data",name:"data",value:"c"},a," (with data)"),e.createElement("button",{type:"submit",id:"submit"},a))),e.createElement("div",{id:"results",style:{opacity:i?.25:1,transition:"opacity 300ms",transitionDelay:"50ms"}},i?e.createElement("dl",null,Object.keys(i).map(t=>e.createElement("div",{key:t},e.createElement("dt",null,t),e.createElement("dd",null,i[t])))):o.body?e.createElement("dl",{"data-test-id":o.body.selectedMethod},Object.keys(o.body).map(t=>e.createElement("div",{key:t},e.createElement("dt",null,t),e.createElement("dd",null,JSON.stringify(o.body[t]))))):e.createElement("p",null,"null")))}export{m as default,w as links};
