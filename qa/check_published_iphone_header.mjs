#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const session='iphonepublished';
const browser=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000}).trim();
const socket=new WebSocket(browser('get','cdp-url'));
let id=0;const pending=new Map();
socket.onmessage=event=>{const message=JSON.parse(event.data),request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(message.error):request.resolve(message.result);}};
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params,...(sessionId?{sessionId}:{})}));});
try {
  const {targetInfos}=await send('Target.getTargets');
  const target=targetInfos.find(item=>item.type==='page'&&item.url.startsWith('https://reversoworks-gestor.github.io/Gestor/'));
  const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  await send('Emulation.setSafeAreaInsetsOverride',{insets:{top:62,bottom:34,left:0,right:0}},sessionId);
  browser('wait','--fn',"getComputedStyle(document.querySelector('.gestor-frame')).paddingTop==='132px'");
  browser('scroll','down','700');
  let result=JSON.parse(browser('eval',`JSON.stringify({url:location.href,scrollY,top:document.querySelector('.gestor-topbar').getBoundingClientRect().top,height:document.querySelector('.gestor-topbar').getBoundingClientRect().height,menuTop:document.querySelector('.mobile-menu-toggle').getBoundingClientRect().top,position:getComputedStyle(document.querySelector('.gestor-topbar')).position,framePadding:getComputedStyle(document.querySelector('.gestor-frame')).paddingTop,physicalIPhoneTest:false})`));
  if(typeof result==='string')result=JSON.parse(result);
  result.pass=result.scrollY>0&&result.top===0&&result.height===132&&result.menuTop>=72&&result.position==='fixed'&&result.framePadding==='132px';
  writeFileSync(new URL('./iphone-header-published-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
  if(!result.pass)throw new Error('Published header regression failed');
} finally {socket.close();browser('close');}
