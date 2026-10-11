let currentProjects = [];

let currentCategories = [];
let panelToken = '';

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...options.headers, 'X-Panel-Token': panelToken } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

async function operation(message, handler) {
  showLoading(message);
  try { await handler(); } catch (error) { alert(error.message || 'Falha de conexão. Tente novamente.'); }
  finally { hideLoading(); }
}

async function loadData() {
  const data = await request('/api/data');
  
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
      const heading = document.createElement('h3');
      heading.textContent = cat.name;
      catDiv.appendChild(heading);
      
      const ul = document.createElement('ul');
      ul.className = 'projects-list';
      ul.dataset.category = cat.id;
      
      catProjects.forEach(p => {
        const li = document.createElement('li');
        li.className = 'project-item';
        li.dataset.id = p.id;
        li.draggable = true;
        
        const span = document.createElement('span');
        const strong = document.createElement('strong');
        strong.textContent = p.title;
        span.appendChild(strong);
        const button = document.createElement('button');
        button.className = 'btn-del';
        button.textContent = 'Excluir';
        button.addEventListener('click', () => deleteProject(p.id));
        li.append(span, button);
        
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
  
  await operation('Salvando ordem e gerando site...', async () => {
  await request('/api/projects/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newOrderIds })
  });
  
  await loadData();
  alert('Ordem atualizada com sucesso! Verifique a Home.');
  });
}

async function deleteProject(id) {
  if(!confirm('Tem certeza que deseja apagar este trabalho?')) return;
  
  await operation('Apagando projeto e atualizando site...', async () => {
  await request('/api/projects/' + encodeURIComponent(id), { method: 'DELETE' });
  await loadData();
  });
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  await operation('Processando o trabalho... Aguarde e mantenha a página aberta.', async () => {
  
  await request('/api/upload', {
    method: 'POST',
    body: formData
  });
  
    form.reset();
    alert('Trabalho adicionado com sucesso! Site atualizado localmente.');
    await loadData();
  });
});

async function publish() {
  if(!confirm('Isso vai publicar as alterações locais no GitHub (e na Vercel). Deseja continuar?')) return;
  
  await operation('Enviando alterações e verificando a publicação...', async () => {
    const result = await request('/api/publish', { method: 'POST' });
    alert(result.message);
  });
}

function showLoading(msg) {
  document.getElementById('loadingMsg').textContent = msg;
  document.getElementById('loadingModal').classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingModal').classList.remove('active');
}

// Inicializar
operation('Carregando painel...', async () => {
  panelToken = (await request('/api/session')).token;
  await loadData();
});
