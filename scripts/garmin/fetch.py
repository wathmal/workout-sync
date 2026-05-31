#!/usr/bin/env python3
"""Fetch Garmin activities in a date range and print them as JSON to stdout.

Token-only: loads the cached token from GARMIN_TOKEN_B64 (no password, no MFA). Run
the one-time bootstrap.py first to mint that value. The parent Node process
(lib/agenda/garmin.ts) parses stdout, so stdout MUST be clean JSON — all library
chatter is forced to stderr (the Python analogue of scripts/agent-tools/_silence.ts).

Usage: python3 fetch.py --since=YYYY-MM-DD --until=YYYY-MM-DD
"""
import argparse
import base64
import io
import json
import logging
import os
import sys
import tarfile
import tempfile

logging.basicConfig(stream=sys.stderr, level=logging.WARNING)


def resolve_tokenstore() -> str:
    """Materialise the Garmin token from GARMIN_TOKEN_B64 into a temp dir.

    The token lives entirely in one env var (no mounted volume): base64 of either
    a tar(.gz) of the token dir — preserving whatever file layout the lib uses — or
    a single JSON token file. Decoded into a fresh temp dir each run. Mint the value
    with scripts/garmin/bootstrap.py.
    """
    b64 = os.environ.get("GARMIN_TOKEN_B64")
    if not b64:
        raise RuntimeError("GARMIN_TOKEN_B64 not set — run scripts/garmin/bootstrap.py to mint it")

    raw = base64.b64decode(b64.strip())
    tmp = tempfile.mkdtemp(prefix="garmin-token-")
    is_gzip = raw[:2] == b"\x1f\x8b"
    is_tar = len(raw) > 262 and raw[257:262] == b"ustar"
    if is_gzip or is_tar:
        with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
            tar.extractall(tmp)  # noqa: S202 — our own token archive
        # If the archive wrapped a single subdir, descend into it.
        entries = [os.path.join(tmp, e) for e in os.listdir(tmp)]
        if len(entries) == 1 and os.path.isdir(entries[0]):
            return entries[0]
        return tmp
    # Otherwise treat the bytes as a single combined JSON token file.
    with open(os.path.join(tmp, "garmin_tokens.json"), "wb") as f:
        f.write(raw)
    return tmp


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", required=True, help="start date YYYY-MM-DD")
    parser.add_argument("--until", required=True, help="end date YYYY-MM-DD (inclusive)")
    args = parser.parse_args()

    tokenstore = resolve_tokenstore()

    # Keep stdout clean: send any login/library prints to stderr while we work,
    # restore it only for the final JSON emit.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        from garminconnect import Garmin

        client = Garmin()
        client.login(tokenstore)  # loads + auto-refreshes cached token
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
