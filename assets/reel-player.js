/* Keep one live player when changing between the modal and the compact dock. */
(() => {
  'use strict';
  const player=document.getElementById('project-dialog'),mini=document.getElementById('player-mini');
  const menu=document.getElementById('menu-dialog'),scroller=menu.querySelector('.menu-scroll'),content=menu.querySelector('.menu-content');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let menuLenis=null,frame=0;
  function syncBody(){document.body.classList.toggle('modal-open',!!document.querySelector('dialog[open]:not([data-docked="true"])'));}
  function mode(docked){
    if(!player.open)return;
    // close/show happen in one event turn; app.js ignores the queued close event
    // when the same dialog is already open again, so the video is not recreated.
    player.close();
    if(docked){player.dataset.docked='true';player.show();}
    else {delete player.dataset.docked;player.showModal();}
    mini.setAttribute('aria-label',docked?'Expandir vídeo':'Minimizar vídeo');
    mini.title=docked?'Expandir player':'Mini player';
    mini.setAttribute('aria-pressed',String(docked));
    syncBody();
  }
  const more=document.getElementById('description-toggle'),info=player.querySelector('.project-info');
  more.addEventListener('click',()=>{
    const expanded=more.getAttribute('aria-expanded')!=='true';
    info.dataset.expanded=String(expanded);more.setAttribute('aria-expanded',String(expanded));
    more.textContent=expanded?'menos':'mais';
    document.getElementById('project-permalink').hidden=!expanded;
    if(!expanded)document.getElementById('project-caption').scrollTop=0;
  });
  mini.setAttribute('aria-pressed','false');
  mini.addEventListener('click',()=>mode(player.dataset.docked!=='true'));
  player.addEventListener('close',()=>{
    if(player.open)return;
    delete player.dataset.docked;mini.setAttribute('aria-label','Minimizar vídeo');mini.title='Mini player';mini.setAttribute('aria-pressed','false');syncBody();
  });
  // Escape also closes a modeless mini-player when focus is on the page.
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&player.open&&player.dataset.docked==='true'){player.close();event.preventDefault();}
  });
  function renderMenu(){
    frame=0;if(!menu.open||reduced.matches)return;
    const y=scroller.scrollTop;
    content.style.setProperty('--menu-background',Math.min(90,y*.22).toFixed(2)+'px');
    content.style.setProperty('--menu-logo',Math.min(28,y*.13).toFixed(2)+'px');
  }
  function queue(){if(!frame)frame=requestAnimationFrame(renderMenu);}
  function configureMenu(){
    menuLenis?.destroy();menuLenis=null;
    content.style.removeProperty('--menu-background');content.style.removeProperty('--menu-logo');
    if(menu.open&&!reduced.matches&&window.Lenis){
      menuLenis=new window.Lenis({wrapper:scroller,content,autoRaf:true,smoothWheel:true,syncTouch:false,lerp:.12,
        virtualScroll:({event,deltaX,deltaY})=>!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&Math.abs(deltaY)>=Math.abs(deltaX)});
      menuLenis.on('scroll',queue);
    }
    queue();
  }
  new MutationObserver(configureMenu).observe(menu,{attributes:true,attributeFilter:['open']});
  scroller.addEventListener('scroll',queue,{passive:true});
  reduced.addEventListener('change',configureMenu);
  // Size the popup from the actual image/video, including the separate static caption.
  function fit(){
    const media=document.getElementById('project-media');
    const node=media.querySelector('video, img');
    const image=player.dataset.format==='image';
    const width=node?.videoWidth||node?.naturalWidth||0;
    const height=node?.videoHeight||node?.naturalHeight||0;
    const ratio=width&&height?width/height:image?3/4:player.dataset.format==='landscape'?16/9:9/16;
    if(!image&&width&&height)player.dataset.format=ratio>1?'landscape':'portrait';
    const viewport=window.visualViewport;
    const availableWidth=Math.max(180,(viewport?.width||window.innerWidth)-32);
    const availableHeight=Math.max(180,(viewport?.height||window.innerHeight)-56);
    const maxHeight=Math.min(760,availableHeight);
    const maxWidth=Math.min(image?680:ratio>1?960:420,availableWidth);
    const captionSpace=image?Math.min(228,maxHeight*.48):0;
    let popupWidth=Math.min(maxWidth,(maxHeight-captionSpace)*ratio);
    if(image)popupWidth=Math.max(Math.min(320,maxWidth),popupWidth);
    const popupHeight=Math.min(maxHeight,popupWidth/ratio+captionSpace);
    player.style.setProperty('--popup-width',Math.round(popupWidth)+'px');
    player.style.setProperty('--popup-height',Math.round(popupHeight)+'px');
  }
  window.addEventListener('resize',()=>{if(player.open)fit();},{passive:true});
  window.visualViewport?.addEventListener('resize',()=>{if(player.open)fit();},{passive:true});
  window.MFReel={expand:()=>mode(false),fit};
})();
