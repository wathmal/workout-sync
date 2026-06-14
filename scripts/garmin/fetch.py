#!/usr/bin/env python3
"""Fetch Garmin activities in a date range and print them as JSON to stdout.

Self-healing auth. The token lives in a container-local dir (GARMIN_TOKEN_DIR,
default /tmp/garmin-token) that survives across runs within a container's life:

  - token valid               -> used directly, no login
  - access expired, refresh ok -> garminconnect DI-refreshes it
  - both dead / dir empty      -> falls back to an email+password login
    (GARMIN_EMAIL / GARMIN_PASSWORD) and re-mints from scratch

After login we client.dump() the (possibly refreshed/rotated/re-minted) token
back to that dir, so the next run reuses it and logins stay rare. The dir is on
the container's writable layer (no mounted volume); it's lost on container
recreate, after which the next run silently re-mints. GARMIN_TOKEN_B64, if set,
seeds the dir on first boot only (optional — credentials alone bootstrap it).

Garmin's DI access token is short-lived (~28h) with a rotating refresh token, so
a read-only env value can NOT self-heal — hence the writeback. 2FA is expected
OFF; if Garmin ever demands an MFA code we fail loud (see _no_mfa).

The parent Node process (lib/agenda/garmin.ts) parses stdout, so stdout MUST be
clean JSON — all library chatter is forced to stderr (the Python analogue of
scripts/agent-tools/_silence.ts).

Usage: python3 fetch.py --since=YYYY-MM-DD --until=YYYY-MM-DD
"""
import argparse
import base64
import contextlib
import io
import json
import logging
import os
import sys
import tarfile

logging.basicConfig(stream=sys.stderr, level=logging.WARNING)

DEFAULT_TOKEN_DIR = "/tmp/garmin-token"
TOKEN_FILE = "garmin_tokens.json"


def _no_mfa() -> str:
    """2FA is expected OFF on this account. If Garmin ever prompts for an MFA
    code we cannot supply one unattended — fail loud rather than hang."""
    raise RuntimeError(
        "Garmin demanded an MFA code, but 2FA is expected off and no code source "
        "is configured. Disable 2FA, or wire a TOTP secret (pyotp) into prompt_mfa."
    )


def seed_token_dir(token_dir: str) -> None:
    """One-time migration aid: if the token dir has no token yet but
    GARMIN_TOKEN_B64 is set, materialise that value into the dir so an existing
    valid token keeps working without a fresh login. No-op once a token exists.

    The value is base64 of either a tar(.gz) of the token dir or a single combined
    JSON token file (same formats scripts/garmin/bootstrap.py emits)."""
    if os.path.exists(os.path.join(token_dir, TOKEN_FILE)):
        return
    b64 = os.environ.get("GARMIN_TOKEN_B64")
    if not b64:
        return

    raw = base64.b64decode(b64.strip())
    is_gzip = raw[:2] == b"\x1f\x8b"
    is_tar = len(raw) > 262 and raw[257:262] == b"ustar"
    if is_gzip or is_tar:
        with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
            tar.extractall(token_dir)  # noqa: S202 — our own token archive
    else:
        # Otherwise treat the bytes as a single combined JSON token file.
        with open(os.path.join(token_dir, TOKEN_FILE), "wb") as f:
            f.write(raw)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", required=True, help="start date YYYY-MM-DD")
    parser.add_argument("--until", required=True, help="end date YYYY-MM-DD (inclusive)")
    args = parser.parse_args()

    token_dir = os.environ.get("GARMIN_TOKEN_DIR") or DEFAULT_TOKEN_DIR
    os.makedirs(token_dir, exist_ok=True)
    seed_token_dir(token_dir)

    # Keep stdout clean: send any login/library prints to stderr while we work,
    # restore it only for the final JSON emit.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        from garminconnect import Garmin

        # Credentials (optional) unlock garminconnect's built-in auto-relogin when
        # the cached token is dead. Absent -> token-only behaviour (legacy).
        client = Garmin(
            os.environ.get("GARMIN_EMAIL") or None,
            os.environ.get("GARMIN_PASSWORD") or None,
            prompt_mfa=_no_mfa,
        )
        client.login(token_dir)  # loads + DI-refreshes, or credential-logins
        # Persist the (refreshed / rotated / re-minted) token for the next run.
        # garminconnect does not auto-dump after a proactive DI refresh.
        with contextlib.suppress(Exception):
            client.dump(token_dir)
        activities = client.get_activities_by_date(args.since, args.until)
    except Exception as err:  # noqa: BLE001 — surface any failure on stderr, fail the process
        sys.stdout = real_stdout
        print(f"garmin fetch failed: {err}", file=sys.stderr)
        return 1
    finally:
        sys.stdout = real_stdout

    out = []
    for a in activities or []:
        gmt = a.get("startTimeGMT")
        # Garmin returns GMT as "YYYY-MM-DD HH:MM:SS" (no tz) — make it an explicit UTC instant.
        start = (gmt.replace(" ", "T") + "Z") if gmt else a.get("startTimeLocal")
        duration = a.get("duration")
        distance = a.get("distance")
        out.append(
            {
                "garminId": str(a.get("activityId")),
                "startTime": start,
                "activityType": ((a.get("activityType") or {}).get("typeKey") or "unknown"),
                "name": a.get("activityName"),
                "durationS": int(duration) if duration is not None else None,
                "distanceM": int(distance) if distance is not None else None,
            }
        )

    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
