"""Package source, generated artwork, production build and portable QA evidence."""
from pathlib import Path
import json
import zipfile
import hashlib

root = Path(__file__).resolve().parent.parent
destination = root / 'output' / '纸上浦江-完整交付.zip'
directories = ['src', 'tests', 'scripts', 'public', 'dist', 'art', 'docs', 'output']
single_files = ['README.md', 'THIRD_PARTY_NOTICES.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', '.gitignore', '启动作品.cmd', '开发预览.cmd']
paths = [root / p for p in single_files]
for directory in directories:
    paths.extend(p for p in (root / directory).rglob('*') if p.is_file())
paths = sorted(set(paths))
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in paths:
        if file.suffix == '.zip' or file.name.endswith('-tool-output.txt') or '__pycache__' in file.parts:
            continue
        archive.write(file, Path('纸上浦江') / file.relative_to(root))
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    count = len(archive.infolist())
    assert sum('/art/originals/' in n for n in archive.namelist()) == 19
    assert any(n.endswith('/dist/index.html') for n in archive.namelist())
report = {'file': destination.name, 'bytes': destination.stat().st_size, 'entries': count, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'zip_integrity': 'passed'}
(root / 'output' / 'delivery.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
