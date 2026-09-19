import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

dashboard_jsx_1440 = None

# In transcript_full, let's look for any view_file or write_to_file of Dashboard.jsx between step 1000 and 1443
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if 1000 <= step < 1443:
                for tc in data.get("tool_calls", []):
                    if "Dashboard.jsx" in json.dumps(tc):
                        print(f"Step {step}: tool={tc.get('name')}, desc={tc.get('args', {}).get('Description', '')}, summary={tc.get('args', {}).get('toolSummary', '')}")
        except Exception:
            pass
