# Tencent CVM Deployment

This release target serves the Vue teacher console through Nginx and proxies
`/api/*` to the local SE-Path Edge API adapter.

## Required Inbound Ports

- TCP 22: SSH deployment access. Prefer limiting source IP to your current IP.
- TCP 80: HTTP access to the teacher console.
- TCP 443: HTTPS after a domain and certificate are attached.

## Server Layout

- Frontend: `/var/www/sepath`
- API runtime: `/opt/sepath/api`
- Runtime data file: `/var/lib/sepath/sepath-edge-store.json`
- Server env file: `/etc/sepath/sepath-api.env`
- Service: `sepath-api`

## Install

After uploading and extracting the release package on Ubuntu:

```bash
cd /tmp/sepath-tencent-release
sudo bash deploy/tencent/install_on_ubuntu.sh "$PWD"
```

Then edit `/etc/sepath/sepath-api.env` and set:

- `LLM_MODEL`
- `LLM_API_KEY`
- optional HMAC secrets for locked production access

Restart after env changes:

```bash
sudo systemctl restart sepath-api
```

## Smoke Check

```bash
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS http://127.0.0.1/
systemctl status sepath-api --no-pager
systemctl status nginx --no-pager
```

Do not place real student identity fields, model keys, webhook secrets, raw logs
or full diffs in the release package.
