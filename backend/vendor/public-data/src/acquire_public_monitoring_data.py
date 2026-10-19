"""Acquire a small, public, checksum-verified subset; execute no downloaded code."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request

PROJECT = Path(__file__).resolve().parents[1]
BASE = 'https://physionet.org/files/bidmc/1.0.0/'


def fetch(url: str, limit: int = 8_000_000) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'Pulmira-public-data-audit/1.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Download exceeds declared size limit')
    return data


def save_verified(path: Path, data: bytes, digest: str | None = None, algorithm: str = 'sha256') -> None:
    if digest is not None and hashlib.new(algorithm, data).hexdigest() != digest:
        raise ValueError(f'Published checksum mismatch: {path.name}')
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise FileExistsError(f'Refusing to replace different bytes: {path}')
    else:
        path.write_bytes(data)


def acquire_bidmc() -> dict:
    root = PROJECT / 'data/raw/public_now_v1/bidmc_1.0.0'
    sums = fetch(BASE + 'SHA256SUMS.txt')
    save_verified(root / 'SHA256SUMS.txt', sums)
    published = {}
    for line in sums.decode().splitlines():
        digest, name = line.split(maxsplit=1)
        published[name.lstrip('*').removeprefix('./')] = digest
    names = ['LICENSE', 'README', 'RECORDS']
    for i in range(1, 54):
        names += [f'bidmc_csv/bidmc_{i:02d}_Numerics.csv',
                  f'bidmc_csv/bidmc_{i:02d}_Breaths.csv', f'bidmc{i:02d}n.hea']

    def one(name: str) -> tuple[str, dict]:
        digest = published[name]
        path = root / name
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == digest:
            data = path.read_bytes()
        else:
            data = fetch(BASE + name)
        save_verified(path, data, digest)
        return name, {'url': BASE + name, 'bytes': len(data), 'sha256': digest,
                      'published_sha256_verified': True}

    with ThreadPoolExecutor(max_workers=4) as pool:
        files = dict(pool.map(one, names))
    result = {'source': 'https://physionet.org/content/bidmc/1.0.0/',
              'license': 'Open Data Commons Attribution License v1.0',
              'acquired_subset': 'All 53 numeric series, breath annotations and numeric headers; no waveforms',
              'acquired_files': files, 'checksum_index_sha256': hashlib.sha256(sums).hexdigest(),
              'downloaded_bytes': sum(x['bytes'] for x in files.values()) + len(sums)}
    (root / 'acquisition.json').write_text(json.dumps(result, indent=2) + '\n')
    return {'source': 'BIDMC', 'files': len(files), 'bytes': result['downloaded_bytes']}


def acquire_ppg() -> dict:
    root = PROJECT / 'data/raw/public_now_v1/copd_ppg_18109876'
    metadata_path = root / 'record_metadata.json'
    metadata = metadata_path.read_bytes() if metadata_path.exists() else fetch('https://zenodo.org/api/records/18109876')
    record = json.loads(metadata)
    root.mkdir(parents=True, exist_ok=True)
    # Record the exact publication metadata used for this acquisition.
    save_verified(root / 'record_metadata.json', metadata)
    item = next(x for x in record['files'] if x['key'] == '128s_db.zip')
    if item['size'] > 8_000_000:
        raise ValueError('Unexpected archive size')
    algorithm, digest = item['checksum'].split(':', 1)
    path = root / item['key']
    data = path.read_bytes() if path.exists() else fetch(item['links']['self'])
    if len(data) != item['size']:
        raise ValueError('Published byte count mismatch')
    save_verified(path, data, digest, algorithm)
    result = {'source': 'https://zenodo.org/records/18109876', 'title': record['metadata']['title'],
              'license': record['metadata']['license']['id'], 'subset': item['key'],
              'bytes': len(data), 'published_checksum': item['checksum'],
              'published_checksum_verified': True, 'sha256': hashlib.sha256(data).hexdigest(),
              'url': item['links']['self'], 'downloaded_code_executed': False}
    (root / 'acquisition.json').write_text(json.dumps(result, indent=2) + '\n')
    return {'source': 'COPD PPG screening', 'files': 1, 'bytes': len(data)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', choices=['bidmc', 'ppg', 'both'], default='both')
    args = parser.parse_args()
    if args.source in ('bidmc', 'both'):
        print(json.dumps(acquire_bidmc()), flush=True)
    if args.source in ('ppg', 'both'):
        print(json.dumps(acquire_ppg()), flush=True)
