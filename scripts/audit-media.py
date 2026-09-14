"""Probe and decode every local video, and record verifiable delivery properties."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,re,subprocess,struct,argparse
parser=argparse.ArgumentParser();parser.add_argument('--new-prefix');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
dist=root if (root/'assets/data.js').is_file() else root/'dist'
projects=json.loads(re.search(r'const PROJECTS = (\[.*?\]);',(dist/'assets/data.js').read_text(),re.S)[1])
def audit(path):
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]))
 v=next(s for s in probe['streams'] if s['codec_type']=='video')
 result=subprocess.run(['ffmpeg','-v','error','-xerror','-threads','2','-i',str(path),'-f','null','-'],capture_output=True,text=True)
 atoms=[]
 with path.open('rb') as f:
  while True:
   offset=f.tell();header=f.read(8)
   if len(header)!=8:break
   size,kind=struct.unpack('>I4s',header)
   if size==1:size=struct.unpack('>Q',f.read(8))[0]
   if size==0:break
   atoms.append(kind.decode('ascii','replace'));f.seek(offset+size)
 return {'file':str(path.relative_to(dist)),'bytes':path.stat().st_size,'width':v['width'],'height':v['height'],'codec':v['codec_name'],'pixel_format':v['pix_fmt'],'fps':v['avg_frame_rate'],'duration':float(probe['format']['duration']),'audio':any(s['codec_type']=='audio' for s in probe['streams']),'fast_start':'moov' in atoms and 'mdat' in atoms and atoms.index('moov')<atoms.index('mdat'),'decode_ok':result.returncode==0,'errors':result.stderr.strip()}
files=sorted({dist/p[key] for p in projects for key in ['video','preview'] if p.get(key) and not p[key].startswith('https://')})
if args.new_prefix:
 old=json.loads((root/'media-audit.json').read_text())['files'];previous={r['file']:r for r in old};pending=[p for p in files if str(p.relative_to(dist)) not in previous or p.name.startswith(args.new_prefix)]
else:previous={};pending=files
with ThreadPoolExecutor(max_workers=2) as pool:updated=list(pool.map(audit,pending))
previous.update({r['file']:r for r in updated});rows=[previous[str(p.relative_to(dist))] for p in files]
report={'works':len(projects),'drone':sum(p['category']=='drone' for p in projects),'local_files':len(rows),'youtube_embeds':sum(bool(p.get('youtubeId')) for p in projects),'files':rows}
(root/'media-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
errors=[r for r in rows if not r['decode_ok'] or not r['fast_start'] or r['bytes']>25*2**20]
print(json.dumps({'works':len(projects),'files':len(rows),'issues':errors},ensure_ascii=False,indent=2))
assert not errors
