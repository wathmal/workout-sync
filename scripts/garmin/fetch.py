#!/usr/bin/env python3
"""Fetch Garmin data and print it as JSON to stdout.

Three modes (selected by flags), all sharing the same self-healing auth:

  --since/--until        activities in a date range (default; agenda pipeline)
  --metrics [--date=D]   one fitness-trend snapshot for day D (default today):
                         VO2max, race predictions, training status, resting HR
  --backfill-rhr=N       resting-HR series for the last N days ending --date
                         (get_stats is per-date historical, so RHR — unlike
                         VO2max/race-pred — CAN be backfilled to seed the chart)

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

The parent Node process (lib/agenda/garmin.ts, lib/fitness/garmin.ts) parses
stdout, so stdout MUST be clean JSON — all library chatter is forced to stderr
(the Python analogue of scripts/agent-tools/_silence.ts). 2FA is expected OFF;
if Garmin ever demands an MFA code we fail loud (see _no_mfa).
"""
import argparse
import base64
import contextlib
import datetime as dt
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


def _safe(fn):
    """Garmin's unofficial endpoints return partial/null blobs and occasionally
    raise (esp. on older watches). Never let one missing metric fail the run —
    log to stderr and return None."""
    try:
        return fn()
    except Exception as err:  # noqa: BLE001
        print(f"garmin metric call failed: {err}", file=sys.stderr)
        return None


def emit_activities(client, since: str, until: str) -> None:
    activities = client.get_activities_by_date(since, until)
    out = []
    for a in activities or []:
        gmt = a.get("startTimeGMT")
        # Garmin returns GMT as "YYYY-MM-DD HH:MM:SS" (no tz) — make it explicit UTC.
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


def emit_metrics(client, cdate: str) -> None:
    """One fitness-trend snapshot for `cdate`. Defensive `.get()` throughout —
    on FR245M many premium metrics return null (see docs/fitness-trends.md)."""
    ts = _safe(lambda: client.get_training_status(cdate)) or {}
    race = _safe(lambda: client.get_race_predictions()) or {}
    stat = _safe(lambda: client.get_stats(cdate)) or {}

    vo2 = ((ts.get("mostRecentVO2Max") or {}).get("generic")) or {}

    # Training status is nested under a per-device map; pick the most recent entry.
    status_map = ((ts.get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData")) or {}
    entry = {}
    if isinstance(status_map, dict) and status_map:
        entries = [e for e in status_map.values() if isinstance(e, dict)]
        if entries:
            entry = sorted(entries, key=lambda e: e.get("calendarDate") or "", reverse=True)[0]

    out = {
        "date": cdate,
        "vo2maxRunning": vo2.get("vo2MaxPreciseValue"),
        "vo2maxComputedDate": vo2.get("calendarDate"),
        "racePred5kS": race.get("time5K"),
        "racePred10kS": race.get("time10K"),
        "racePredHmS": race.get("timeHalfMarathon"),
        "racePredMS": race.get("timeMarathon"),
        "trainingStatusCode": entry.get("trainingStatus"),
        "fitnessTrendCode": entry.get("fitnessTrend"),
        "weeklyLoad": entry.get("weeklyTrainingLoad"),
        "restingHr": stat.get("restingHeartRate"),
        "raw": {"vo2max": ts.get("mostRecentVO2Max"), "racePredictions": race, "statusEntry": entry},
    }
    print(json.dumps(out))


def emit_rhr_backfill(client, n: int, end_cdate: str) -> None:
    """Resting-HR series for the last `n` days ending at `end_cdate`. get_stats is
    per-date historical (cloud-aggregated), so this seeds the RHR sparkline with
    real history on first run — VO2max / race-pred are latest-only and can't."""
    end = dt.date.fromisoformat(end_cdate)
    out = []
    for i in range(n):
        d = (end - dt.timedelta(days=i)).isoformat()
        stat = _safe(lambda d=d: client.get_stats(d)) or {}
        rhr = stat.get("restingHeartRate")
        if rhr is not None:
            out.append({"date": d, "restingHr": rhr})
    print(json.dumps(out))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", help="activities start date YYYY-MM-DD")
    parser.add_argument("--until", help="activities end date YYYY-MM-DD (inclusive)")
    parser.add_argument("--metrics", action="store_true", help="emit a fitness-trend snapshot")
    parser.add_argument("--backfill-rhr", type=int, default=0, help="emit resting-HR series for last N days")
    parser.add_argument("--date", help="reference date YYYY-MM-DD for --metrics/--backfill-rhr (default today)")
    args = parser.parse_args()

    cdate = args.date or dt.date.today().isoformat()
    is_metrics = args.metrics or args.backfill_rhr > 0
    if not is_metrics and not (args.since and args.until):
        parser.error("provide --since and --until, or --metrics, or --backfill-rhr=N")

    token_dir = os.environ.get("GARMIN_TOKEN_DIR") or DEFAULT_TOKEN_DIR
    os.makedirs(token_dir, exist_ok=True)
    seed_token_dir(token_dir)

    # Keep stdout clean: send any login/library prints to stderr while we work,
    # restore it only for the final JSON emit.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        from garminconnect import Garmin

        client = Garmin(
            os.environ.get("GARMIN_EMAIL") or None,
            os.environ.get("GARMIN_PASSWORD") or None,
            prompt_mfa=_no_mfa,
        )
        client.login(token_dir)
        with contextlib.suppress(Exception):
            client.dump(token_dir)

        sys.stdout = real_stdout
        if args.backfill_rhr > 0:
            emit_rhr_backfill(client, args.backfill_rhr, cdate)
        elif args.metrics:
            emit_metrics(client, cdate)
        else:
            emit_activities(client, args.since, args.until)
    except Exception as err:  # noqa: BLE001 — surface any failure on stderr, fail the process
        sys.stdout = real_stdout
        print(f"garmin fetch failed: {err}", file=sys.stderr)
        return 1
    finally:
        sys.stdout = real_stdout

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
