#!/usr/bin/env python3
"""Fail closed on selected publication risks. Prints filenames/categories, never matched values."""
import gzip,json,re,subprocess,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
IGNORE={'.git','node_modules','.venv','__pycache__','.pytest_cache','dist','tmp'}
PATTERNS={
 'personal filesystem path':re.compile(r'/(?:Users|home)/[A-Za-z0-9_.-]+/'),
 'GitHub credential':re.compile(r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
 'AWS access key':re.compile(r'(?:AKIA|ASIA)[A-Z0-9]{16}'),
 'private key':re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
 'service API key':re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}'),
 'personal email address':re.compile(r'[A-Za-z0-9._%+-]+@(?:gmail|yahoo|outlook|hotmail|icloud)\.[A-Za-z.]+'),
 'credential in URL':re.compile(r'https?://[^\s/:]+:[^\s/@]+@'),
}
def candidates():
 result=subprocess.run(['git','ls-files','-z'],cwd=ROOT,capture_output=True)
 if result.returncode==0 and result.stdout:
  return [ROOT/p.decode() for p in result.stdout.split(b'\0') if p]
 return [p for p in ROOT.rglob('*') if p.is_file() and not any(x in IGNORE for x in p.relative_to(ROOT).parts) and not p.is_symlink() and not p.relative_to(ROOT).as_posix().startswith('backend/data/')]
def inspect(paths):
 findings=[]
 for p in paths:
  rel=p.relative_to(ROOT).as_posix()
  if p.is_symlink():findings.append((rel,'symbolic link'));continue
  if p.name=='.secret' or (p.name.startswith('.env') and p.name!='.env.example') or p.suffix in {'.db','.pem','.key','.p12','.pfx','.mp4','.mov'} or rel.startswith('backend/data/'):
   findings.append((rel,'disallowed runtime/private file'))
  raw=p.read_bytes()
  if p.suffix=='.gz':
   try:raw=gzip.decompress(raw)
   except (OSError,EOFError):findings.append((rel,'unreadable gzip'));continue
  text=raw.decode('utf-8',errors='ignore')
  if p.suffix in {'.pptx','.docx','.xlsx'}:
   with zipfile.ZipFile(p) as package:
    text+='\n'.join(package.read(name).decode('utf-8',errors='ignore') for name in package.namelist() if name.endswith(('.xml','.rels')))
  for category,pattern in PATTERNS.items():
   if pattern.search(text):findings.append((rel,category))
 # Explicit privacy contract for the public default data, independent of regex scanning.
 empty=ROOT/'backend/vendor/aiml/latest_patient_states.json'
 if json.loads(empty.read_text())!=[]:findings.append((str(empty.relative_to(ROOT)),'real-person state archive'))
 obs=ROOT/'backend/vendor/engine/data/processed/observed_twin_v1/source_observations.jsonl.gz'
 if gzip.decompress(obs.read_bytes()).strip():findings.append((str(obs.relative_to(ROOT)),'real-person observations'))
 records=ROOT/'backend/vendor/public-data/data/processed/public_now_v1/bidmc_records.json'
 if json.loads(records.read_text())['records']:findings.append((str(records.relative_to(ROOT)),'real-person recordings'))
 archive=json.loads((ROOT/'frontend/public/data/pulmira-archive.json').read_text())
 if archive['sourceStates']:findings.append(('frontend/public/data/pulmira-archive.json','real-person frontend archive'))
 return findings
if __name__=='__main__':
 paths=candidates();findings=inspect(paths)
 print(json.dumps({'files_scanned':len(paths),'findings':[{'path':p,'category':c} for p,c in findings]},indent=2))
 sys.exit(bool(findings))
