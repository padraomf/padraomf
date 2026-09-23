import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Painel frontend
app.use('/assets', express.static(path.join(ROOT, 'assets'))); // Serve os assets reais

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(ROOT, 'assets'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

function readData() {
  const content = fs.readFileSync(path.join(ROOT, 'assets/data.js'), 'utf-8');
  const assetsMatch = content.match(/\/\* ASSETS_START \*\/([\s\S]*?)\/\* ASSETS_END \*\//);
  const projectsMatch = content.match(/\/\* PROJECTS_START \*\/([\s\S]*?)\/\* PROJECTS_END \*\//);
  const categoriesMatch = content.match(/const CATEGORIES = (\[[\s\S]*?\]);/);
  
  return {
    assets: JSON.parse(assetsMatch[1]),
    projects: JSON.parse(projectsMatch[1]),
    categories: JSON.parse(categoriesMatch[1]),
    rawContent: content
  };
}

function writeData(newAssets, newProjects, rawContent) {
  const newAssetsStr = JSON.stringify(newAssets, null, 2);
  const newProjectsStr = JSON.stringify(newProjects, null, 2);
  
  const newData = rawContent
    .replace(/\/\* ASSETS_START \*\/[\s\S]*?\/\* ASSETS_END \*\//, `/* ASSETS_START */\n${newAssetsStr}\n/* ASSETS_END */`)
    .replace(/\/\* PROJECTS_START \*\/[\s\S]*?\/\* PROJECTS_END \*\//, `/* PROJECTS_START */\n${newProjectsStr}\n/* PROJECTS_END */`);
    
  fs.writeFileSync(path.join(ROOT, 'assets/data.js'), newData);
}

app.get('/api/data', (req, res) => {
  try {
    const { projects, categories } = readData();
    res.json({ projects, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/reorder', (req, res) => {
  const { newOrderIds } = req.body;
  try {
    const { assets, projects, rawContent } = readData();
    // Sort based on newOrderIds array
    projects.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
    writeData(assets, projects, rawContent);
    execSync('python scripts/build-pages.py', { cwd: ROOT });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    const { assets, projects, rawContent } = readData();
    const newProjects = projects.filter(p => p.id !== req.params.id);
    writeData(assets, newProjects, rawContent);
    execSync('python scripts/build-pages.py', { cwd: ROOT });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/publish', (req, res) => {
  try {
    console.log("Iniciando publicação no GitHub...");
    execSync('git add -A', { cwd: ROOT });
    try {
      execSync('git commit -m "Atualização pelo painel"', { cwd: ROOT });
    } catch (e) {
       // if nothing to commit, ignore
    }
    execSync('git push', { cwd: ROOT });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.fields([{ name: 'video' }, { name: 'thumb' }]), async (req, res) => {
  try {
    const { title, description, category, type } = req.body;
    const { assets, projects, rawContent } = readData();
    
    const id = Date.now().toString();
    const isVideo = req.files.video && req.files.video[0];
    
    let videoFile = null;
    let previewFile = null;
    let thumbFile = null;

    if (isVideo) {
      const origPath = req.files.video[0].path;
      const baseName = `p-${id}`;
      const videoPath = path.join(ROOT, `assets/${baseName}.mp4`);
      const previewPath = path.join(ROOT, `assets/${baseName}-preview.mp4`);
      
      console.log("Comprimindo vídeo principal...");
      await new Promise((resolve, reject) => {
        ffmpeg(origPath)
          .outputOptions([
             '-preset fast',
             '-crf 28',
             '-movflags +faststart'
          ])
          .save(videoPath)
          .on('end', resolve)
          .on('error', reject);
      });
      
      console.log("Gerando preview...");
      await new Promise((resolve, reject) => {
        ffmpeg(origPath)
          .setDuration(6)
          .noAudio()
          .outputOptions([
             '-preset fast',
             '-crf 30',
             '-movflags +faststart'
          ])
          .save(previewPath)
          .on('end', resolve)
          .on('error', reject);
      });
      
      videoFile = `assets/${baseName}.mp4`;
      previewFile = `assets/${baseName}-preview.mp4`;
      
      // se não mandou capa, pega frame 0 do video
      if (!req.files.thumb) {
         console.log("Gerando capa...");
         await new Promise((resolve, reject) => {
            ffmpeg(origPath)
              .screenshots({
                count: 1,
                timemarks: ['0'],
                folder: path.join(ROOT, 'assets'),
                filename: `${baseName}.webp`
              }).on('end', resolve).on('error', reject);
         });
         thumbFile = `assets/${baseName}.webp`;
      }
    }
    
    if (req.files.thumb) {
        // Renomear thumb enviada (apenas para organizar, opcional)
        // Por simplicidade vamos só usar o caminho
        thumbFile = `assets/${path.basename(req.files.thumb[0].path)}`;
    }

    // Criar o projeto no formato do data.js
    const newAssetKey = `asset-${id}`;
    if (thumbFile) {
        assets[newAssetKey] = thumbFile;
    }
    
    const formatPath = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newProject = {
      id: `proj-${id}`,
      category,
      title,
      asset: newAssetKey,
      type: type || category,
      description,
      video: videoFile || "",
      preview: previewFile || "",
      demo: false,
      path: `${formatPath(title)}-${id}.html`
    };

    // Insere no TOPO
    projects.unshift(newProject);
    
    writeData(assets, projects, rawContent);
    execSync('python scripts/build-pages.py', { cwd: ROOT });
    
    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Painel rodando em http://localhost:${PORT}`);
});
