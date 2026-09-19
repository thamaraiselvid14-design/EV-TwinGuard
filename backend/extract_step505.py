import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if step in [505, 506, 507, 508, 509, 510]:
                print(f"Step {step} type={data.get('type')}")
                content = data.get("content", "")
                if content:
                    print(f"  Content length: {len(content)}, preview: {content[:150]}...")
        except Exception:
            pass
