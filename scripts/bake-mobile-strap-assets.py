"""Encode an offline dress() texture export for the mobile watch.

Input is the JSON downloaded from the authored strap-maps export page. Pixels
come from the same procedural generators as the desktop scene. Color maps keep
256px across the strap; normal/roughness data keep128px and use lossless WebP.
Run: python scripts/bake-mobile-strap-assets.py /path/to/strap-maps.json
"""
from pathlib import Path
import argparse, base64, hashlib, io, json
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('export', type=Path)
parser.add_argument('--output', type=Path, default=Path('textures/straps'))
args=parser.parse_args()
data=json.loads(args.export.read_text())
args.output.mkdir(parents=True, exist_ok=True)
# The same pixels may be referenced by a mirrored lining or a sheen map.
usage={}
for strap in data['straps'].values():
    mats=strap.get('front',[])+strap.get('back',[])+([strap['single']] if 'single' in strap else [])
    for material in mats:
        for role in ['map','normalMap','roughnessMap','sheenColorMap']:
            if role in material:
                usage.setdefault(material[role]['image'],set()).add(role)
index={'version':1, 'resolution':{'colorWidth':256,'dataWidth':128}, 'images':{}, 'straps':data['straps']}
unique=set()
for key,roles in usage.items():
    raw=base64.b64decode(data['images'][key]['png'].split(',',1)[1])
    image=Image.open(io.BytesIO(raw)).convert('RGBA')
    color=bool(roles & {'map','sheenColorMap'})
    width=256 if color else 128
    if image.width > width:
        image=image.resize((width, max(1,round(image.height*width/image.width))),Image.Resampling.LANCZOS)
    encoded=io.BytesIO()
    image.save(encoded,format='WEBP',lossless=not color,quality=90,method=6)
    pixels=encoded.getvalue()
    filename=hashlib.sha256(pixels).hexdigest()[:20]+'.webp'
    (args.output/filename).write_bytes(pixels)
    unique.add(filename)
    index['images'][key]={'src':filename,'width':image.width,'height':image.height}
for old in args.output.glob('*.webp'):
    if old.name not in unique: old.unlink()
(args.output/'manifest.json').write_text(json.dumps(index,separators=(',',':'))+'\n')
print('Unique images:',len(unique))
print('Total image bytes:',sum((args.output/name).stat().st_size for name in unique))
for name,strap in index['straps'].items():
    mats=strap.get('front',[])+strap.get('back',[])+([strap['single']] if 'single' in strap else [])
    paths={index['images'][entry['image']]['src'] for m in mats for field,entry in m.items() if isinstance(entry,dict) and 'image' in entry}
    print(name, 'bytes:',sum((args.output/path).stat().st_size for path in paths))
