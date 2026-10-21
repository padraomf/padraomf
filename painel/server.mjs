import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE = 'E:/SERVIDOR/projetos/padrao-mf/portfolio';
const fault = (message, status = 400) => Object.assign(new Error(message), { status });

export function createPanel({ root = process.env.SITE_ROOT || path.join(HERE, '..'), state = process.env.PANEL_STATE || DEFAULT_STATE, python = process.env.PANEL_PYTHON || 'python', run = execFileSync } = {}) {
  root = path.resolve(root); state = path.resolve(state);
  for (const dir of ['dados/temporarios', 'backups', 'logs', 'configuracoes', 'documentacao']) fs.mkdirSync(path.join(state, dir), { recursive: true });
  const app = express();
  const token = crypto.randomBytes(32).toString('hex');
  let busy = false;
  const command = (exe, args, cwd = root) => run(exe, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  const localFile = relative => { const target = path.resolve(root, relative); if (!target.startsWith(root + path.sep)) throw fault('Caminho fora do portfólio.'); return target; };
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return res.status(403).json({ error: 'Acesso permitido apenas neste computador.' });
    if ((req.headers.origin && req.headers.origin !== 'http://' + host) || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Origem não autorizada.' });
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    if (req.path.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method) && req.headers['x-panel-token'] !== token) return res.status(403).json({ error: 'Reabra o painel para renovar a sessão.' });
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.use(express.static(path.join(HERE, 'public')));
  app.use('/assets', express.static(path.join(root, 'assets')));
  app.get('/api/session', (req, res) => res.json({ token }));
  const readData = () => {
    const raw = fs.readFileSync(localFile('assets/data.js'), 'utf8');
    return { raw, assets: JSON.parse(raw.match(/\/\* ASSETS_START \*\/([\s\S]*?)\/\* ASSETS_END \*\//)[1]), projects: JSON.parse(raw.match(/\/\* PROJECTS_START \*\/([\s\S]*?)\/\* PROJECTS_END \*\//)[1]), categories: JSON.parse(raw.match(/const CATEGORIES = (\[[\s\S]*?\]);/)[1]) };
  };
  // Generate in isolation first. Prior versions remain available for recovery.
  const save = (data, removed = []) => {
    const stage = fs.mkdtempSync(path.join(state, 'dados/temporarios/geracao-'));
    const backup = path.join(state, 'backups', Date.now() + '-' + crypto.randomUUID());
    const changed = [];
    try {
      fs.mkdirSync(path.join(stage, 'scripts'));
      fs.copyFileSync(localFile('vercel.json'), path.join(stage, 'vercel.json'));
      for (const name of ['build-pages.py', 'check-seo.py']) fs.copyFileSync(localFile('scripts/' + name), path.join(stage, 'scripts', name));
      fs.cpSync(localFile('assets'), path.join(stage, 'assets'), { recursive: true, filter: src => !/\.(mp4|webm|mov|m4v)$/i.test(src) });
      const raw = data.raw.replace(/\/\* ASSETS_START \*\/[\s\S]*?\/\* ASSETS_END \*\//, '/* ASSETS_START */\n' + JSON.stringify(data.assets, null, 2) + '\n/* ASSETS_END */').replace(/\/\* PROJECTS_START \*\/[\s\S]*?\/\* PROJECTS_END \*\//, '/* PROJECTS_START */\n' + JSON.stringify(data.projects, null, 2) + '\n/* PROJECTS_END */');
      fs.writeFileSync(path.join(stage, 'assets/data.js'), raw);
      command(python, ['scripts/build-pages.py'], stage); command(python, ['scripts/check-seo.py'], stage);
      for (const project of removed) fs.rmSync(path.join(stage, 'assets/share', project.id + '.jpg'), { force: true });
      const files = ['assets/data.js', 'robots.txt', 'sitemap.xml', 'vercel.json', ...fs.readdirSync(stage).filter(n => n.endsWith('.html')), ...fs.readdirSync(path.join(stage, 'assets/share')).map(n => 'assets/share/' + n)];
      const deletes = removed.flatMap(p => [p.path, 'projeto-' + p.id + '.html', 'assets/share/' + p.id + '.jpg']).filter(n => !files.includes(n));
      fs.mkdirSync(backup, { recursive: true });
      fs.writeFileSync(path.join(backup, 'operacao.json'), JSON.stringify({ date: new Date().toISOString(), files, deletes }, null, 2));
      for (const name of [...files, ...deletes]) {
        const target = localFile(name), old = path.join(backup, name);
        if (fs.existsSync(target)) { fs.mkdirSync(path.dirname(old), { recursive: true }); fs.copyFileSync(target, old); }
        changed.push({ target, old });
        if (files.includes(name)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(stage, name), target); }
        else fs.rmSync(target, { force: true });
      }
    } catch (err) {
      for (const { target, old } of changed.reverse()) { if (fs.existsSync(old)) fs.copyFileSync(old, target); else fs.rmSync(target, { force: true }); }
      throw err;
    } finally { fs.rmSync(stage, { recursive: true, force: true }); }
  };
  const exclusive = handler => async (req, res, next) => {
    if (busy) return res.status(409).json({ error: 'Há uma atualização em andamento. Aguarde e tente novamente.' });
    busy = true; try { await handler(req, res); } catch (err) { next(err); } finally { busy = false; }
  };
  app.get('/api/data', (req, res, next) => { try { const { projects, categories } = readData(); res.json({ projects, categories }); } catch (err) { next(err); } });
  app.post('/api/projects/reorder', exclusive((req, res) => {
    const data = readData(), ids = req.body.newOrderIds;
    if (!Array.isArray(ids) || ids.length !== data.projects.length || new Set(ids).size !== ids.length || ids.some(id => !data.projects.some(p => p.id === id))) throw fault('A lista mudou. Recarregue o painel antes de ordenar.');
    data.projects.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); save(data); res.json({ success: true });
  }));
  app.delete('/api/projects/:id', exclusive((req, res) => {
    const data = readData(), removed = data.projects.find(p => p.id === req.params.id);
    if (!removed) throw fault('Projeto não encontrado.', 404);
    data.projects = data.projects.filter(p => p.id !== removed.id); save(data, [removed]);
    // Keep media for recovery. Deleted HTML is backed up outside the public site.
    res.json({ success: true });
  }));
  app.post('/api/publish', exclusive(async (req, res) => {
    command(python, ['scripts/check-seo.py']);
    if (command('git', ['branch', '--show-current']).trim() !== 'main') throw fault('Abra a pasta principal do portfólio para publicar.');
    const candidates = command('git', ['ls-files', '--modified', '--deleted', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
    const allowed = name => /^(assets\/|painel\/(public\/|server\.mjs$|package(-lock)?\.json$)|scripts\/|[^/]+\.html$|robots\.txt$|sitemap\.xml$|vercel\.json$|ABRIR-PAINEL\.bat$|INDEXACAO\.txt$)/.test(name) && !/(^|\/)node_modules\/|(^|\/)upload-|(^|\/)\.env|(^|\/)backups\//.test(name);
    if (command('git', ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean).some(n => !allowed(n))) throw fault('Há arquivos fora do portfólio preparados no Git. Revise-os antes de publicar.');
    const files = candidates.filter(allowed);
    for (let i = 0; i < files.length; i += 40) command('git', ['add', '-A', '--', ...files.slice(i, i + 40)]);
    if (command('git', ['diff', '--cached', '--name-only']).trim()) command('git', ['commit', '-m', 'Atualização pelo painel']);
    command('git', ['push', 'origin', 'main']);
    const sha = command('git', ['rev-parse', 'HEAD']).trim();
    let deployment = 'pending', deploymentUrl = null;
    // A push confirms GitHub. The hosting provider reports deployment separately.
    try {
      const response = await fetch(`https://api.github.com/repos/padraomf/padraomf/commits/${sha}/status`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
      if (response.ok) { const status = await response.json(), vercel = status.statuses.find(s => /vercel/i.test(s.context)); if (vercel) { deployment = vercel.state; deploymentUrl = vercel.target_url; } }
    } catch { /* Keep pending rather than inventing success. */ }
    res.json({ success: true, commit: sha, deployment, deploymentUrl, message: deployment === 'success' ? 'GitHub atualizado e publicação no Vercel confirmada.' : ['failure', 'error'].includes(deployment) ? 'GitHub atualizado, mas o Vercel informou falha. Confira a implantação.' : 'GitHub atualizado. A publicação no Vercel ainda está aguardando confirmação.' });
  }));
  const upload = multer({
    dest: path.join(state, 'dados/temporarios'),
    limits: { fileSize: 512 * 1024 * 1024, files: 2, fields: 4, fieldSize: 10000, parts: 6 },
    fileFilter(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const good = file.fieldname === 'video' ? ['.mp4', '.mov', '.webm', '.m4v'].includes(ext) && /^(video\/|application\/octet-stream)/.test(file.mimetype) : file.fieldname === 'thumb' && ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) && file.mimetype.startsWith('image/');
      cb(good ? null : fault('Envie vídeo MP4/MOV/WebM ou capa PNG/JPG/WebP.'), good);
    }
  }).fields([{ name: 'video', maxCount: 1 }, { name: 'thumb', maxCount: 1 }]);
  app.post('/api/upload', exclusive(async (req, res) => {
    const produced = [];
    try {
      await new Promise((resolve, reject) => upload(req, res, err => err ? reject(err) : resolve()));
      const data = readData(), { category } = req.body;
      const text = (key, max) => { const value = req.body[key]; if (typeof value !== 'string' || value.trim().length > max || !value.trim()) throw fault('Preencha título, descrição, tipo e categoria corretamente.'); return value.trim(); };
      const title = text('title', 200), description = text('description', 5000), type = text('type', 200);
      if (!data.categories.some(c => c.id === category)) throw fault('Categoria inválida.');
      const video = req.files?.video?.[0], thumb = req.files?.thumb?.[0];
      if (!video && !thumb) throw fault('Envie um vídeo ou uma imagem.');
      if (thumb && thumb.size > 20 * 1024 * 1024) throw fault('A capa deve ter até 20 MB.');
      const id = Date.now() + '-' + crypto.randomBytes(3).toString('hex'), base = 'assets/p-' + id;
      const convert = async (source, target, options, duration) => {
        produced.push(localFile(target));
        const args = ['-nostdin', '-y', '-i', source, ...(duration ? ['-t', String(duration)] : []), ...options.flatMap(value => value.split(' ')), localFile(target)];
        await execute(process.env.PANEL_FFMPEG || 'ffmpeg', args, { windowsHide: true, timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
      };
      if (video) {
        await convert(video.path, base + '.mp4', ['-c:v libx264', '-c:a aac', '-preset fast', '-crf 28', '-movflags +faststart']);
        await convert(video.path, base + '-preview.mp4', ['-c:v libx264', '-an', '-preset fast', '-crf 30', '-movflags +faststart'], 6);
      }
      await convert(thumb?.path || video.path, base + '.webp', ['-frames:v 1', '-vf scale=1600:1600:force_original_aspect_ratio=decrease', '-c:v libwebp']);
      const asset = 'asset-' + id; data.assets[asset] = base + '.webp';
      const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto';
      data.projects.unshift({ id: 'proj-' + id, category, title, description, type, asset, video: video ? base + '.mp4' : '', preview: video ? base + '-preview.mp4' : '', demo: false, path: slug + '-' + id + '.html' });
      save(data); res.json({ success: true });
    } catch (err) { for (const file of produced) fs.rmSync(file, { force: true }); throw err; }
    finally { for (const file of Object.values(req.files || {}).flat()) fs.rmSync(file.path, { force: true }); }
  }));
  app.use((err, req, res, next) => {
    fs.appendFileSync(path.join(state, 'logs/painel.log'), new Date().toISOString() + ' ' + req.method + ' ' + req.path + ' ' + err.message + '\n');
    const badUpload = err instanceof multer.MulterError;
    res.status(err.status || (badUpload ? 400 : 500)).json({ error: badUpload ? 'Envio inválido ou arquivo acima do limite permitido.' : err.status ? err.message : 'Não foi possível concluir. Os dados anteriores foram preservados. Consulte o registro do painel.' });
  });
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createPanel().listen(port, '127.0.0.1', () => console.log(`Painel disponível somente neste computador: http://127.0.0.1:${port}`));
}
