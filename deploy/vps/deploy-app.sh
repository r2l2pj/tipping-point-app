#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if (( $# != 1 )) || [[ ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Expected one 40-character main commit SHA." >&2
  exit 2
fi
if (( EUID != 0 )); then
  echo "Run through the fixed root-owned sudo command." >&2
  exit 2
fi

sha="$1"
image="tipping-point-app:$sha"
app=tipping-point-app
candidate=tipping-point-app-candidate
previous=tipping-point-app-previous
host=tippingpoint.l17s.dev
workdir=$(mktemp -d /var/lib/tipping-point-app-deploy/build.XXXXXXXX)
state=untouched
candidate_created=0

cleanup() {
  local rc=$?
  trap - EXIT
  if (( rc != 0 )); then
    if [[ "$state" == renamed || "$state" == new ]]; then
      docker rm -f "$app" >/dev/null 2>&1 || true
      docker rename "$previous" "$app" && docker start "$app" >/dev/null || \
        echo "URGENT: rollback failed; restore $previous manually." >&2
    elif [[ "$state" == stopping ]]; then
      docker start "$app" >/dev/null || \
        echo "URGENT: restart failed; start $app manually." >&2
    fi
  fi
  if (( candidate_created )); then docker rm -f "$candidate" >/dev/null 2>&1 || true; fi
  rm -rf -- "$workdir"
  exit "$rc"
}
trap cleanup EXIT

wait_healthy() {
  local container="$1" status
  for (( i=0; i<45; i++ )); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$container")
    [[ "$status" == healthy ]] && return 0
    [[ "$status" == unhealthy ]] && return 1
    sleep 2
  done
  return 1
}

# Fetch the current main, not code or a path supplied by the SSH caller.
git clone -q --depth 1 --branch main \
  https://github.com/r2l2pj/tipping-point-app.git "$workdir/repo"
if [[ "$(git -C "$workdir/repo" rev-parse HEAD)" != "$sha" ]]; then
  echo "Superseded by a newer main revision; nothing deployed."
  exit 0
fi

docker build -t "$image" "$workdir/repo"
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/.data"}}{{.Name}}{{end}}{{end}}' "$app")" == tipping-point-data ]]
[[ "$(docker inspect -f '{{index .Config.Labels "caddy"}}' tipping-point-route)" == "$host" ]]
[[ "$(docker inspect -f '{{index .Config.Labels "caddy.reverse_proxy"}}' tipping-point-route)" == "$app:3000" ]]
if docker container inspect "$candidate" >/dev/null 2>&1; then
  echo "Candidate name already in use; refusing to remove it." >&2
  exit 1
fi

docker run -d --name "$candidate" --network caddy_proxy --memory 1g \
  --cap-drop ALL --security-opt no-new-privileges "$image" >/dev/null
candidate_created=1
wait_healthy "$candidate"
docker exec "$candidate" node -e \
  "(async()=>{for(const p of ['/api/health','/api/events','/']){const r=await fetch('http://127.0.0.1:3000'+p);if(!r.ok||(p==='/api/health'&&!(await r.json()).ok))process.exit(1)}})().catch(()=>process.exit(1))"
docker rm -f "$candidate" >/dev/null
candidate_created=0

if docker container inspect "$previous" >/dev/null 2>&1; then
  [[ "$(docker inspect -f '{{.State.Status}}' "$previous")" == exited ]]
  [[ "$(docker inspect -f '{{index .Config.Labels "fe.tipping-point.app"}}' "$previous")" == true ]]
  docker rm "$previous" >/dev/null
fi

state=stopping
docker stop -t 20 "$app" >/dev/null
docker rename "$app" "$previous"
state=renamed
docker run -d --name "$app" --network caddy_proxy --memory 1g \
  --restart unless-stopped --label fe.tipping-point.app=true \
  --cap-drop ALL --security-opt no-new-privileges \
  --mount source=tipping-point-data,target=/app/.data "$image" >/dev/null
state=new
wait_healthy "$app"
docker exec "$app" node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))"
for (( i=0; i<5; i++ )); do
  if curl -fsS -o /dev/null "https://$host/api/health" && \
     curl -fsS -o /dev/null "https://$host/"; then
    state=done
    echo "Deployed $sha; the previous container remains stopped for rollback."
    exit 0
  fi
  sleep 2
done
echo "Public health check failed; restoring the previous container." >&2
exit 1
