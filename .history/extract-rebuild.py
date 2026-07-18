import base64
import gzip
import re
from pathlib import Path

text = Path('.github/workflows/rewrite-sup-remission-history.yml').read_text()
match = re.search(r'H4sI[A-Za-z0-9+/=]+', text)
if match is None:
    raise RuntimeError('embedded rebuild payload not found')
Path('/tmp/rebuild.py').write_bytes(gzip.decompress(base64.b64decode(match.group(0))))
