/* Persistent native YouTube embeds. Playback is confirmed by the IFrame API. */
(() => {
  'use strict';
  const controllers = new Map();
  let apiPromise, sequence = 0;
  function api() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
      script.onerror = () => reject(new Error('YouTube indisponível'));
      document.head.append(script);
    });
    return apiPromise;
  }
  function urlFor(id, preview) {
    const url = new URL('https://www.youtube-nocookie.com/embed/' + id);
    const params = { enablejsapi: '1', autoplay: '0', mute: '1', controls: preview ? '0' : '1', playsinline: '1', rel: '0', hl: 'pt-BR' };
    if (preview) Object.assign(params, { loop: '1', playlist: id, disablekb: '1' });
    if (/^https?:$/.test(location.protocol)) params.origin = location.origin;
    Object.entries(params).forEach(([key,value]) => url.searchParams.set(key,value));
    return url.href;
  }
  function mount(shell) {
    if (controllers.has(shell)) return controllers.get(shell);
    const id = shell.dataset.youtube, preview = shell.dataset.preview === 'true';
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '')) throw new Error('Invalid YouTube video ID');
    let player, ready = false, desired = false, muted = true, disposed = false;
    let frame = shell.querySelector('iframe');
    if (!frame) { frame = document.createElement('iframe'); shell.append(frame); }
    frame.id ||= 'mf-youtube-' + (++sequence);
    frame.title = shell.dataset.title || 'Vídeo Padrão MF';
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const src = urlFor(id, preview); if (frame.src !== src) frame.src = src;
    if (preview) { frame.tabIndex = -1; frame.setAttribute('aria-hidden','true'); }
    let status = shell.querySelector('.youtube-status');
    if (!status) { status = document.createElement('span'); status.className='youtube-status';status.hidden=true;status.setAttribute('role','status');shell.append(status); }
    function message(text) { status.textContent=text;status.hidden=!text; }
    function visual(playing) { shell.classList.toggle('is-playing',playing);if(preview)shell.closest('.card')?.classList.toggle('is-previewing',playing); }
    function apply() {
      if (!ready || disposed) return;
      if (desired) { muted ? player.mute() : player.unMute(); player.playVideo(); }
      else { player.pauseVideo(); visual(false); }
    }
    const controller = {
      play(silent = true) { if(disposed)return;controllers.forEach(other=>{if(other!==controller)other.pause();});muted=silent;desired=true;message('');apply(); },
      pause() { desired=false;apply();visual(false); },
      dispose() { disposed=true;desired=false;player?.destroy();controllers.delete(shell); },
      isMuted() { return ready ? player.isMuted() : muted; }
    };
    controllers.set(shell,controller);
    api().then(YT => {
      if (disposed || !shell.isConnected) return;
      player = new YT.Player(frame, { events: {
        onReady(event) { player=event.target;ready=true;player.mute();apply(); },
        onStateChange(event) {
          if (disposed) return;
          if (event.data === 1) { controllers.forEach(other=>{if(other!==controller)other.pause();});visual(true);message(''); }
          else if (event.data === 2 || event.data === 0) visual(false);
          if(event.data === 0 && preview && desired){player.seekTo(0);player.playVideo();}
        },
        onError(event) {
          visual(false);
          const local=location.protocol==='file:';
          message(event.data===153 ? (local?'Para assistir, abra o site pelo iniciador incluído no ZIP ou pela versão publicada.':'O navegador bloqueou a identificação do player. Verifique bloqueadores de conteúdo e tente novamente.') : [101,150].includes(event.data)?'O canal desativou a reprodução incorporada deste vídeo.':event.data===100?'Este vídeo está privado ou indisponível.':'Não foi possível reproduzir este vídeo agora.');
        },
        onAutoplayBlocked() { visual(false); if(!preview)message('Toque em reproduzir para assistir.'); }
      }});
    }).catch(()=>{if(!disposed&&!preview)message('A prévia automática está indisponível. Use o botão de reprodução do vídeo.');});
    if (shell.dataset.hover === 'true') {
      shell.addEventListener('pointerenter',event=>{if(['mouse','pen'].includes(event.pointerType)&&!matchMedia('(prefers-reduced-motion: reduce)').matches)controller.play(true);});
      shell.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch'&&controller.isMuted())controller.pause();});
    }
    return controller;
  }
  function disposeWithin(root) { [...controllers].forEach(([shell,controller])=>{if(root.contains(shell))controller.dispose();}); }
  window.MFYouTube = { mount, disposeWithin, hasAudible:()=>[...controllers.values()].some(c=>!c.isMuted()) };
  const shells=[...document.querySelectorAll('[data-youtube]:not([data-preview="true"])')];
  // Keep native iframes in the HTML, attach the API only near the viewport.
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting)mount(entry.target);
      else {const c=controllers.get(entry.target);if(c?.isMuted())c.pause();}
    }),{rootMargin:'150px 0px'});
    shells.forEach(shell=>observer.observe(shell));
  }else shells.forEach(mount);
  shells.filter(shell=>shell.dataset.hover==='true').forEach(shell=>{
    window.MFMediaTouch?.register(shell,{
      begin:()=>mount(shell).play(true),
      end:()=>{const c=controllers.get(shell);if(c?.isMuted())c.pause();}
    });
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)controllers.forEach(controller=>controller.pause());});
})();
