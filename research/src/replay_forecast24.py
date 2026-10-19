"""Reproduce locked held-out evaluation in a NEW directory, without fitting or overwriting evidence."""
import argparse,json,math,shutil,subprocess,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def equal(a,b):
    if isinstance(a,dict):return a.keys()==b.keys() and all(equal(a[k],b[k]) for k in a)
    if isinstance(a,list):return len(a)==len(b) and all(equal(x,y) for x,y in zip(a,b))
    if isinstance(a,float):return isinstance(b,(int,float)) and math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-12)
    return a==b

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();out=args.output.resolve()
    if out.exists():raise SystemExit('Output must be a new directory. Existing evidence will not be overwritten.')
    plan=json.loads((ROOT/'config/forecast24_v1.json').read_text())
    paths=list(plan['simulation']['sources_sha256'])+['config/forecast24_v1.json','src/run_forecast24.py','src/forecast24_features.py','src/verify_forecast24.py','models/forecast24_v1/model.json','models/forecast24_v1/baselines.json']
    paths += ['reports/forecast24_v1/'+name for name in ['preregistration_lock.json','model_selection_lock.json','membership.csv']]
    for name in paths:
        destination=out/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,destination)
    subprocess.run([sys.executable,'src/run_forecast24.py','evaluate'],cwd=out,check=True)
    subprocess.run([sys.executable,'src/verify_forecast24.py'],cwd=out,check=True)
    name='reports/forecast24_v1/test_evaluation.json'
    expected=json.loads((ROOT/name).read_text());actual=json.loads((out/name).read_text())
    assert equal(expected,actual),'Replayed evaluation differs from the frozen reference; do not replace it.'
    print('Locked held-out evaluation reproduced without fitting. All reference fields match within 1e-10.')

if __name__=='__main__':main()
