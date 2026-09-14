"""Prepare supplied Motion batches for the web without changing their duration."""
from pathlib import Path
import argparse, subprocess, json, re

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
parser.add_argument('--batch',choices=['v5','v6'],default='v5')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
dist=root if (root/'assets/data.js').is_file() else root/'dist'
records=[
 ('Agenda Janeiro.mp4','motion-agenda-janeiro','Agenda de janeiro','Agenda animada','Agenda de apresentações em motion design, com datas e cidades em destaque.'),
 ('Agenda semana 16 jan.mp4','motion-agenda-16-janeiro','Agenda da semana · 16 de janeiro','Agenda animada','Divulgação da programação semanal com animação de textos e elementos gráficos.'),
 ('Agenda semanal 11 JUN.mp4','motion-agenda-11-junho','Agenda semanal · 11 de junho','Agenda animada','Motion para apresentar a agenda semanal em formato vertical para as redes sociais.'),
 ('aNIMAÇÃO BANDEJA.mp4','motion-animacao-bandeja','Animação · Bandeja','Animação promocional','Animação de produto para uma apresentação visual dinâmica nas redes sociais.'),
 ('CORREÇÃO AGENDA MAIO.mp4','motion-agenda-maio','Agenda de maio','Agenda animada','Peça animada para divulgação das datas e locais das apresentações de maio.'),
 ('ESTÁ NO AR.mp4','motion-esta-no-ar','Está no ar','Divulgação de lançamento','Motion de lançamento com chamada visual para divulgar a novidade ao público.'),
 ('HOJE 09 - QUIJINGUE - BA 2.mp4','motion-quijingue','Hoje · Quijingue, BA','Chamada de evento','Chamada animada para apresentação em Quijingue, com as informações do evento em destaque.'),
 ('iPHONE NOVO APP NOVO.mp4','motion-iphone-app','iPhone novo, app novo','Animação promocional','Motion promocional para apresentar a novidade com animação e linguagem para redes sociais.'),
 ('Lançamento sua musica.mp4','motion-lancamento-sua-musica','Lançamento · Sua Música','Divulgação musical','Peça animada para divulgar um lançamento musical e convidar o público a ouvir.')
]
if args.batch=='v6':
 records=[
  ('Nova Interface Pede ai.mp4','motion-nova-interface-pede-ai','Nova interface · Pede Aí','Apresentação de aplicativo','Apresentação animada da nova interface do Pede Aí, com destaque para a experiência de uso do aplicativo.'),
  ('O BABY VAII FAZER HISTÓRIA.mp4','motion-baby-historia','O Baby vai fazer história','Animação promocional','Peça promocional em motion para apresentar o Baby com uma chamada de impacto.'),
  ('o Duo Perfeito.mp4','motion-duo-perfeito','O duo perfeito','Campanha animada','Animação promocional que apresenta a combinação de produtos em um formato dinâmico para redes sociais.'),
  ('Original.mp4','motion-original','Original','Animação promocional','Peça promocional com movimento e composição visual para destacar o produto nas redes sociais.'),
  ('Preparados.mp4','motion-preparados','Preparados?','Teaser animado','Teaser em motion design para despertar a curiosidade do público e anunciar uma novidade.'),
  ('ta disponível.mp4','motion-ta-disponivel','Tá disponível','Divulgação de lançamento','Chamada animada para anunciar a disponibilidade de um lançamento e convidar o público a conferir.')
 ]
for filename,slug,title,kind,description in records:
 source=args.source/filename
 assert source.is_file(),filename
 full=dist/f'assets/{slug}.mp4'
 preview=dist/f'assets/{slug}-preview.mp4'
 cover=dist/f'assets/{slug}.webp'
 common=['ffmpeg','-hide_banner','-loglevel','error','-y']
 full_ok=full.exists() and subprocess.run(['ffprobe','-v','error',str(full)],capture_output=True).returncode==0
 if not full_ok:
  subprocess.run(common+['-i',str(source),'-map','0:v:0','-map','0:a:0?','-vf','scale=720:-2,setsar=1','-c:v','libx264','-threads','2','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(full)],check=True)
 preview_ok=preview.exists() and subprocess.run(['ffprobe','-v','error',str(preview)],capture_output=True).returncode==0
 if not preview_ok:
  subprocess.run(common+['-i',str(full),'-t','12','-an','-vf','scale=360:-2,fps=24,setsar=1','-c:v','libx264','-threads','2','-preset','fast','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',str(preview)],check=True)
 if not cover.exists() or cover.stat().st_size==0:
  subprocess.run(common+['-i',str(full),'-ss',('6' if slug=='motion-lancamento-sua-musica' else '3'),'-frames:v','1','-vf','scale=540:-2','-quality','88',str(cover)],check=True)
 assert cover.stat().st_size>0,filename+' produced an empty cover'
 print(title,flush=True)

data_path=dist/'assets/data.js'
data=data_path.read_text()
projects=json.loads(re.search(r'const PROJECTS = (\[.*?\]);',data,re.S)[1])
assets=json.loads(re.search(r'/\* ASSETS_START \*/\s*(\{.*?\})',data,re.S)[1])
new=[]
for filename,slug,title,kind,description in records:
 assets[slug]=f'assets/{slug}.webp'
 new.append(dict(id=slug,category='motion',title=title,asset=slug,type=kind,description=description,video=f'assets/{slug}.mp4',preview=f'assets/{slug}-preview.mp4',demo=False,path=slug+'.html'))
ids={p['id'] for p in new}
projects=[p for p in projects if p['id'] not in ids]
insertion=next(i for i,p in enumerate(projects) if p['category']=='motion')
projects[insertion:insertion]=new
data=re.sub(r'const PROJECTS = \[.*?\];',lambda _: 'const PROJECTS = '+json.dumps(projects,ensure_ascii=False,indent=2)+';',data,flags=re.S)
data=re.sub(r'/\* ASSETS_START \*/\s*\{.*?\}\s*/\* ASSETS_END \*/',lambda _: '/* ASSETS_START */ '+json.dumps(assets,ensure_ascii=False,indent=2)+' /* ASSETS_END */',data,flags=re.S)
data_path.write_text(data)
print(f'{len(new)} motions included. {len(projects)} projects total.',flush=True)
