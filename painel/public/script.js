let currentProjects = [];

let currentCategories = [];

async function loadData() {
  const res = await fetch('/api/data');
  const data = await res.json();
  
  // Fill Categories
  const catSelect = document.getElementById('categorySelect');
  catSelect.innerHTML = '';
  data.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  currentCategories = data.categories;
  currentProjects = data.projects;
  renderProjects();
}

function renderProjects() {
  const container = document.getElementById('categoriesContainer');
  container.innerHTML = '';
  
  currentCategories.forEach(cat => {
      const catProjects = currentProjects.filter(p => p.category === cat.id);
      if(catProjects.length === 0) return;
      
      const catDiv = document.createElement('div');
      catDiv.innerHTML = `<h3>${cat.name}</h3>`;
      
      const ul = document.createElement('ul');
      ul.className = 'projects-list';
      ul.dataset.category = cat.id;
      
      catProjects.forEach(p => {
        const li = document.createElement('li');
        li.className = 'project-item';
        li.dataset.id = p.id;
        li.draggable = true;
        
        li.innerHTML = `
          <span><strong>${p.title}</strong></span>
          <button class="btn-del" onclick="deleteProject('${p.id}')">Excluir</button>
        `;
        
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragenter', e => e.preventDefault());

        ul.appendChild(li);
      });
      
      catDiv.appendChild(ul);
      container.appendChild(catDiv);
  });
}

let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();
  
  // Only allow drop within the same category list
  if (dragSrcEl !== this && dragSrcEl.parentNode === this.parentNode) {
    const list = this.parentNode;
    const items = [...list.children];
    const srcIndex = items.indexOf(dragSrcEl);
    const dstIndex = items.indexOf(this);
    
    if (srcIndex < dstIndex) {
      list.insertBefore(dragSrcEl, this.nextSibling);
    } else {
      list.insertBefore(dragSrcEl, this);
    }
  }
  return false;
}

async function saveOrder() {
  const items = [...document.querySelectorAll('.project-item')];
  const newOrderIds = items.map(li => li.dataset.id);
  
  showLoading('Salvando ordem e gerando site...');
  
  await fetch('/api/projects/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newOrderIds })
  });
  
  hideLoading();
  alert('Ordem atualizada com sucesso! Verifique a Home.');
}

async function deleteProject(id) {
  if(!confirm('Tem certeza que deseja apagar este trabalho?')) return;
  
  showLoading('Apagando projeto e atualizando site...');
  await fetch('/api/projects/' + id, { method: 'DELETE' });
  await loadData();
  hideLoading();
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  showLoading('Enviando e Comprimindo Vídeo... Isso pode demorar bastante (não feche a página)!');
  
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  hideLoading();
  
  if (res.ok) {
    form.reset();
    alert('Trabalho adicionado com sucesso! Site atualizado localmente.');
    await loadData();
  } else {
    const err = await res.json();
    alert('Erro: ' + err.error);
  }
});

async function publish() {
  if(!confirm('Isso vai publicar as alterações locais no GitHub (e na Vercel). Deseja continuar?')) return;
  
  showLoading('Publicando na internet (GitHub/Vercel)...');
  const res = await fetch('/api/publish', { method: 'POST' });
  hideLoading();
  
  if (res.ok) {
    alert('Site publicado com sucesso! Em cerca de 1 minuto ele estará no ar na Vercel.');
  } else {
    alert('Houve um erro na publicação.');
  }
}

function showLoading(msg) {
  document.getElementById('loadingMsg').textContent = msg;
  document.getElementById('loadingModal').classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingModal').classList.remove('active');
}

// Inicializar
loadData();
