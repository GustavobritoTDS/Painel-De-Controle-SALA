#!/usr/bin/env python3
"""Pede ao Ollama local uma revisão do diff. Não altera arquivos nem envia dados à internet."""
from __future__ import annotations

import json
import subprocess
import sys
from urllib.error import URLError
from urllib.request import Request, urlopen

MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen2.5-coder:3b"
diff = subprocess.run(["git", "diff", "--cached"], capture_output=True, text=True, check=True).stdout
if not diff:
    diff = subprocess.run(["git", "diff"], capture_output=True, text=True, check=True).stdout
if not diff:
    raise SystemExit("Não há alterações para revisar.")

prompt = """Revise este diff de um projeto web. Responda em português, de forma curta. Procure bugs, regressões, exposição de segredos e falhas de autenticação/Supabase. Não proponha deploy e não peça chaves. Diff:\n\n""" + diff[:120_000]
payload = json.dumps({"model": MODEL, "prompt": prompt, "stream": False}).encode()
request = Request("http://127.0.0.1:11434/api/generate", data=payload, headers={"Content-Type": "application/json"})
try:
    with urlopen(request, timeout=180) as response:
        print(json.load(response)["response"])
except URLError as error:
    raise SystemExit(f"Ollama local indisponível: {error}. Instale/inicie o Ollama e baixe o modelo '{MODEL}'.")
