import json

with open(r"c:\Users\AdminTE\Documents\EV TwinGuard\backend\pre794_Dashboard.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# Also apply the tiny fix at step 531:
# Target: <AIPredictionCard prediction={predictionData} riskAssessment={riskAssessmentData}
# Replace: <AIPredictionCard prediction={predictionData} riskAssessment={riskAssessmentData} batteryData={batteryData}
code = code.replace(
    "<AIPredictionCard\n                prediction={predictionData}\n                riskAssessment={riskAssessmentData}\n                loading={analyzing || loadingNext}",
    "<AIPredictionCard\n                prediction={predictionData}\n                riskAssessment={riskAssessmentData}\n                batteryData={batteryData}\n                loading={analyzing || loadingNext}"
)

with open(r"c:\Users\AdminTE\Documents\EV TwinGuard\backend\patches_1331.json", "r", encoding="utf-8") as f:
    patches = json.load(f)

for step in ["1000", "1004", "1010", "1016", "1134", "1138", "1331"]:
    p = patches[step]
    target = p["TargetContent"]
    replacement = p["ReplacementContent"]
    if target in code:
        code = code.replace(target, replacement, 1)
        print(f"Successfully applied patch step {step}")
    else:
        print(f"FAILED to find target for step {step}!")
        print("Target preview:", target[:100])

with open(r"c:\Users\AdminTE\Documents\EV TwinGuard\backend\reconstructed_pre1443_Dashboard.jsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Saved reconstructed_pre1443_Dashboard.jsx with length:", len(code))
