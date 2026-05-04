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

PRIMARY_TAG="${VERSION}"
echo "→ build+push  ${REPO}:${PRIMARY_TAG}  (${PLATFORMS}, sha=${SHA})"
podman buildx build \
  --platform "${PLATFORMS}" \
  --manifest "${REPO}:${PRIMARY_TAG}" \
  --push \
  .

# Alias under additional tags without rebuilding.
for TAG in "latest" "sha-${SHA}"; do
  echo "→ alias       ${REPO}:${TAG}"
  podman manifest push "${REPO}:${PRIMARY_TAG}" "docker://${REPO}:${TAG}"
done

echo "✓ done"
