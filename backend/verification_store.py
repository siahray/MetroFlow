import random
import string
from datetime import datetime, timedelta

_store = {}

def create_code(email: str) -> str:
    code = ''.join(random.choices(string.digits, k=6))
    _store[email] = {"code": code, "expires": datetime.utcnow() + timedelta(minutes=10)}
    return code

def verify_code(email: str, code: str) -> bool:
    entry = _store.get(email)
    if not entry:
        return False
    if entry["expires"] < datetime.utcnow():
        return False
    if entry["code"] != code:
        return False
    _store.pop(email, None)
    return True
