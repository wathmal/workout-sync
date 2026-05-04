#!/bin/bash
# Build + push container image (linux/arm64 only).
# Tags: <version> from package.json, latest, sha-<short>.
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
SHA=$(git rev-parse --short HEAD)
LOCAL_TAG="workout-sync:${VERSION}"
REPO="docker.io/wathmal/workout-sync"
PLATFORM="linux/arm64"

echo "→ build  ${LOCAL_TAG}  (${PLATFORM}, sha=${SHA})"
podman buildx build --platform "${PLATFORM}" -t "${LOCAL_TAG}" .

for TAG in "${VERSION}" "latest" "sha-${SHA}"; do
  echo "→ tag    ${REPO}:${TAG}"
  podman tag "${LOCAL_TAG}" "${REPO}:${TAG}"
done

for TAG in "${VERSION}" "latest" "sha-${SHA}"; do
  echo "→ push   ${REPO}:${TAG}"
  podman push "${REPO}:${TAG}"
done

echo "✓ done"
