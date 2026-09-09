from __future__ import annotations

import os
import shlex
import sys

import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

COMMANDS = [
    ("service", "systemctl status sepath-api --no-pager -l"),
    ("logs", "journalctl -u sepath-api -n 80 --no-pager"),
    (
        "env-sanitized",
        r"""python3 - <<'PY'
from pathlib import Path
env = {}
for line in Path('/etc/sepath/sepath-api.env').read_text(encoding='utf-8', errors='replace').splitlines():
    if not line or line.lstrip().startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    env[key.strip()] = value.strip()
for key in ['SEPATH_DEPLOY_ENV', 'SEPATH_PRIVACY_MODE', 'SEPATH_ALLOWED_ORIGINS', 'LLM_BASE_URL', 'LLM_MODEL']:
    print(f'{key}={env.get(key, "")}')
secret = env.get('LLM_API_KEY', '')
print(f'LLM_API_KEY_SET={bool(secret)}')
print(f'LLM_API_KEY_LENGTH={len(secret)}')
print(f'SEPATH_AUTH_SECRET_SET={bool(env.get("SEPATH_AUTH_SECRET", ""))}')
print(f'SEPATH_TEACHER_ACCESS_CODE_SET={bool(env.get("SEPATH_TEACHER_ACCESS_CODE", ""))}')
PY""",
    ),
    ("api-dir", "ls -la /opt/sepath/api && ls -la /opt/sepath/api/cloud | tail -n 20"),
    ("package", "cat /opt/sepath/api/package.json"),
    ("ports", "ss -ltnp | grep -E ':80|:8787' || true"),
]


def main() -> int:
    password = os.environ.get("SEPATH_SSH_PASSWORD")
    if not password:
        print("SEPATH_SSH_PASSWORD is required", file=sys.stderr)
        return 1
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("212.129.243.63", username="ubuntu", password=password, timeout=20, banner_timeout=20, auth_timeout=20)
    try:
        for label, command in COMMANDS:
            full = "sudo -S -p '' bash -lc " + shlex.quote(command)
            stdin, stdout, stderr = ssh.exec_command(full, get_pty=False, timeout=60)
            stdin.write(password + "\n")
            stdin.flush()
            out = stdout.read().decode("utf-8", "replace")
            err = stderr.read().decode("utf-8", "replace")
            code = stdout.channel.recv_exit_status()
            print(f"--- {label} code={code}")
            print(out[-5000:])
            if err.strip():
                print("ERR:")
                print(err[-5000:])
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
