import json

log_path = r"C:\Users\AdminTE\.gemini\antigravity-ide\brain\0c7fdd52-0db1-4cc3-9f3f-898ce3d897cb\.system_generated\logs\transcript_full.jsonl"

# Let's inspect step 1449 in transcript_full where listing was done:
# size of Dashboard.jsx at step 1449 was 82075 bytes!
# Let's see if we can find any view_file of Dashboard.jsx between 1330 and 1443, or reconstruct from step 531 + patches:
# Patches were:
# Step 1000: replace_file_content
# Step 1004: replace_file_content
# Step 1010: replace_file_content
# Step 1016: replace_file_content
# Step 1134: replace_file_content
# Step 1138: replace_file_content
# Step 1331: replace_file_content

patch_steps = [1000, 1004, 1010, 1016, 1134, 1138, 1331]
patches = {}

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index", 0)
            if step in patch_steps:
                for tc in data.get("tool_calls", []):
                    patches[step] = tc.get("args", {})
                    print(f"Captured patch at step {step}: StartLine={tc['args'].get('StartLine')}, EndLine={tc['args'].get('EndLine')}")
        except Exception:
            pass

with open(r"c:\Users\AdminTE\Documents\EV TwinGuard\backend\patches_1331.json", "w", encoding="utf-8") as out:
    json.dump(patches, out, indent=2)

print("Saved patches_1331.json")
