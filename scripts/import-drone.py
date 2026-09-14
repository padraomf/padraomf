"""Import the five supplied Drone works; keep originals untouched."""
from pathlib import Path
import argparse, json, re, subprocess

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
dist=root if (root/'assets/data.js').is_file() else root/'dist'
records=[
 ('Nosso bairro sempre mereceu enxergar isso de cima.A nova praça chegou trazendo esperança, movime.mp4','drone-nova-praca','Nova praça · Vista do bairro','Registro aéreo urbano','Imagens de drone da nova praça e do bairro, mostrando o espaço e sua integração com a comunidade.'),
 ('Ponte com musica.mov','drone-ponte','Ponte · Vista aérea','Filmagem aérea','Um novo ponto de vista da ponte, com imagens aéreas e edição acompanhada de trilha musical.'),
 ('Semifinal da Copa de Futsal no JP2Áudio- torcida da Vila#drone #padraomf #futebolbrasileiro #fut.mp4','drone-semifinal-futsal-jp2','Semifinal de futsal · JP2','Cobertura de evento esportivo','Cobertura aérea da semifinal da Copa de Futsal no JP2, com o som e a energia da torcida da Vila.'),
 ('Transformamos a orla de Petrolina em cenário para mostrar a localização e negócio do nosso clien.mp4','drone-orla-petrolina','Orla de Petrolina · Localização comercial','Vídeo para empresas','A orla de Petrolina como cenário para apresentar a localização de um negócio, com imagens de drone e contexto do entorno.'),
 ('Isso é SÃO JOÃO PNZ RUN! 🤩🙏🏻.mp4','drone-sao-joao-pnz-run','São João PNZ Run','Cobertura de corrida','Imagens aéreas do São João PNZ Run para registrar o evento e apresentar a corrida por outra perspectiva.')
]
new=[]
for filename,slug,title,kind,description in records:
 source=args.source/filename
 assert source.is_file(),filename
 full=dist/f'assets/{slug}.mp4';cover=dist/f'assets/{slug}.webp'
 common=['ffmpeg','-hide_banner','-loglevel','error','-y']
 if not full.exists() or full.stat().st_size>25*2**20:
  options=['-c','copy'] if source.suffix=='.mp4' else ['-c:v','libx264','-preset','medium','-crf','20','-maxrate','3800k','-bufsize','7600k','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k']
  subprocess.run(common+['-i',str(source),'-map','0:v:0','-map','0:a:0?']+options+['-movflags','+faststart',str(full)],check=True)
 subprocess.run(common+['-i',str(full),'-ss','3','-frames:v','1','-vf','scale=540:-2','-quality','88',str(cover)],check=True)
 assert cover.is_file() and cover.stat().st_size>0
 new.append(dict(id=slug,category='drone',title=title,asset=slug,type=kind,description=description,video=f'assets/{slug}.mp4',preview=f'assets/{slug}-preview.mp4',demo=False,path=slug+'.html'))
 print(title,round(full.stat().st_size/2**20,1),'MiB',flush=True)
path=dist/'assets/data.js';data=path.read_text()
projects=json.loads(re.search(r'const PROJECTS = (\[.*?\]);',data,re.S)[1])
assets=json.loads(re.search(r'/\* ASSETS_START \*/\s*(\{.*?\})',data,re.S)[1])
ids={p['id'] for p in new};projects=[p for p in projects if p['id'] not in ids]
insertion=next(i for i,p in enumerate(projects) if p['category']=='drone');projects[insertion:insertion]=new
for p in new:assets[p['asset']]=f'assets/{p["id"]}.webp'
data=re.sub(r'const PROJECTS = \[.*?\];',lambda _: 'const PROJECTS = '+json.dumps(projects,ensure_ascii=False,indent=2)+';',data,flags=re.S)
data=re.sub(r'/\* ASSETS_START \*/\s*\{.*?\}\s*/\* ASSETS_END \*/',lambda _: '/* ASSETS_START */ '+json.dumps(assets,ensure_ascii=False,indent=2)+' /* ASSETS_END */',data,flags=re.S)
path.write_text(data)
print(f'{len(new)} Drone works added; {len(projects)} projects.',flush=True)
