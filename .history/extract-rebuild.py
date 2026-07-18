import base64
import gzip
from pathlib import Path

payload = ''.join(Path('.history/rebuild.py.gz.b64').read_text().split())
Path('/tmp/rebuild.py').write_bytes(gzip.decompress(base64.b64decode(payload)))
