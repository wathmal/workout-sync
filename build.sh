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

# Idempotent cleanup: nuke any conflicting prior tag so --manifest can
# create a fresh manifest list. `manifest rm` only removes lists; a
# stale single-arch image with the same tag would otherwise cause
# "image is not a manifest list" at push time.
podman manifest rm "${LOCAL_MANIFEST}" 2>/dev/null || true
podman rmi -f "${LOCAL_MANIFEST}" 2>/dev/null || true

# Pre-create the manifest list so `podman build --manifest` adds to it
# instead of silently re-tagging as a single-arch image.
podman manifest create "${LOCAL_MANIFEST}"

echo "→ build  ${LOCAL_MANIFEST}  (${PLATFORMS}, sha=${SHA})"
podman build --platform "${PLATFORMS}" --manifest "${LOCAL_MANIFEST}" .

for TAG in "${VERSION}" "latest" "sha-${SHA}"; do
  echo "→ push   ${REPO}:${TAG}"
  # --all uploads all platform blobs alongside the manifest list.
  # Without it, podman may push only a single arch.
  podman manifest push --all "${LOCAL_MANIFEST}" "docker://${REPO}:${TAG}"
done

echo "✓ done"
