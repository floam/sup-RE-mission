import base64
import gzip
from pathlib import Path

text = Path('.github/workflows/rewrite-sup-remission-history.yml').read_text()
payload = text.split("<<'EOF'", 1)[1].split('\n          EOF', 1)[0]
payload = ''.join(payload.split())
Path('/tmp/rebuild.py').write_bytes(gzip.decompress(base64.b64decode(payload)))
