/* Share the current service/work URL, with clipboard and manual-copy fallbacks. */
(() => {
  'use strict';
  const feedback=document.getElementById('share-feedback');
  let timeout;
  const hide=()=>{feedback.hidden=true;clearTimeout(timeout);};
  feedback.querySelector('button').addEventListener('click',hide);
  function message(text,url=''){
    clearTimeout(timeout);
    const dialog=document.querySelector('dialog[open]:not([data-docked="true"])');
    (dialog||document.body).append(feedback);
    feedback.querySelector('p').textContent=text;
    const label=feedback.querySelector('label'),input=feedback.querySelector('input');
    label.hidden=!url;input.value=url;feedback.hidden=false;
    if(dialog)feedback.scrollIntoView?.({block:'nearest'});
    if(url){input.focus();input.select();}else timeout=setTimeout(hide,4500);
  }
  async function share(button){
    const project=PROJECTS.find(p=>p.id===button.dataset.shareProject);
    const category=CATEGORIES.find(c=>c.id===button.dataset.shareService);
    const record=project||category;if(!record)return;
    const title=(project?project.title:category.name)+' · Padrão MF';
    const url=publicUrl(record.path);
    if(!url){message('Abra a versão publicada para compartilhar um link acessível.');return;}
    const data={title,text:record.description,url};
    button.disabled=true;hide();
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare(data))){
        try{await navigator.share(data);return;}catch(error){if(error.name==='AbortError')return;}
      }
      if(navigator.clipboard?.writeText){
        try{await navigator.clipboard.writeText(url);message('Link copiado.');return;}catch{}
      }
      message('Copie este link para compartilhar o trabalho ou serviço.',url);
    }finally{button.disabled=false;}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button[data-share-project],button[data-share-service]');
    if(!button)return;event.preventDefault();share(button);
  });
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{if(!dialog.open)hide();}));
})();
