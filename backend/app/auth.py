"""Bearer tokens (HMAC-signed, stdlib), scrypt password hashes and role checks.

Roles:
  clinician  read every patient/recording/scenario; acknowledge notices; ingest only origins in `ingest_origins`
  patient    read and submit diaries for exactly one bound patient + origin
  ingest     service account: POST observations for its bound origin only
Demo sessions (PULMIRA_DEMO_MODE=1) mint clinician tokens limited to synthetic ingestion, and patient tokens
for synthetic patients only. A role selector in the frontend is not access control; these checks are.
"""
import base64
import hashlib
import hmac
import json
import os
import time
import uuid

ROLES = {'clinician', 'patient', 'ingest'}


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _unb64(text):
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def issue(secret, claims, ttl_seconds):
    body = {**claims, 'sid': uuid.uuid4().hex, 'exp': int(time.time()) + ttl_seconds}
    payload = _b64(json.dumps(body, separators=(',', ':')).encode())
    return payload + '.' + _b64(hmac.new(secret, payload.encode(), hashlib.sha256).digest()), body


def verify(secret, token):
    """Returns claims or None."""
    try:
        payload, sig = token.split('.')
        if not hmac.compare_digest(_unb64(sig), hmac.new(secret, payload.encode(), hashlib.sha256).digest()):
            return None
        claims = json.loads(_unb64(payload))
    except (ValueError, json.JSONDecodeError):
        return None
    return claims if claims.get('exp', 0) > time.time() and claims.get('role') in ROLES else None


def hash_password(password):
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f'scrypt${salt.hex()}${digest.hex()}'


def check_password(password, stored):
    try:
        _, salt, digest = stored.split('$')
    except ValueError:
        return False
    test = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(test.hex(), digest)


def can_read_patient(claims, patient_id, origin):
    if claims['role'] == 'clinician':
        return origin in claims.get('read_origins', [])
    return claims['role'] == 'patient' and claims.get('patient_id') == patient_id and claims.get('data_origin') == origin


def can_ingest(claims, origin):
    return claims['role'] in ('clinician', 'ingest') and origin in claims.get('ingest_origins', [])
