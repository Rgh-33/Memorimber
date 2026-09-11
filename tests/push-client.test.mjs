import assert from "node:assert/strict";
import test from "node:test";
import { enableMemoryPush, disableMemoryPush, showPreviewReminder, unsubscribeLocalPush } from "../lib/push-client.ts";

function browser(t, { permission="default", failSave=false, failDelete=false }={}) {
  const calls=[]; let current=null;
  const sub={endpoint:"https://fcm.googleapis.com/test",toJSON:()=>({endpoint:"https://fcm.googleapis.com/test",keys:{p256dh:"public",auth:"auth"}}),unsubscribe:async()=>{calls.push("unsubscribe");current=null;return true;}};
  const registration={active:{},pushManager:{getSubscription:async()=>current,subscribe:async options=>{assert.equal(options.userVisibleOnly,true);calls.push("subscribe");current=sub;return sub;}},showNotification:async()=>calls.push("show"),getNotifications:async()=>[{close:()=>calls.push("close")}]};
  const notification={permission,requestPermission:async()=>{calls.push("permission");notification.permission="granted";return "granted";}};
  const replacements={window:{isSecureContext:true,Notification:notification},Notification:notification,navigator:{serviceWorker:{register:async()=>{calls.push("register");return registration;},getRegistration:async()=>registration}},fetch:async(url,options)=>{
    calls.push(options.method);assert.equal(url,"/api/push-subscriptions");
    const fail=options.method==="POST"?failSave:failDelete;
    return {ok:!fail,json:async()=>fail?{error:"save failed"}:{ok:true}};
  }};
  for(const [key,value] of Object.entries(replacements)) {
    const old=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});
  }
  return {calls,setCurrent:()=>{current=sub;}};
}
test("explicit enable requests permission, subscribes and persists; disable removes both sides",async t=>{
  const {calls}=browser(t);
  await enableMemoryPush("BAAA");
  assert.deepEqual(calls,["permission","register","subscribe","POST"]);
  await disableMemoryPush();
  assert.deepEqual(calls.slice(4),["DELETE","unsubscribe","close"]);
});
test("permission denied never re-prompts or registers",async t=>{
  const {calls}=browser(t,{permission:"denied"});
  await assert.rejects(()=>enableMemoryPush("BAAA"),/拒否/);
  assert.deepEqual(calls,[]);
});
test("failed persistence rolls back a newly created local subscription",async t=>{
  const {calls}=browser(t,{failSave:true});
  await assert.rejects(()=>enableMemoryPush("BAAA"),/save failed/);
  assert.equal(calls.at(-1),"unsubscribe");
});
test("failed server delete still unsubscribes the device",async t=>{
  const {calls,setCurrent}=browser(t,{failDelete:true});setCurrent();
  await assert.rejects(()=>disableMemoryPush(),/save failed/);
  assert.ok(calls.includes("unsubscribe"));
});
test("preview notification needs no subscription or API writes",async t=>{
  const {calls}=browser(t);
  await showPreviewReminder({title:"思い出の木",body:"振り返る",href:"/"});
  assert.deepEqual(calls,["permission","register","show"]);
});
test("logout clears local subscriptions and already displayed notifications",async t=>{
  const {calls,setCurrent}=browser(t);setCurrent();
  await unsubscribeLocalPush();
  assert.deepEqual(calls,["unsubscribe","close"]);
});
