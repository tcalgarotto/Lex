#!/usr/bin/env python3
"""Atualiza workflow Lex no SQLite do n8n (substitui nós Postgres por HTTP Lex)."""
import json
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

WF_ID = "c4e8f2a1-9b3d-4f6e-a7c2-1d5e8b9f0a3c"
CONTAINER = "n8n-n8n-1"
N8N_VOLUME = "n8n_n8n_data"
ROOT = Path(__file__).resolve().parents[1]
WF_JSON = ROOT / "workflows" / "n8n" / "lex-case-secretary.json"
DB_TMP = Path("/home/thales/n8n-lex-push.db")
DB_LIVE = Path("/home/thales/n8n-lex.db")


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=check)


def pull_db_from_volume() -> None:
    run(["docker", "stop", CONTAINER], check=False)
    run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{N8N_VOLUME}:/data",
            "-v",
            f"{DB_LIVE.parent}:/host",
            "alpine",
            "sh",
            "-c",
            "cp /data/database.sqlite /host/n8n-lex.db && rm -f /data/database.sqlite-wal /data/database.sqlite-shm",
        ],
    )


def push_db_to_volume() -> None:
    run(["docker", "stop", CONTAINER], check=False)
    run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{N8N_VOLUME}:/data",
            "-v",
            f"{DB_LIVE.parent}:/host",
            "alpine",
            "sh",
            "-c",
            "cp /host/n8n-lex.db /data/database.sqlite && chown 1000:1000 /data/database.sqlite && chmod 664 /data/database.sqlite && rm -f /data/database.sqlite-wal /data/database.sqlite-shm /data/crash.journal",
        ],
    )
    run(["docker", "start", CONTAINER], check=False)


def main() -> int:
    if not WF_JSON.exists():
        print(f"Arquivo não encontrado: {WF_JSON}", file=sys.stderr)
        return 1

    wf = json.loads(WF_JSON.read_text(encoding="utf-8"))
    wf["active"] = True

    nodes = json.dumps(wf["nodes"], ensure_ascii=False)
    connections = json.dumps(wf["connections"], ensure_ascii=False)
    settings = json.dumps(wf.get("settings") or {}, ensure_ascii=False)
    name = wf.get("name", "Lex — Secretária por Caso (Staff Adv)")

    pull_db_from_volume()
    shutil.copy(DB_LIVE, DB_TMP)

    con = sqlite3.connect(DB_TMP)
    cur = con.cursor()
    row = cur.execute(
        "SELECT versionId, activeVersionId FROM workflow_entity WHERE id = ?",
        (WF_ID,),
    ).fetchone()
    if not row:
        print("Workflow não encontrado no banco n8n", file=sys.stderr)
        return 1
    version_id, active_version_id = row

    cur.execute(
        """
        UPDATE workflow_entity
        SET name = ?, active = 1, nodes = ?, connections = ?, settings = ?,
            activeVersionId = ?, versionId = ?
        WHERE id = ?
        """,
        (name, nodes, connections, settings, active_version_id or version_id, version_id, WF_ID),
    )

    cur.execute(
        """
        UPDATE workflow_history
        SET name = ?, nodes = ?, connections = ?
        WHERE workflowId = ?
        """,
        (name, nodes, connections, WF_ID),
    )
    updated = cur.rowcount
    integrity = cur.execute("PRAGMA integrity_check").fetchone()[0]
    con.commit()
    con.close()

    if integrity != "ok":
        print("ERRO: banco n8n corrompido após update", file=sys.stderr)
        return 1

    shutil.copy(DB_TMP, DB_LIVE)
    push_db_to_volume()

    print(f"OK: {updated} revisões atualizadas, sem nós PG, active=true.")
    print("Webhook produção: POST http://127.0.0.1:5678/webhook/lex-case-secretary")
    print("Não use GET nem /webhook-test/ no browser.")
    print("n8n reiniciado — aguarde ~10s e abra http://127.0.0.1:5678")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
