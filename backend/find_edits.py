import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for i, line in enumerate(f):
        if "Dashboard.jsx" in line and ("write_to_file" in line or "replace_file_content" in line):
            try:
                data = json.loads(line)
                step = data.get("step_index")
                created = data.get("created_at")
                tool_calls = data.get("tool_calls", [])
                for tc in tool_calls:
                    name = tc.get("name")
                    args = tc.get("args", {})
                    target = args.get("TargetFile", "")
                    desc = args.get("Description", "")
                    summary = args.get("toolSummary", "")
                    print(f"Line {i} | Step {step} | {name} | {target} | {summary} | {desc}")
            except Exception as e:
                pass
