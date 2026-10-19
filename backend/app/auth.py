import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


def load_dotenv_file():
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv_file()

APP_ENV = os.getenv("APP_ENV", "development").lower()
SECRET_KEY = os.getenv("APP_SECRET_KEY", "dev-secret-change-me")
if APP_ENV == "production" and (SECRET_KEY == "dev-secret-change-me" or len(SECRET_KEY) < 32):
    raise RuntimeError("Set APP_SECRET_KEY to a random value of at least 32 characters in production.")
TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "86400"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256$120000${_b64url(salt)}${_b64url(digest)}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        algorithm, rounds, salt_b64, digest_b64 = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = _b64url_decode(salt_b64)
        expected = _b64url_decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(SECRET_KEY.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64url(signature)}"


def decode_access_token(token: str) -> dict:
    try:
        body, signature = token.split(".", 1)
        expected = hmac.new(SECRET_KEY.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(signature), expected):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("expired")
        return payload
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc


def current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    payload = decode_access_token(authorization.split(" ", 1)[1].strip())
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User is inactive or not found")
    return user


def admin_user(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin permission required")
    return user


def verify_google_id_token(credential: str) -> dict:
    query = urllib.parse.urlencode({"id_token": credential})
    url = f"https://oauth2.googleapis.com/tokeninfo?{query}"
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cannot verify Google credential") from exc

    expected_client_id = GOOGLE_CLIENT_ID
    audience = data.get("aud")
    if expected_client_id and audience != expected_client_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google credential audience mismatch")
    if not data.get("email"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google account has no email")
    return data
