#!/usr/bin/env python3
"""One-time interactive Garmin login → prints GARMIN_TOKEN_B64.

Run this once, off-box (laptop / `docker exec`):

    pip install garminconnect
    python3 scripts/garmin/bootstrap.py

It prompts for email + password (+ MFA code if 2FA is on), exchanges them for
OAuth1/OAuth2 tokens, then packs the token store into a base64 string and prints
it. Paste that string into the container's GARMIN_TOKEN_B64 env var — no mounted
volume, no token file on the server. The password is never stored and never needed
again; fetch.py reuses the token and auto-refreshes it. Re-run only if the token
is revoked / expires (~yearly).

Env (optional, to skip prompts): GARMIN_EMAIL, GARMIN_PASSWORD.
"""
import base64
import getpass
import io
import os
import sys
import tarfile
import tempfile


def main() -> int:
    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ")
    password = os.environ.get("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")

    from garminconnect import Garmin

    tokenstore = tempfile.mkdtemp(prefix="garmin-bootstrap-")
    client = Garmin(email, password, prompt_mfa=lambda: input("MFA code: "))
    client.login(tokenstore)

    # Pack the whole token dir (layout-agnostic) → gzip → base64.
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(tokenstore, arcname=".")
    token_b64 = base64.b64encode(buf.getvalue()).decode()

    print("\n=== GARMIN_TOKEN_B64 — copy the single line below into your env ===", file=sys.stderr)
    print(token_b64)
    print("=== end ===", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
