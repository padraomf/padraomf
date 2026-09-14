"""Prepare the six supplied Pocket videos, preserving duration and resolution."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse,json,re,subprocess,tempfile,shutil
parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];dist=root if (root/'assets/data.js').is_file() else root/'dist'
records=[
 ('Vaguinho - Chegou sexta feiraok.mp4','pocket-vaguinho-sexta-feira','Vaguinho · Chegou sexta-feira','Vídeo musical de Vaguinho em formato vertical, com edição para divulgação nas redes sociais.'),
 ('Au au au ok.mp4','pocket-au-au-au','Au, au, au','Pocket video musical em formato vertical, com ritmo e edição pensados para as redes sociais.'),
 ('oh vaqueirook.mp4','pocket-oh-vaqueiro','Oh, vaqueiro','Conteúdo musical vertical para aproximar o público da apresentação e divulgar o trabalho nas redes.'),
 ('vamos vaqueirook.mp4','pocket-vamos-vaqueiro-performance','Vamos, vaqueiro · Pocket','Registro musical com edição em formato vertical para divulgação nas redes sociais.'),
 ('No ouvidinho#pisadinha #piseiro #piseirodovaqueiro.mp4','pocket-no-ouvidinho','No ouvidinho','Pocket video de piseiro com edição vertical para acompanhar a música e compartilhar nas redes sociais.'),
 ('cachaça.mp4','pocket-cachaca','Cachaça','Vídeo musical em formato vertical, com edição para divulgação e conexão com o público nas redes sociais.')
]
def prepare(record):
 filename,slug,title,description=record;source=args.source/filename
 assert source.is_file(),filename
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(source)]));duration=float(info['format']['duration'])
 full=dist/f'assets/{slug}.mp4';preview=dist/f'assets/{slug}-preview.mp4';cover=dist/f'assets/{slug}.webp'
 common=['ffmpeg','-hide_banner','-loglevel','error','-y']
 with tempfile.TemporaryDirectory(prefix='mf-pocket-') as work:
  temp=Path(work)/'video.mp4'
  if not full.exists() or (source.stat().st_size<25*2**20 and full.stat().st_size>source.stat().st_size):
   rate=max(1000,int(21*2**20*8/duration/1000)-160)
   options=['-c','copy'] if source.stat().st_size<25*2**20 else ['-c:v','libx264','-threads','2','-preset','fast','-crf','20','-maxrate',str(rate)+'k','-bufsize',str(rate*2)+'k','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k']
   subprocess.run(common+['-i',str(source),'-map','0:v:0','-map','0:a:0?']+options+['-movflags','+faststart',str(temp)],check=True)
   shutil.copyfile(temp,full)
  subprocess.run(common+['-i',str(full),'-t','6','-an','-vf','scale=360:-2,fps=24,setsar=1','-c:v','libx264','-threads','2','-preset','fast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',str(temp)],check=True);shutil.copyfile(temp,preview)
  temp_cover=Path(work)/'cover.webp'
  subprocess.run(common+['-i',str(full),'-ss','3','-frames:v','1','-vf','scale=540:-2','-quality','88',str(temp_cover)],check=True);shutil.copyfile(temp_cover,cover)
 print(title,round(full.stat().st_size/2**20,1),'MiB',flush=True)
 return dict(id=slug,category='social',title=title,asset=slug,type='Pocket video musical',description=description,video=f'assets/{slug}.mp4',preview=f'assets/{slug}-preview.mp4',demo=False,path=slug+'.html')
with ThreadPoolExecutor(max_workers=2) as pool:new=list(pool.map(prepare,records))
path=dist/'assets/data.js';data=path.read_text()
projects=json.loads(re.search(r'const PROJECTS = (\[.*?\]);',data,re.S)[1]);assets=json.loads(re.search(r'/\* ASSETS_START \*/\s*(\{.*?\})',data,re.S)[1])
ids={p['id'] for p in new};projects=[p for p in projects if p['id'] not in ids];index=next(i for i,p in enumerate(projects) if p['category']=='social');projects[index:index]=new
for p in new:assets[p['id']]=f'assets/{p["id"]}.webp'
data=re.sub(r'const PROJECTS = \[.*?\];',lambda _: 'const PROJECTS = '+json.dumps(projects,ensure_ascii=False,indent=2)+';',data,flags=re.S)
data=re.sub(r'/\* ASSETS_START \*/\s*\{.*?\}\s*/\* ASSETS_END \*/',lambda _: '/* ASSETS_START */ '+json.dumps(assets,ensure_ascii=False,indent=2)+' /* ASSETS_END */',data,flags=re.S);path.write_text(data)
print(f'{len(new)} Pocket works added; {len(projects)} projects.',flush=True)
