import {RoutePattern,urlpat} from './route-pattern.ts'
import type {Params} from './params.ts'
export type Method='GET'|'POST'|'PUT'|'DELETE'|'PATCH'|'HEAD'|'OPTIONS'|'*'
export type Handler<P extends string>=(req:Request,params:Params<P>)=>Response | Promise<Response>
type Route ={method:Method; pattern:RoutePattern<any>; up?:URLPattern; handler:Handler<any>}

export function createRouter(){
  const routes:Route[]=[]
  const api={
    get<P extends string>(pattern:P,handler:Handler<P>){add('GET',pattern,handler);return api},
    all<P extends string>(pattern:P,handler:Handler<P>){add('*',pattern,handler);return api},
    async handle(req:Request):Promise<Response|undefined>{
      const url=new URL(req.url)
      const method=(req.method||'GET').toUpperCase()
      for(const r of routes){
        if(r.method!=='*'&&r.method!==method) continue
        if(r.up&&!r.up.test(url)) continue
        const m=r.pattern.match(url)
        if(m) return r.handler(req,m.params as any)
      }
      return undefined
    }
  }
  function add(method:Method, src:string, handler:Handler<any>) {
    const rp=new RoutePattern(src)
    const up=urlpat(rp)||undefined
    routes.push({method,pattern:rp,up,handler})
  }
  return api
}
