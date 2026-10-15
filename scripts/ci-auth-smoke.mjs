import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
if(!process.env.CI || process.env.CONFIRM_DEMO_SEED!=="create-demo-in-empty-database") throw new Error("Only run against the ephemeral CI database.");
const base="http://127.0.0.1:3000", jar=new Map();
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3000"],{stdio:["ignore","inherit","inherit"],env:{...process.env,AUTH_URL:base}});
async function request(path,options={}){
 const headers=new Headers(options.headers);
 if(jar.size)headers.set("cookie",[...jar].map(([k,v])=>k+"="+v).join("; "));
 const response=await fetch(base+path,{...options,headers,redirect:"manual"});
 for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],i=pair.indexOf("=");jar.set(pair.slice(0,i),pair.slice(i+1));}
 return response;
}
try{
 let ready=false;
 for(let i=0;i<90;i++){try{if((await request("/api/auth/providers")).ok){ready=true;break;}}catch{} await delay(1000);}
 assert(ready,"Server did not become ready");
 assert([401,403].includes((await request("/api/admin/metrics")).status),"Anonymous access must be denied");
 const page=await request("/zh/login");assert.equal(page.status,200);assert((await page.text()).includes("Studio Admin"));
 const csrf=await (await request("/api/auth/csrf")).json();assert(csrf.csrfToken);
 const login=await request("/api/auth/callback/credentials",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","X-Auth-Return-Redirect":"1"},body:new URLSearchParams({csrfToken:csrf.csrfToken,email:process.env.ADMIN_SEED_EMAIL,password:process.env.ADMIN_SEED_PASSWORD,callbackUrl:base+"/zh/admin"})});
 assert(login.ok,"Login callback failed");
 const session=await (await request("/api/auth/session")).json();
 assert.equal(session.user?.email,process.env.ADMIN_SEED_EMAIL);assert.equal(session.user?.role,"ADMIN");
 for(const path of ["/api/admin/metrics","/api/admin/workspace?tab=students","/api/admin/workspace?tab=teacher-accounts"]){
  const response=await request(path);assert.equal(response.status,200,path);assert.equal((await response.json()).ok,true,path);
 }
 const admin=await request("/zh/admin");assert.equal(admin.status,200);assert((await admin.text()).includes("申请审核"));
 const outCsrf=await (await request("/api/auth/csrf")).json();
 await request("/api/auth/signout",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","X-Auth-Return-Redirect":"1"},body:new URLSearchParams({csrfToken:outCsrf.csrfToken,callbackUrl:base+"/zh/login"})});
 const ended=await (await request("/api/auth/session")).json();assert(!ended?.user);
 assert([401,403].includes((await request("/api/admin/metrics")).status));
 console.log("PASS: anonymous denial -> CSRF -> credentials login -> session -> admin/API -> signout -> denial");
}finally{server.kill("SIGTERM");}
