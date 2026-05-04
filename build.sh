podman buildx build --platform linux/amd64 -t workout-sync:amd64 .
podman tag workout-sync:amd64 docker.io/wathmal/workout-sync:amd64
podman push docker.io/wathmal/workout-sync:amd64