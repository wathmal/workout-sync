#!/bin/bash
# Build + push multi-arch container image (linux/amd64 for TrueNAS Scale,
# linux/arm64 for Apple Silicon dev). Single manifest, single tag works
# on either arch.
#
# Tags pushed: <version>, latest, sha-<short>
#
# amd64 builds via QEMU emulation on M-series Macs — slow (10-20min).
# Requires `podman login docker.io` first.
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
SHA=$(git rev-parse --short HEAD)
REPO="docker.io/wathmal/workout-sync"
PLATFORMS="linux/amd64,linux/arm64"
LOCAL_MANIFEST="workout-sync:${VERSION}"

# Idempotent: remove stale local manifest before re-building
podman manifest rm "${LOCAL_MANIFEST}" 2>/dev/null || true

echo "→ build  ${LOCAL_MANIFEST}  (${PLATFORMS}, sha=${SHA})"
podman build --platform "${PLATFORMS}" --manifest "${LOCAL_MANIFEST}" .

for TAG in "${VERSION}" "latest" "sha-${SHA}"; do
  echo "→ push   ${REPO}:${TAG}"
  podman manifest push "${LOCAL_MANIFEST}" "docker://${REPO}:${TAG}"
done

echo "✓ done"
