"""python -m app.cli {import,create-user,import-traces,convert-traces,openapi}"""
import argparse
import getpass
import json
import os
import sys

from . import auth
from .sources import convert_v2_traces, import_traces
from .store import Store, import_all, iso_now


def main(argv=None):
    parser = argparse.ArgumentParser(prog='python -m app.cli')
    parser.add_argument('--db', default=os.environ.get('PULMIRA_DB', 'data/pulmira.db'))
    sub = parser.add_subparsers(dest='cmd', required=True)
    sub.add_parser('import', help='Import TOLIFE, synthetic example and BIDMC index (idempotent)')
    u = sub.add_parser('create-user', help='Create a login (password read from PULMIRA_PASSWORD or prompt)')
    u.add_argument('username')
    u.add_argument('--role', required=True, choices=sorted(auth.ROLES))
    u.add_argument('--patient-id')
    u.add_argument('--origin', choices=['real_open', 'real_controlled', 'synthetic'])
    t = sub.add_parser('import-traces', help='Import a fictional scenario trace export (CSV or JSONL)')
    t.add_argument('path')
    c = sub.add_parser('convert-traces', help="Filter Member 2's synthetic_copd_v2 exports into a bounded trace sample")
    c.add_argument('src_dir', help='.../data/processed/synthetic_copd_v2 from the AI/ML project')
    c.add_argument('--provenance', default='vendor/aiml/synthetic_copd_v2_provenance.json')
    c.add_argument('--profiles', type=int, default=25)
    c.add_argument('--out', default='vendor/aiml/synthetic_copd_v2_traces_sample.csv.gz')
    o = sub.add_parser('openapi', help='Write the OpenAPI document')
    o.add_argument('--out', default='docs/openapi.json')
    args = parser.parse_args(argv)

    if args.cmd == 'openapi':
        from .main import create_app
        spec = create_app(db_path=':memory:', secret='openapi', auto_import=False).openapi()
        with open(args.out, 'w') as f:
            json.dump(spec, f, indent=2)
        print(f'wrote {args.out}')
        return
    if args.cmd == 'convert-traces':
        result = convert_v2_traces(args.src_dir, args.provenance, args.out, args.profiles)
        print(json.dumps({k: v for k, v in result.items() if k != 'profiles'} | {'profile_count': len(result['profiles'])}))
        return
    os.makedirs(os.path.dirname(os.path.abspath(args.db)), exist_ok=True)
    store = Store(args.db)
    if args.cmd == 'import':
        import_all(store)
        print(json.dumps(store.counts()))
    elif args.cmd == 'create-user':
        if args.role == 'patient' and not (args.patient_id and args.origin):
            sys.exit('patient users need --patient-id and --origin')
        if args.role == 'patient' and store.patient(args.patient_id, args.origin) is None:
            sys.exit('unknown patient/origin')
        if args.role == 'ingest' and not args.origin:
            sys.exit('ingest users need --origin')
        password = os.environ.get('PULMIRA_PASSWORD') or getpass.getpass('Password: ')
        if len(password) < 10:
            sys.exit('password must be at least 10 characters')
        with store.tx() as db:
            db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)', (args.username, args.role, args.patient_id,
                                                                   args.origin, auth.hash_password(password), iso_now()))
        print(f'created {args.role} {args.username}')
    elif args.cmd == 'import-traces':
        print(f'imported {import_traces(store, args.path)} trace rows')


if __name__ == '__main__':
    main()
