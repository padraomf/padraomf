/* Padrão MF: native-position smooth scrolling, bounded parallax and blur reveal. */
(() => {
  'use strict';
  const header = document.querySelector('.header');
  if (!header) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 640px)');
  const nodes = [...document.querySelectorAll('.showcase-window, .ideas-banner, .footer-main, .shelf, .service-heading, .work-item, .detail-layout, .about-intro, .about-copy, .software-section')];
  const scenes = nodes.map(node => ({node, top: 0, height: 0, shift: 0}));
  let lenis = null, frame = 0, measureNeeded = true, compact = null;
  const clamp = value => Math.min(1, Math.max(0, value));

  function measure() {
    const y = window.scrollY;
    scenes.forEach(scene => {
      const rect = scene.node.getBoundingClientRect();
      // Remove the previous visual translation to retain stable layout coordinates.
      scene.top = rect.top + y - scene.shift;
      scene.height = rect.height;
    });
    measureNeeded = false;
  }

  function render() {
    frame = 0;
    if (measureNeeded) measure();
    const y = window.scrollY, vh = window.innerHeight;
    const nextCompact = y > 84;
    if (nextCompact !== compact) {
      compact = nextCompact;
      header.classList.toggle('header--compact', compact);
    }
    if (reduced.matches) return;
    const distance = mobile.matches ? 36 : 72;
    scenes.forEach(scene => {
      const top = scene.top - y;
      const near = top < vh + 120 && top + scene.height > -120;
      if (!near && scene.rendered) {scene.node.classList.remove('scene-near');return;}
      scene.rendered = true;
      // Fully clear content remains usable even if animation support fails.
      const entrance = clamp((vh * .96 - top) / (vh * .34));
      const ease = entrance * entrance * (3 - 2 * entrance);
      const progress = clamp((vh - top) / (vh + scene.height));
      const shift = (0.5 - progress) * distance;
      scene.shift = shift;
      scene.node.style.setProperty('--scene-shift', shift.toFixed(2) + 'px');
      scene.node.style.setProperty('--scene-depth', (-shift * .24).toFixed(2) + 'px');
      scene.node.style.setProperty('--scene-blur', ((1 - ease) * (mobile.matches ? 4 : 7)).toFixed(2) + 'px');
      scene.node.style.setProperty('--scene-opacity', (.32 + ease * .68).toFixed(3));
      scene.node.classList.toggle('scene-near', top < vh + 100 && top + scene.height > -100);
    });
  }

  function queue() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function invalidate() { measureNeeded = true; queue(); }
  function syncDialogs() {
    if (!lenis) return;
    if (document.querySelector('dialog[open]:not([data-docked="true"])') || document.hidden) lenis.stop();
    else lenis.start();
  }
  function configure() {
    if (lenis) { lenis.destroy(); lenis = null; }
    scenes.forEach(scene => {
      scene.node.classList.remove('scroll-reveal', 'scene-near');
      ['--scene-shift', '--scene-depth', '--scene-blur', '--scene-opacity'].forEach(name => scene.node.style.removeProperty(name));
      scene.shift = 0; scene.rendered = false;
    });
    if (!reduced.matches) {
      scenes.forEach(scene => scene.node.classList.add('scroll-reveal'));
      if (window.Lenis) {
        lenis = new window.Lenis({
          autoRaf: true, lerp: .085, smoothWheel: true, syncTouch: false,
          anchors: {offset: -88}, stopInertiaOnNavigate: true,
          prevent: node => node.tagName === 'DIALOG',
          virtualScroll: ({event, deltaX, deltaY}) => !event.ctrlKey && !event.metaKey && !event.shiftKey && Math.abs(deltaY) >= Math.abs(deltaX)
        });
        lenis.on('scroll', queue);
        syncDialogs();
      }
    }
    invalidate();
  }

  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.setAttribute('data-lenis-prevent', '');
    new MutationObserver(syncDialogs).observe(dialog, {attributes: true, attributeFilter: ['open']});
  });
  window.addEventListener('scroll', queue, {passive: true});
  window.addEventListener('resize', invalidate, {passive: true});
  window.addEventListener('pageshow', invalidate);
  document.addEventListener('visibilitychange', () => { syncDialogs(); if (!document.hidden) invalidate(); });
  reduced.addEventListener('change', configure);
  mobile.addEventListener('change', invalidate);
  const observer = new ResizeObserver(invalidate);
  scenes.forEach(scene => observer.observe(scene.node));
  configure();
})();
