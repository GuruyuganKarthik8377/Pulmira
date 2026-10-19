#!/usr/bin/env python3
"""Build and run the integrated local demo. No cloud service or old ZIP runtime is required."""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

ROOT=Path(__file__).resolve().parent
def select_port(requested=None):
    """Select a free loopback port without disturbing another running project."""
    for candidate in ([requested] if requested is not None else range(8000,8011)):
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as listener:
            try:listener.bind(('127.0.0.1',candidate))
            except OSError:continue
            return candidate
    raise OSError('The requested port is occupied.' if requested is not None else 'Ports 8000–8010 are occupied. Use --port with a free port.')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=None)
    parser.add_argument('--no-browser',action='store_true')
    parser.add_argument('--skip-build',action='store_true')
    args=parser.parse_args()
    if args.port is not None and not 1<=args.port<=65535:parser.error('--port must be between 1 and 65535')
    try:port=select_port(args.port)
    except OSError as exc:print(str(exc),file=sys.stderr);return 1
    if args.port is None and port!=8000:print(f'Port 8000 is already in use. Opening this Pulmira project on port {port}.',flush=True)
    backend=ROOT/'backend';frontend=ROOT/'frontend';python=backend/'.venv/bin/python'
    if not python.exists():
        if shutil.which('uv'):
            subprocess.run(['uv','venv',str(backend/'.venv'),'--python','3.12'],check=True)
            subprocess.run(['uv','pip','install','--python',str(python),'-r',str(backend/'requirements-lock.txt')],check=True)
        else:
            print('Install uv from https://docs.astral.sh/uv/getting-started/installation/ or create backend/.venv with Python 3.12 and install backend/requirements-lock.txt.',file=sys.stderr)
            return 1
    if not (frontend/'node_modules').is_dir():
        subprocess.run(['npm','ci'],cwd=frontend,check=True)
    if not args.skip_build:
        subprocess.run(['npm','run','build'],cwd=frontend,check=True)
    if not (frontend/'dist/index.html').exists():
        print('Frontend build missing. Run without --skip-build.',file=sys.stderr);return 1
    runtime=backend/'data';runtime.mkdir(exist_ok=True)
    secret=runtime/'.secret'
    if not secret.exists():
        descriptor=os.open(secret,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(descriptor,'w') as f:f.write(secrets.token_hex(32))
    env={**os.environ,'PULMIRA_SECRET':secret.read_text().strip(),'PULMIRA_DB':str(runtime/'pulmira.db'),'PULMIRA_FRONTEND_DIST':str(frontend/'dist'),'PULMIRA_DEMO_MODE':'1'}
    url=f'http://127.0.0.1:{port}'
    if not args.no_browser:
        def open_when_ready():
            for _ in range(60):
                try:
                    with urllib.request.urlopen(url+'/api/v1/health',timeout=1) as r:
                        if r.status==200:webbrowser.open(url+'/demo');return
                except Exception:time.sleep(.5)
        threading.Thread(target=open_when_ready,daemon=True).start()
    print(f'Pulmira: {url}/demo\nAPI documentation: {url}/docs\nPress Ctrl+C to stop.',flush=True)
    try:
        return subprocess.call([str(python),'-m','uvicorn','app.main:create_app','--factory','--host','127.0.0.1','--port',str(port),'--workers','1'],cwd=backend,env=env)
    except KeyboardInterrupt:
        return 0
if __name__=='__main__':raise SystemExit(main())
