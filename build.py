"""Build the site from the repository root.

Cloudflare's build command runs `python3 build.py` from the repo root; the real
build lives in website/build.py (it writes website/dist, which wrangler.jsonc serves).
"""
import runpy
import sys
from pathlib import Path

script = Path(__file__).resolve().parent / "website" / "build.py"
sys.argv[0] = str(script)
runpy.run_path(str(script), run_name="__main__")
