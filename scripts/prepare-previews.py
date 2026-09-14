"""Create short silent previews; never recompress the full portfolio videos."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,re,subprocess,os,argparse
parser=argparse.ArgumentParser()
parser.add_argument('--exclude')
parser.add_argument('--only')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
dist=root if (root/'assets/data.js').is_file() else root/'dist'
projects=json.loads(re.search(r'const PROJECTS = (\[.*?\]);',(dist/'assets/data.js').read_text(),re.S)[1])
def prepare(p):
 if not p.get('preview') or p['id']==args.exclude or (args.only and p['id']!=args.only):return None
 full=dist/p['video'];preview=dist/p['preview'];temp=preview.with_name(preview.stem+'-temp.mp4')
 before=preview.stat().st_size if preview.exists() else 0
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(full),'-t','6','-an','-vf','scale=360:-2,fps=24,setsar=1','-c:v','libx264','-threads','2','-preset','medium','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',str(temp)],check=True)
 subprocess.run(['ffmpeg','-v','error','-i',str(temp),'-f','null','-'],check=True)
 os.replace(temp,preview)
 print(p['id'],before,'->',preview.stat().st_size,flush=True)
 return {'id':p['id'],'before':before,'after':preview.stat().st_size}
with ThreadPoolExecutor(max_workers=2) as pool:results=[r for r in pool.map(prepare,projects) if r]
print(json.dumps({'previews':len(results),'before':sum(r['before'] for r in results),'after':sum(r['after'] for r in results)}))
