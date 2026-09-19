import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("type") == "USER_INPUT":
                print(f"Step {data.get('step_index')}: {data.get('content')[:120]}...")
        except Exception:
            pass
