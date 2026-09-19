import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if "OwnerDashboard.jsx" in line and ("write_to_file" in line or "replace_file_content" in line):
                for tc in data.get("tool_calls", []):
                    if "OwnerDashboard.jsx" in json.dumps(tc):
                        print(f"OwnerDashboard write at Step {step}: {tc.get('name')}, desc={tc.get('args', {}).get('Description', '')}")
            if "OwnerCustomerView.jsx" in line and ("write_to_file" in line or "replace_file_content" in line):
                for tc in data.get("tool_calls", []):
                    if "OwnerCustomerView.jsx" in json.dumps(tc):
                        print(f"OwnerCustomerView write at Step {step}: {tc.get('name')}, desc={tc.get('args', {}).get('Description', '')}")
        except Exception:
            pass
