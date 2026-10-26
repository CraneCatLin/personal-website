"""从固定 npm 官方包提取浏览器文件；不运行 npm 安装脚本。"""
import base64
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
LOCK = ROOT / 'scripts/vendor-assets.json'
VERSIONS = {'markdown-it': '15.0.3', 'katex': '0.19.1', 'dompurify': '3.4.17'}


def update():
    packages = []
    for name, version in VERSIONS.items():
        with urllib.request.urlopen(f'https://registry.npmjs.org/{name}/{version}', timeout=30) as response:
            metadata = json.load(response)
        dist = metadata['dist']
        if not dist['tarball'].startswith(f'https://registry.npmjs.org/{name}/-/'):
            raise ValueError('包下载地址不属于预期官方 registry')
        with urllib.request.urlopen(dist['tarball'], timeout=45) as response:
            archive = response.read(40 * 1024 * 1024)
        algorithm, digest = dist['integrity'].split('-', 1)
        if algorithm != 'sha512' or base64.b64encode(hashlib.sha512(archive).digest()).decode() != digest:
            raise ValueError(f'{name} 下载完整性校验失败')
        outputs = []
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as package:
            for member in package.getmembers():
                target = None
                if name == 'markdown-it' and member.name == 'package/dist/browser/markdown-it.umd.min.js':
                    target = 'frontend/libs/js/markdown-it.min.js'
                elif name == 'dompurify' and member.name == 'package/dist/purify.min.js':
                    target = 'frontend/libs/js/purify.min.js'
                elif name == 'katex':
                    if member.name == 'package/dist/katex.min.js':
                        target = 'frontend/libs/js/katex.min.js'
                    elif member.name == 'package/dist/katex.min.css':
                        target = 'frontend/libs/katex/katex.min.css'
                    elif member.name.startswith('package/dist/fonts/') and member.isfile():
                        target = 'frontend/libs/katex/fonts/' + Path(member.name).name
                if Path(member.name).parent == Path('package') and Path(member.name).name.lower().startswith('license'):
                    target = f'frontend/libs/licenses/{name}-{Path(member.name).name}'
                if not target:
                    continue
                if not member.isfile():
                    raise ValueError('不允许提取链接或其他特殊条目')
                content = package.extractfile(member).read()
                destination = ROOT / target
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(content)
                outputs.append({'path': target, 'sha256': hashlib.sha256(content).hexdigest()})
        if not outputs:
            raise ValueError(f'{name} 未找到浏览器构建')
        packages.append({'package': name, 'version': version, 'tarball': dist['tarball'],
                         'integrity': dist['integrity'], 'files': outputs})
        print(f'{name}@{version}: {len(outputs)} files', flush=True)
    LOCK.write_text(json.dumps(packages, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def verify():
    packages = json.loads(LOCK.read_text(encoding='utf8'))
    for package in packages:
        for file in package['files']:
            if hashlib.sha256((ROOT / file['path']).read_bytes()).hexdigest() != file['sha256']:
                raise ValueError('浏览器依赖与固定校验记录不一致: ' + file['path'])
    print('Browser assets verified')


if __name__ == '__main__':
    update() if '--update' in sys.argv else verify()
