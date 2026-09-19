import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if 1130 <= step <= 1450 and "Dashboard.jsx" in line:
                for tc in data.get("tool_calls", []):
                    if tc.get("name") == "view_file" and "Dashboard.jsx" in tc.get("args", {}).get("AbsolutePath", ""):
                        print(f"Step {step}: lines {tc['args'].get('StartLine')}-{tc['args'].get('EndLine')}")
        except Exception:
            pass
