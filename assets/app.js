  const icon = (name) => ({arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>',play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 10 7-10 7Z" fill="currentColor"/></svg>',left:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',right:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'}[name]);
  const $ = id => document.getElementById(id);
  const imageFor = p => p.image || ASSETS[p.asset] || ASSETS.logo;
  const categoryFor = p => CATEGORIES.find(c=>c.id===p.category);
  let currentProject = null, lastTrigger = null;
  let activePreview = null, previewEpoch = 0;
  const projectPath = p => p.path;
  const publicUrl = path => {
    if(/^https?:$/.test(location.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return new URL(path,location.href).href;
    try{return CONFIG.siteUrl?new URL(path,CONFIG.siteUrl).href:'';}catch{return '';}
  };
  function whatsappFor(p=null, category=null){
    const reference=p?publicUrl(projectPath(p)):category?publicUrl(category.path):'';
    const message=(p ? `Olá! Gostaria de um projeto de ${categoryFor(p).label} como “${p.title}”.` : category ? `Olá! Gostaria de conversar sobre ${category.label}.` : CONFIG.mensagemWhatsApp)+(reference?'\nReferência: '+reference:'');
    return 'https://wa.me/'+CONFIG.whatsapp.replace(/\D/g,'')+'?text='+encodeURIComponent(message);
  }
  document.querySelectorAll('[data-logo]').forEach(img=>img.src=ASSETS.logo);
  $('year').textContent=new Date().getFullYear();
  function showDialog(dialog, trigger) {
    stopPreview();
    lastTrigger=trigger || document.activeElement;
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    dialog.showModal(); document.body.classList.add('modal-open');
  }
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{ if(event.target!==dialog)return; const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close(); });
    dialog.addEventListener('close',()=>{
      if(dialog.open)return; // A mode switch preserves the current player.
      if(dialog.id==='project-dialog') { delete dialog.dataset.docked; window.MFYouTube?.disposeWithin($('project-media'));$('project-media').replaceChildren(); }
      if(!document.querySelector('dialog[open]')) { document.body.classList.remove('modal-open'); if(lastTrigger?.isConnected&&!lastTrigger.closest('dialog:not([open])'))lastTrigger.focus({preventScroll:true});else $('open-menu').focus({preventScroll:true}); }
    });
  });
  $('open-menu').addEventListener('click',e=>showDialog($('menu-dialog'),e.currentTarget));
  const SERVICES = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));
  const serviceId=document.body.dataset.service||'';
  const service= CATEGORIES.find(c=>c.id===serviceId);
  if(document.body.dataset.page==='sobre')$('about-nav').setAttribute('aria-current','page');
  if($('service-nav')){
    const nav=$('service-nav'),shell=document.createElement('div');shell.className='service-nav-shell';
    nav.before(shell);shell.append(nav);
    const prev=document.createElement('button'),next=document.createElement('button');
    prev.type=next.type='button';prev.className='service-nav-control prev';next.className='service-nav-control next';
    prev.innerHTML=icon('left');next.innerHTML=icon('right');
    prev.setAttribute('aria-label','Ver serviços anteriores');next.setAttribute('aria-label','Ver próximos serviços');
    [prev,next].forEach(b=>b.setAttribute('aria-controls','service-nav'));
    const update=()=>{const overflowing=nav.scrollWidth>nav.clientWidth+8;shell.classList.toggle('is-scrollable',overflowing);prev.hidden=next.hidden=!overflowing;prev.disabled=nav.scrollLeft<8;next.disabled=nav.scrollWidth-nav.clientWidth-nav.scrollLeft<8;};
    const move=direction=>nav.scrollBy({left:direction*nav.clientWidth*.7,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
    nav.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(nav);
    shell.append(prev,next);requestAnimationFrame(update);
  }

  function enhanceCard(card){
    const project=PROJECTS.find(p=>p.id===card.dataset.project);if(!project)return;
    card.addEventListener('click',event=>{
      if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();if(window.MFMediaTouch?.suppressClick())return;
      openProject(project.id,card);
    });
    attachPreview(project,card,card.querySelector('.card-art'));
  }
  document.querySelectorAll('.card[data-project]').forEach(enhanceCard);
  document.querySelectorAll('[data-open-project]').forEach(link=>link.addEventListener('click',event=>{
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();openProject(link.dataset.openProject,link);
  }));
  function renderShelf(category){
    const section=document.getElementById(category.id);if(!section)return;
    const track=section.querySelector('.track'),prev=section.querySelector('.prev'),next=section.querySelector('.next');
    function updateControls(){prev.disabled=track.scrollLeft<8;next.disabled=track.scrollWidth-track.clientWidth-track.scrollLeft<8;}
    const move=direction=>track.scrollBy({left:direction*track.clientWidth*.78,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
    track.addEventListener('scroll',()=>{updateControls();},{passive:true});
    new ResizeObserver(updateControls).observe(track);requestAnimationFrame(updateControls);
  }
  if($('showcase-track')){
    CATEGORIES.forEach(renderShelf);
    // Only native vertical videos belong in the opening Story presentation.
    const featured=[];
    const storyLists=['motion','drone','social'].map(id=>PROJECTS.filter(p=>p.category===id && p.preview)).filter(list=>list.length);
    // Cycle shorter collections so every position keeps the service alternation.
    const rounds=Math.max(0,...storyLists.map(list=>list.length));
    for(let round=0;round<rounds;round++)storyLists.forEach(list=>featured.push(list[round%list.length]));
    for(let copy=0;copy<2;copy++){
      const group=document.createElement('div');group.className='story-group';group.setAttribute('aria-hidden','true');
      featured.forEach(p=>{
        const tile=document.createElement('div');tile.className='story-tile';
        const cover=document.createElement('img');cover.src=imageFor(p);cover.alt='';cover.loading='lazy';cover.width=360;cover.height=640;
        const video=document.createElement('video');video.dataset.src=p.preview+'?v=8';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='none';video.tabIndex=-1;video.setAttribute('muted','');video.disablePictureInPicture=true;
        const label=document.createElement('span');label.className='story-label';label.textContent=categoryFor(p).label;
        video.addEventListener('playing',()=>tile.classList.add('is-playing'));
        video.addEventListener('error',()=>tile.classList.remove('is-playing'));
        tile.append(cover,video,label);group.append(tile);
      });
      $('showcase-track').append(group);
    }
    setupShowcase();
  }

  function setupShowcase(){
    const track=$('showcase-track'),region=$('showcase'),toggle=$('carousel-toggle');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const videos=[...track.querySelectorAll('video')],nearby=new Set();
    let paused=reduced.matches,visible=true;
    const canRun=()=>!paused && visible && !document.hidden && !document.querySelector('dialog[open]');
    function sync(){
      const running=canRun();track.style.animationPlayState=running?'running':'paused';
      videos.forEach(video=>{
        if(running && nearby.has(video)){
          if(!video.getAttribute('src'))video.src=video.dataset.src;
          if(video.paused)video.play().catch(()=>{});
        }else {
          video.pause();
          // Release off-screen media buffers as the longer presentation advances.
          if(!nearby.has(video) && video.getAttribute('src')){
            video.removeAttribute('src');video.load();video.parentElement.classList.remove('is-playing');
          }
        }
      });
    }
    function updateToggle(){toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'Retomar apresentação dos trabalhos':'Pausar apresentação dos trabalhos');toggle.innerHTML=(paused?icon('play'):'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>')+'<span>'+(paused?'Retomar':'Pausar')+'</span>';}
    toggle.addEventListener('click',()=>{paused=!paused;updateToggle();sync();});
    // No hover, click or touch listeners: this strip is a continuous presentation.
    if('IntersectionObserver' in window){
      const observer=new IntersectionObserver(entries=>{entries.forEach(e=>e.isIntersecting?nearby.add(e.target):nearby.delete(e.target));sync();},{threshold:0});
      videos.forEach(v=>observer.observe(v));
      new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0}).observe(region);
    }else videos.forEach(v=>nearby.add(v));
    function setSpeed(){const width=track.firstElementChild.getBoundingClientRect().width;track.style.animationDuration=(width/66)+'s';}
    new ResizeObserver(setSpeed).observe(track.firstElementChild);setSpeed();
    document.addEventListener('visibilitychange',sync);
    document.querySelectorAll('dialog').forEach(d=>new MutationObserver(sync).observe(d,{attributes:true,attributeFilter:['open']}));
    reduced.addEventListener('change',()=>{paused=reduced.matches;updateToggle();sync();});
    updateToggle();sync();
  }

  function stopPreview(){
    previewEpoch++;
    if(!activePreview)return;
    const {video,card,controller}=activePreview;activePreview=null;
    if(video){video.pause();video.removeAttribute('src');video.load();}
    if(controller)controller.pause();
    card.classList.remove('is-previewing');
  }
  function attachYouTubePreview(project,card,art){
    let timer,controller;
    const shell=document.createElement('span');shell.className='youtube-shell youtube-preview-shell';
    shell.dataset.youtube=project.youtubeId;shell.dataset.title=project.title;shell.dataset.preview='true';
    art.append(shell);
    function begin(){
      if(document.querySelector('dialog[open]')||activePreview?.card===card)return;
      stopPreview();
      controller=window.MFYouTube.mount(shell);
      activePreview={card,controller};controller.play(true);
    }
    function end(){clearTimeout(timer);if(activePreview?.card===card)stopPreview();}
    card.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen'){clearTimeout(timer);timer=setTimeout(begin,180);}});
    card.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')end();});card.addEventListener('blur',end);card.addEventListener('click',end);
    card.addEventListener('focus',()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setTimeout(begin,180);});
    window.MFMediaTouch?.register(card,{begin,end});
  }
  function attachPreview(project,card,art){
    if(project.youtubeId){attachYouTubePreview(project,card,art);return;}
    const source=getVideoSource(project.preview||project.video);
    if(!source||source.type!=='video')return;
    const video=document.createElement('video');video.className='card-preview';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='none';video.tabIndex=-1;video.setAttribute('aria-hidden','true');video.setAttribute('muted','');video.disablePictureInPicture=true;
    const badge=document.createElement('span');badge.className='preview-badge';badge.textContent='Prévia sem som';badge.setAttribute('aria-hidden','true');art.append(video,badge);
    let timer=null;
    function begin(){
      if(document.querySelector('dialog[open]')||activePreview?.card===card)return;
      stopPreview();const epoch=previewEpoch;activePreview={card,video};
      if(!video.getAttribute('src'))video.src=source.src+'?v=8';
      video.muted=true;
      video.play().then(()=>{if(activePreview?.video===video&&epoch===previewEpoch)card.classList.add('is-previewing');else if(activePreview?.video!==video)video.pause();}).catch(()=>{if(activePreview?.video===video&&epoch===previewEpoch)stopPreview();});
    }
    function end(){clearTimeout(timer);if(activePreview?.video===video)stopPreview();}
    card.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'||event.pointerType==='pen'){clearTimeout(timer);timer=setTimeout(begin,140);}});
    card.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')end();});
    card.addEventListener('focus',()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setTimeout(begin,180);});
    card.addEventListener('blur',end);
    window.MFMediaTouch?.register(card,{begin,end});
    video.addEventListener('error',end);
    card.addEventListener('click',end);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPreview();});
  // Focusing a native iframe must not remove its player.

  function getVideoSource(value) {
    if(!value || typeof value!=='string')return null;
    if(/^data:video\/(mp4|webm);base64,[A-Za-z0-9+/=]+$/.test(value))return {type:'video',src:value};
    try {
      const url=new URL(value,location.href);
      if(!['https:','http:','file:'].includes(url.protocol))return null;
      const host=url.hostname.toLowerCase().replace(/^www\./,'');
      if(['youtube.com','m.youtube.com','youtu.be'].includes(host)){
        const id=host==='youtu.be'?url.pathname.slice(1).split('/')[0]:url.searchParams.get('v')||url.pathname.split('/').filter(Boolean).pop();
        return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?{type:'iframe',src:'https://www.youtube-nocookie.com/embed/'+id}:null;
      }
      if(['vimeo.com','player.vimeo.com'].includes(host)) {const id=url.pathname.split('/').filter(Boolean).pop();return /^\d+$/.test(id||'')?{type:'iframe',src:'https://player.vimeo.com/video/'+id}:null;}
      return /\.(mp4|webm|ogg)$/i.test(url.pathname)?{type:'video',src:url.href}:null;
    }catch{return null;}
  }
  function openProject(id,trigger){const p=PROJECTS.find(p=>p.id===id);if(!p)return;lastTrigger=trigger||lastTrigger;currentProject=p;renderProject(p);if($('project-dialog').dataset.docked==='true')window.MFReel?.expand();else if(!$('project-dialog').open)showDialog($('project-dialog'),trigger);$('project-media').querySelector('video')?.play().catch(()=>{});}
  function renderProject(p){
    $('project-title').textContent=p.title;$('project-category').textContent=categoryFor(p).label;$('project-description').textContent=p.description;$('project-sample').hidden=!p.demo;
    $('project-whatsapp').href=whatsappFor(p);$('project-permalink').href=projectPath(p);
    $('project-share').dataset.shareProject=p.id;
    $('project-dialog').dataset.format=p.youtubeId?'landscape':p.video?'portrait':'image';
    $('player-mini').hidden=!p.video;
    $('project-dialog').querySelector('.project-info').dataset.expanded='false';
    $('description-toggle').setAttribute('aria-expanded','false');$('description-toggle').textContent='mais';$('project-permalink').hidden=true;$('project-caption').scrollTop=0;
    const media=$('project-media');media.querySelectorAll('video').forEach(video=>video.pause());window.MFYouTube?.disposeWithin(media);media.replaceChildren();const source=getVideoSource(p.video);
    if(p.youtubeId){const shell=document.createElement('div');shell.className='youtube-shell';shell.dataset.youtube=p.youtubeId;shell.dataset.title=p.title;media.append(shell);window.MFYouTube.mount(shell).play(false);}
    else if(source?.type==='iframe'){const frame=document.createElement('iframe');frame.src=source.src;frame.title=p.title;frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';media.append(frame);}
    else if(source?.type==='video'){const video=document.createElement('video');video.src=source.src;video.controls=true;video.autoplay=true;video.playsInline=true;video.preload='none';video.poster=imageFor(p);video.setAttribute('aria-label',p.title);video.addEventListener('error',()=>{const msg=document.createElement('p');msg.textContent='Não foi possível carregar este vídeo. Tente novamente mais tarde.';msg.style.padding='24px';media.replaceChildren(msg);});media.append(video);}
    else {const img=document.createElement('img');img.src=imageFor(p);img.alt=p.title+' — '+p.type;media.append(img);}
    const fittingMedia=media.querySelector('video, img');
    const fit=()=>{if(!fittingMedia||fittingMedia.isConnected)window.MFReel?.fit();};
    fittingMedia?.addEventListener(fittingMedia.tagName==='VIDEO'?'loadedmetadata':'load',fit,{once:true});
    fit();
  }
  function adjacentProject(direction){const list=PROJECTS.filter(p=>p.category===currentProject.category);const index=list.findIndex(p=>p.id===currentProject.id);currentProject=list[(index+direction+list.length)%list.length];renderProject(currentProject);$('project-dialog').scrollTop=0;}
  $('previous-project').addEventListener('click',()=>adjacentProject(-1));$('next-project').addEventListener('click',()=>adjacentProject(1));
  const detailProject=PROJECTS.find(p=>p.id===document.body.dataset.project);
  const whatsapp=whatsappFor(detailProject,service);
  document.querySelectorAll('[data-whatsapp]').forEach(link=>{const project=PROJECTS.find(p=>p.id===link.dataset.contactProject);link.href=project?whatsappFor(project):whatsapp;link.target='_blank';link.rel='noopener noreferrer';});
  if(CONFIG.instagram){try{const url=new URL(CONFIG.instagram);if(url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)){$('instagram-footer').href=url.href;$('instagram-footer').hidden=false;}}catch{}}

  if(CONFIG.youtube){try{const url=new URL(CONFIG.youtube);if(url.protocol==='https:'&&['youtube.com','www.youtube.com'].includes(url.hostname)){$('youtube-footer').href=url.href;$('youtube-footer').target='_blank';$('youtube-footer').rel='noopener noreferrer';}}catch{}}

  const softwareToggle=$('software-toggle');
  if(softwareToggle){let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;softwareToggle.textContent=paused?'Retomar':'Pausar';softwareToggle.setAttribute('aria-pressed',String(paused));softwareToggle.addEventListener('click',()=>{paused=!paused;$('software-track').style.animationPlayState=paused?'paused':'running';softwareToggle.setAttribute('aria-pressed',String(paused));softwareToggle.textContent=paused?'Retomar':'Pausar';});}

  // Drag-to-scroll for .track elements
  document.querySelectorAll('.track').forEach(track => {
    let isDown = false;
    let startX;
    let scrollLeft;
    let isDragging = false;
    
    track.addEventListener('mousedown', (e) => {
      isDown = true;
      isDragging = false;
      track.style.cursor = 'grabbing';
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
      track.style.scrollSnapType = 'none';
      track.style.scrollBehavior = 'auto';
    });
    
    const endDrag = () => {
      isDown = false;
      track.style.cursor = '';
      track.style.scrollSnapType = '';
      track.style.scrollBehavior = '';
      setTimeout(() => isDragging = false, 50);
    };
    
    window.addEventListener('mouseup', () => {
      if(isDown) endDrag();
    });
    
    track.addEventListener('mouseleave', endDrag);
    
    track.addEventListener('mousemove', (e) => {
      if(!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 5) isDragging = true;
      track.scrollLeft = scrollLeft - walk;
    });

    // Prevent click when dragging
    track.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (isDragging) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, true);
    });

    // Visual Affordance Hint (Bounce/Peek Animation)
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let hasPeeked = false;
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !hasPeeked) {
          hasPeeked = true;
          observer.disconnect();
          
          setTimeout(() => {
             if (track.scrollLeft > 10 || isDown) return; // Cancel if user already scrolled
             
             // Disable scroll-snap so it doesn't fight the smooth scroll
             const originalSnap = track.style.scrollSnapType;
             track.style.scrollSnapType = 'none';
             
             track.scrollTo({ left: 75, behavior: 'smooth' });
             
             setTimeout(() => {
                if (isDown) return; 
                track.scrollTo({ left: 0, behavior: 'smooth' });
                
                setTimeout(() => {
                   if (!isDown) track.style.scrollSnapType = originalSnap;
                }, 600);
             }, 500);
          }, 800);
        }
      }, { threshold: 0.5 });
      observer.observe(track);
    }
  });
