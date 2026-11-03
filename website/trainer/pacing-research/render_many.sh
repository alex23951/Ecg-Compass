#!/bin/bash
# usage: render_many.sh SOURCE IDFILE OUTDIR
cd "$(dirname "$0")"
xargs -a "$2" -P 3 -I{} sh -c 'python3 render.py '"$1"' {} '"$3"' 2>&1 | tail -1'
