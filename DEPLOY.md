# Deploying FocusArc to k3s (single-node VPS)

FocusArc ships as **one container** (Express serves the API *and* the built
frontend). It needs an **always-on pod** (for the 23:59 scheduler) and a
**persistent volume** (for the SQLite DB + Telegram token). The manifests below
encode both, plus the SQLite-safety rule: **1 replica, `Recreate` strategy**.

> Access is **public with no auth** (as chosen). Anyone who reaches the URL can
> read your sessions and change settings. Don't put a real Telegram token on a
> guessable public host you don't trust. Adding auth later = a Traefik basic-auth
> middleware on the Ingress.

## 0. Prerequisites (on the VPS)

```bash
# Install k3s (bundles containerd, Traefik ingress, and the local-path PVC provisioner)
curl -sfL https://get.k3s.io | sh -
# Use kubectl as your user
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown $USER ~/.kube/config
kubectl get nodes        # should show the node Ready
# Docker is only needed to *build* the image:
docker --version
```

## 1. Build the image and load it into k3s

No registry needed on a single node — build with Docker, then import the image
into k3s's containerd:

```bash
# from the repo root (on the VPS, or build elsewhere and scp the tar)
docker build -t focusarc:1.0.0 -t focusarc:latest .

# import into k3s containerd so the cluster can run it
docker save focusarc:1.0.0 | sudo k3s ctr images import -
```

(Building on another machine? `docker save focusarc:1.0.0 | gzip > focusarc.tar.gz`,
`scp` it to the VPS, then `gunzip -c focusarc.tar.gz | sudo k3s ctr images import -`.)

## 2. Deploy

```bash
kubectl apply -f k8s/focusarc.yaml      # namespace, PVC, Deployment, Service

# point the Ingress at your host, then apply it:
#   edit k8s/ingress.yaml -> spec.rules[0].host
#   - your domain:  focusarc.yourdomain.com  (add a DNS A record -> VPS IP)
#   - or no domain: <VPS_IP>.nip.io          (e.g. 203.0.113.7.nip.io)
kubectl apply -f k8s/ingress.yaml

kubectl -n focusarc get pods,svc,ingress
kubectl -n focusarc rollout status deploy/focusarc
```

Visit `http://<your-host>/` → you should land on onboarding.

## 3. Configure the Telegram report

In the app: **Settings → Bot token + Channel ID → Save → Send test report**.
Thereafter the report fires automatically at 23:59 in the timezone you set, on
days with at least one session. Override the time with the `REPORT_TIME` env in
`k8s/focusarc.yaml` if needed.

## 4. Updating to a new version

```bash
docker build -t focusarc:1.0.1 -t focusarc:latest .
docker save focusarc:1.0.1 | sudo k3s ctr images import -
# bump the tag in k8s/focusarc.yaml (image: focusarc:1.0.1) then:
kubectl apply -f k8s/focusarc.yaml
kubectl -n focusarc rollout status deploy/focusarc
```

Using versioned tags (not just `:latest`) makes rollouts deterministic. The DB on
the PVC is untouched by updates.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Pod `ErrImageNeverPull` / `ImagePullBackOff` | Image not imported into containerd. Re-run the `k3s ctr images import` step; tag must match `image:` in the manifest. |
| Pod `Pending` | `kubectl -n focusarc describe pvc focusarc-data` — local-path provisioner binds on first pod schedule. |
| Report never sends | `kubectl -n focusarc logs deploy/focusarc` for `[scheduler]` lines; confirm token/channel saved and a session exists that day; verify the timezone in Settings. |
| Data lost on restart | Ensure the pod mounts the PVC (`/data`) and `DB_PATH=/data/focusarc.db`. |

## Notes

- **Backups:** the entire state is `focusarc.db*` under the PVC. The local-path
  provisioner stores it at `/var/lib/rancher/k3s/storage/<pvc>/` on the node —
  back that file up to keep your streak/history.
- **HTTPS:** to serve over TLS, configure Traefik's ACME resolver in k3s and
  uncomment the TLS annotations in `k8s/ingress.yaml`.
