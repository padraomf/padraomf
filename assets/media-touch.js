/* Native touch scrolling with a single highlighted, silent gallery preview. */
(() => {
  'use strict';
  const entries=new Map(), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let selected=null, finger=null, point=null, moved=false, suppressUntil=0, frame=0, touchUsed=false;
  const blocked=()=>document.hidden||document.querySelector('dialog[open]')||window.MFYouTube?.hasAudible();
  function clear(){if(selected){entries.get(selected)?.end();selected.classList.remove('is-touch-selected');selected=null;}}
  function select(node){
    if(blocked()||reduced.matches){clear();return;}
    if(!node||node===selected)return;
    clear();selected=node;node.classList.add('is-touch-selected');entries.get(node)?.begin();
  }
  function underPoint(x,y){return document.elementFromPoint(x,y)?.closest('[data-preview-target]');}
  function visible(node){const r=node.getBoundingClientRect();return r.bottom>80&&r.top<innerHeight-20&&r.right>0&&r.left<innerWidth;}
  function choose(){
    frame=0;if(!touchUsed||blocked()||reduced.matches)return;
    if(finger&&point){const node=underPoint(point.x,point.y);if(entries.has(node)){select(node);return;}}
    // After a swipe, follow the card nearest the viewport's reading position.
    const x=point?.x??innerWidth/2,y=Math.max(120,Math.min(point?.y??innerHeight*.52,innerHeight*.7));
    let best=null,score=Infinity;
    entries.forEach((_,node)=>{if(!visible(node))return;const r=node.getBoundingClientRect();
      const overlap=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,80))/Math.min(r.height,innerHeight-80);
      if(overlap<.55)return;
      const distance=Math.abs((r.top+r.bottom)/2-y)+Math.abs((r.left+r.right)/2-x)*.65;
      if(distance<score){best=node;score=distance;}
    });
    if(best)select(best);else if(selected&&!visible(selected))clear();
  }
  function queue(){if(touchUsed&&!frame)frame=requestAnimationFrame(choose);}
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){finger=null;clear();return;}
    const t=event.touches[0];touchUsed=true;moved=false;finger={id:t.identifier,x:t.clientX,y:t.clientY};point={x:t.clientX,y:t.clientY};
    const node=underPoint(point.x,point.y);if(entries.has(node))select(node);
  },{passive:true});
  document.addEventListener('touchmove',event=>{
    if(!finger)return;const t=[...event.touches].find(t=>t.identifier===finger.id);if(!t)return;
    point={x:t.clientX,y:t.clientY};moved ||= Math.hypot(point.x-finger.x,point.y-finger.y)>12;queue();
  },{passive:true});
  function finish(){if(moved)suppressUntil=performance.now()+450;finger=null;queue();}
  document.addEventListener('touchend',finish,{passive:true});
  document.addEventListener('touchcancel',()=>{finger=null;queue();},{passive:true});
  document.addEventListener('scroll',queue,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  reduced.addEventListener('change',()=>{if(reduced.matches)clear();});
  document.querySelectorAll('dialog').forEach(d=>new MutationObserver(()=>{if(d.open)clear();}).observe(d,{attributes:true,attributeFilter:['open']}));
  window.MFMediaTouch={
    register(node,handlers){node.dataset.previewTarget='true';entries.set(node,handlers);},
    suppressClick(){return performance.now()<suppressUntil;},
    clear
  };
})();
