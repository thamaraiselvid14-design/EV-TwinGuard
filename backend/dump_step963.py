import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if step == 963:
                for tc in data.get("tool_calls", []):
                    code = tc.get("args", {}).get("CodeContent")
                    if code:
                        with open(r"c:\Users\AdminTE\Documents\EV TwinGuard\backend\step963_OwnerCustomerView.jsx", "w", encoding="utf-8") as out:
                            out.write(code)
                        print("Saved step963_OwnerCustomerView.jsx, length:", len(code))
        except Exception:
            pass
