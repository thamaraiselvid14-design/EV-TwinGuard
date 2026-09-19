import json
import re

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

content_506 = None
content_510 = None

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if step == 506:
                content_506 = data.get("content", "")
            elif step == 510:
                content_510 = data.get("content", "")
        except Exception:
            pass

def clean_view_file_output(text):
    # Remove header metadata lines
    lines = text.split("\n")
    code_lines = []
    for line in lines:
        # Check if line matches "<number>: <code line>"
        m = re.match(r"^\s*(\d+):\s?(.*)$", line)
        if m:
            code_lines.append((int(m.group(1)), m.group(2)))
    return code_lines

lines_506 = clean_view_file_output(content_506)
lines_510 = clean_view_file_output(content_510)

print(f"506 has lines: {lines_506[0][0]} to {lines_506[-1][0]} (total {len(lines_506)})")
print(f"510 has lines: {lines_510[0][0]} to {lines_510[-1][0]} (total {len(lines_510)})")

# Merge them by line number
merged = {}
for lnum, lcode in lines_506:
    merged[lnum] = lcode
for lnum, lcode in lines_510:
    merged[lnum] = lcode

max_line = max(merged.keys())
full_code = []
for i in range(1, max_line + 1):
    full_code.append(merged.get(i, ""))

full_text = "\n".join(full_code)

with open(r"c:\Users\AdminTE\Documents\EV TwinGuard\backend\pre794_Dashboard.jsx", "w", encoding="utf-8") as out:
    out.write(full_text)

print(f"Saved pre-794 Dashboard.jsx ({len(full_code)} lines)")
