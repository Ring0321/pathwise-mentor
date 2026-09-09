from __future__ import annotations

import argparse
import os
import shlex
import sys
import time
from pathlib import Path

import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def run(ssh: paramiko.SSHClient, command: str, *, sudo_password: str | None = None) -> str:
    if sudo_password is not None:
        command = "sudo -S -p '' bash -lc " + shlex.quote(command)
    stdin, stdout, stderr = ssh.exec_command(command, get_pty=False, timeout=120)
    if sudo_password is not None:
        stdin.write(sudo_password + "\n")
        stdin.flush()
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        print(out)
        print(err, file=sys.stderr)
        fail(f"remote command failed with exit code {code}: {command[:160]}")
    return out


def latest_release_archive() -> Path:
    script_path = Path(__file__).resolve()
    output_roots = [
        script_path.parents[2] / "outputs",
        script_path.parents[3] / "outputs",
    ]
    candidates = sorted(
        [archive for output_root in output_roots for archive in output_root.glob("sepath-tencent-release-*.zip")],
        key=lambda item: item.stat().st_mtime,
    )
    if not candidates:
        roots = ", ".join(str(root) for root in output_roots)
        fail(f"no release archive found under {roots}")
    return candidates[-1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy the SE-Path Tencent server release.")
    parser.add_argument("--host", default=os.environ.get("SEPATH_SSH_HOST", "212.129.243.63"))
    parser.add_argument("--user", default=os.environ.get("SEPATH_SSH_USER", "ubuntu"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("SEPATH_SSH_PORT", "22")))
    parser.add_argument("--archive", default=os.environ.get("SEPATH_RELEASE_ARCHIVE", ""))
    args = parser.parse_args()

    password = os.environ.get("SEPATH_SSH_PASSWORD")
    if not password:
        fail("SEPATH_SSH_PASSWORD is required in the current process environment")

    archive = Path(args.archive).resolve() if args.archive else latest_release_archive()
    if not archive.exists() or archive.suffix.lower() != ".zip":
        fail(f"release archive is not a zip file: {archive}")

    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    remote_zip = f"/tmp/sepath-release-{stamp}.zip"
    remote_dir = f"/tmp/sepath-release-{stamp}"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, port=args.port, username=args.user, password=password, timeout=20, banner_timeout=20, auth_timeout=20)
    try:
        print(f"connected={args.user}@{args.host}")
        print(f"archive={archive}")
        sftp = ssh.open_sftp()
        try:
            sftp.put(str(archive), remote_zip)
        finally:
            sftp.close()
        print(f"uploaded={remote_zip}")

        run(ssh, f"rm -rf {shlex.quote(remote_dir)} && mkdir -p {shlex.quote(remote_dir)} && unzip -oq {shlex.quote(remote_zip)} -d {shlex.quote(remote_dir)}")
        manifest = run(ssh, f"cat {shlex.quote(remote_dir)}/RELEASE_MANIFEST.json")
        print("manifest=ok" if "sepath-tencent-release.v1" in manifest else "manifest=unknown")

        deploy_command = f"""
set -euo pipefail
mkdir -p /opt/sepath/backups /var/www/sepath /opt/sepath/api
if [ -d /var/www/sepath ]; then tar -C /var/www -czf /opt/sepath/backups/sepath-web-{stamp}.tgz sepath; fi
if [ -d /opt/sepath/api ]; then tar -C /opt/sepath -czf /opt/sepath/backups/sepath-api-{stamp}.tgz api; fi
cp -a {shlex.quote(remote_dir)}/web/. /var/www/sepath/
cp -a {shlex.quote(remote_dir)}/api/. /opt/sepath/api/
chown -R www-data:www-data /var/www/sepath /opt/sepath/api
systemctl restart sepath-api
systemctl is-active sepath-api
for attempt in 1 2 3 4 5 6; do
  if curl -sS --max-time 12 http://127.0.0.1:8787/api/health | python3 -m json.tool >/tmp/sepath-health-{stamp}.json; then
    break
  fi
  sleep 1
done
grep -q '/api/agent/conversation' /tmp/sepath-health-{stamp}.json
curl -sS --max-time 12 -I http://127.0.0.1/ >/tmp/sepath-web-{stamp}.headers
"""
        service_state = run(ssh, deploy_command, sudo_password=password)
        print(service_state.strip())
        print(f"remote_health=/tmp/sepath-health-{stamp}.json")
        print(f"remote_web_headers=/tmp/sepath-web-{stamp}.headers")
        run(ssh, f"rm -f {shlex.quote(remote_zip)} && rm -rf {shlex.quote(remote_dir)}")
        print("deploy=ok")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
