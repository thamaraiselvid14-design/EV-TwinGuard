import logging
from typing import Dict, List, Literal, Optional, Tuple, Union
from app.schemas.battery import (
    BatteryInput,
    PredictionResult,
    RiskAssessment,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
    RiskFactorBreakdown,
)

logger = logging.getLogger("ev_twinguard.risk_service")

# ==============================================================================
# CONFIGURABLE TUNABLE CONSTANTS (Weights sum to 1.0)
# ==============================================================================
WEIGHT_TEMPERATURE: float = 0.35
WEIGHT_SOC: float = 0.20
WEIGHT_CHARGING_CURRENT: float = 0.20
WEIGHT_BATTERY_AGE: float = 0.10
WEIGHT_CHARGING_CYCLES: float = 0.15

# --- Risk Classification Thresholds ---
# LOW: 0 <= score <= 39
# MEDIUM: 40 <= score <= 69
# HIGH: 70 <= score <= 100
RISK_THRESHOLD_LOW_MAX: float = 39.0
RISK_THRESHOLD_MEDIUM_MAX: float = 69.0

# --- Individual Component Baseline & Warning Boundaries ---
TEMP_NOMINAL_MAX: float = 35.0
TEMP_ELEVATED_WARN: float = 42.0
TEMP_CRITICAL_RUNAWAY: float = 50.0

SOC_HIGH_THRESHOLD: float = 80.0
CURRENT_HIGH_THRESHOLD: float = 40.0
AGE_HIGH_MONTHS: float = 36.0
CYCLES_HIGH_COUNT: int = 800


class RiskAssessmentService:
    """
    Modular EV Battery Risk Scoring Engine with configurable weights and tunable thresholds.
    Automatically fires email reports on MEDIUM risk and emergency email + phone call + SIMULATED DISCONNECT on HIGH risk.
    """
    def __init__(
        self,
        weight_temp: float = WEIGHT_TEMPERATURE,
        weight_soc: float = WEIGHT_SOC,
        weight_current: float = WEIGHT_CHARGING_CURRENT,
        weight_age: float = WEIGHT_BATTERY_AGE,
        weight_cycles: float = WEIGHT_CHARGING_CYCLES,
        threshold_low_max: float = RISK_THRESHOLD_LOW_MAX,
        threshold_medium_max: float = RISK_THRESHOLD_MEDIUM_MAX,
    ):
        self.w_temp = weight_temp
        self.w_soc = weight_soc
        self.w_current = weight_current
        self.w_age = weight_age
        self.w_cycles = weight_cycles
        self.threshold_low_max = threshold_low_max
        self.threshold_medium_max = threshold_medium_max

    def compute_sub_scores(
        self,
        predicted_temperature: float,
        soc: float,
        charging_current: float,
        battery_age: float,
        charging_cycles: int,
    ) -> Dict[str, float]:
        """
        Computes normalized 0-100 risk sub-scores for each input dimension.
        """
        # 1. Temperature Sub-Score (0-100)
        if predicted_temperature <= TEMP_NOMINAL_MAX:
            temp_sub = max(0.0, (predicted_temperature - 15.0) * 1.5)
        elif predicted_temperature <= TEMP_CRITICAL_RUNAWAY:
            temp_sub = 30.0 + (predicted_temperature - TEMP_NOMINAL_MAX) * 3.5
        else:
            temp_sub = min(100.0, 75.0 + (predicted_temperature - TEMP_CRITICAL_RUNAWAY) * 4.0)
        temp_sub = round(min(100.0, max(0.0, temp_sub)), 1)

        # 2. SOC Sub-Score (0-100)
        if soc <= 70.0:
            soc_sub = (soc / 70.0) * 25.0
        elif soc <= SOC_HIGH_THRESHOLD:
            soc_sub = 25.0 + ((soc - 70.0) / 10.0) * 25.0
        else:
            soc_sub = 50.0 + ((soc - SOC_HIGH_THRESHOLD) / 20.0) * 50.0
        soc_sub = round(min(100.0, max(0.0, soc_sub)), 1)

        # 3. Charging Current Sub-Score (0-100)
        curr_sub = (charging_current / 80.0) * 70.0
        if charging_current > CURRENT_HIGH_THRESHOLD:
            curr_sub += ((charging_current - CURRENT_HIGH_THRESHOLD) / 40.0) * 30.0
        curr_sub = round(min(100.0, max(0.0, curr_sub)), 1)

        # 4. Battery Age Sub-Score (0-100)
        age_sub = (battery_age / 60.0) * 100.0
        age_sub = round(min(100.0, max(0.0, age_sub)), 1)

        # 5. Charging Cycles Sub-Score (0-100)
        cycles_sub = (charging_cycles / 1800.0) * 100.0
        cycles_sub = round(min(100.0, max(0.0, cycles_sub)), 1)

        return {
            "temperature_score": temp_sub,
            "soc_score": soc_sub,
            "charging_current_score": curr_sub,
            "battery_age_score": age_sub,
            "charging_cycles_score": cycles_sub,
        }

    def determine_main_risk_factors(
        self,
        predicted_temperature: float,
        soc: float,
        charging_current: float,
        battery_age: float,
        charging_cycles: int,
        sub_scores: Dict[str, float],
    ) -> List[str]:
        """
        Identifies key physical drivers contributing significantly to the risk score.
        """
        factors: List[str] = []

        if predicted_temperature >= TEMP_CRITICAL_RUNAWAY:
            factors.append("Critical thermal runaway risk (>50°C)")
        elif predicted_temperature >= TEMP_ELEVATED_WARN or sub_scores.get("temperature_score", 0) > 40:
            factors.append("Elevated future battery temperature")

        if soc >= SOC_HIGH_THRESHOLD:
            factors.append("High State of Charge (SOC > 80%)")

        if charging_current >= CURRENT_HIGH_THRESHOLD:
            factors.append("High charging current")

        if charging_cycles >= CYCLES_HIGH_COUNT:
            factors.append("High cycle wear")

        if battery_age >= AGE_HIGH_MONTHS:
            factors.append("Aged battery pack")

        if charging_current > 30.0 and soc > 80.0:
            factors.append("High charging current at saturation SOC")

        if not factors:
            factors.append("All physical parameters within nominal range")

        return factors

    def assess_risk(self, req: RiskAssessmentRequest, trigger_alerts: bool = True) -> RiskAssessmentResponse:
        """
        Executes configurable weighted risk calculation from prediction + input battery parameters.
        Automatically fires alerts and logs to database on MEDIUM and HIGH risk levels.
        """
        from app.services.alert_service import get_alert_service

        pred_temp = float(req.predicted_future_temperature if req.predicted_future_temperature is not None else 30.0)
        soc = float(req.soc)
        curr = float(req.charging_current)
        age = float(req.battery_age)
        cycles = int(req.charging_cycles)

        sub_scores = self.compute_sub_scores(
            predicted_temperature=pred_temp,
            soc=soc,
            charging_current=curr,
            battery_age=age,
            charging_cycles=cycles,
        )

        # Weighted composite risk score
        weighted_score = (
            self.w_temp * sub_scores["temperature_score"] +
            self.w_soc * sub_scores["soc_score"] +
            self.w_current * sub_scores["charging_current_score"] +
            self.w_age * sub_scores["battery_age_score"] +
            self.w_cycles * sub_scores["charging_cycles_score"]
        )

        # Critical thermal excursion multiplier
        if pred_temp >= TEMP_CRITICAL_RUNAWAY:
            weighted_score = max(weighted_score, 72.0 + min(28.0, (pred_temp - TEMP_CRITICAL_RUNAWAY) * 3.5))

        risk_score = round(min(100.0, max(0.0, weighted_score)), 1)

        # Tier classification: LOW (0-39), MEDIUM (40-69), HIGH (70-100)
        if risk_score <= self.threshold_low_max:
            risk_level = "LOW"
            charging_status = "CONNECTED"
            alert_triggered = False
        elif risk_score <= self.threshold_medium_max:
            risk_level = "MEDIUM"
            charging_status = "CONNECTED"
            alert_triggered = True
        else:
            risk_level = "HIGH"
            charging_status = "SIMULATED DISCONNECT"
            alert_triggered = True

        main_factors = self.determine_main_risk_factors(
            predicted_temperature=pred_temp,
            soc=soc,
            charging_current=curr,
            battery_age=age,
            charging_cycles=cycles,
            sub_scores=sub_scores,
        )

        recommendations: List[str] = []
        if risk_level == "HIGH":
            recommendations.append("CRITICAL: SIMULATED DISCONNECT executed. Charging contactor tripped.")
            recommendations.append("URGENT: Initiate maximum liquid chiller cooling loop.")
            recommendations.append("Limit maximum pack charge ceiling to 80% SOC.")
        elif risk_level == "MEDIUM":
            recommendations.append("Elevated risk: Automated full battery report dispatched via email.")
            recommendations.append("Monitor temperature rise slope and enable active cooling fans.")
            if soc > 80.0 and curr > 25.0:
                recommendations.append("Taper charging current to reduce battery polarization heating.")
        else:
            recommendations.append("Nominal operational state. Pack running in optimal efficiency envelope.")

        preliminary_resp = RiskAssessmentResponse(
            risk_score=risk_score,
            risk_level=risk_level,
            level=risk_level,
            main_risk_factors=main_factors,
            factors=main_factors,
            factor_scores=sub_scores,
            recommendations=recommendations,
            alert_triggered=alert_triggered,
            charging_status=charging_status,
        )

        # Automatic Alert Triggering & Logging
        if trigger_alerts and alert_triggered:
            try:
                alert_svc = get_alert_service()
                dispatch_details = alert_svc.handle_risk_assessment_alert(req, preliminary_resp)
                preliminary_resp.alert_event = dispatch_details
            except Exception as e:
                logger.warning(f"Non-blocking alert dispatch error: {e}", exc_info=True)

        return preliminary_resp

    def calculate_risk(
        self,
        telemetry: BatteryInput,
        prediction: Optional[PredictionResult] = None,
    ) -> RiskAssessment:
        """
        Unified compatibility interface used by end-to-end /analyze and simulator workflows.
        """
        pred_temp = prediction.predicted_future_temperature if prediction else telemetry.battery_temperature
        req = RiskAssessmentRequest(
            predicted_future_temperature=pred_temp,
            soc=telemetry.soc,
            charging_current=telemetry.charging_current,
            battery_age=telemetry.battery_age,
            charging_cycles=telemetry.charging_cycles,
            voltage=telemetry.voltage,
            current_temperature=telemetry.battery_temperature,
            ambient_temperature=telemetry.ambient_temperature,
            battery_id=telemetry.battery_id,
        )
        resp = self.assess_risk(req, trigger_alerts=False)

        # Sub-status formatting
        thermal_status = "CRITICAL" if pred_temp >= 50.0 else "ELEVATED" if pred_temp >= 40.0 else "SAFE"
        crate_status = "SEVERE" if telemetry.charging_current > 60.0 else "MODERATE" if telemetry.charging_current > 30.0 else "SAFE"
        soh_pct = round(max(50.0, 100.0 - (telemetry.charging_cycles / 2000.0 * 18.0) - (telemetry.battery_age / 96.0 * 10.0)), 1)
        voltage_stability = "HIGH_VOLTAGE" if telemetry.voltage > 425.0 else "VOLTAGE_SAG" if telemetry.voltage < 340.0 else "STABLE"

        return RiskAssessment(
            overall_risk_score=resp.risk_score,
            risk_level=resp.risk_level,
            risk_factors=RiskFactorBreakdown(
                thermal_risk_score=resp.factor_scores.get("temperature_score", 0.0),
                thermal_status=thermal_status,
                crate_stress_score=resp.factor_scores.get("charging_current_score", 0.0),
                crate_status=crate_status,
                degradation_score=resp.factor_scores.get("charging_cycles_score", 0.0),
                soh_percentage=soh_pct,
                voltage_stability=voltage_stability,
            ),
            recommendations=resp.recommendations,
            alert_triggered=(resp.risk_level in ["MEDIUM", "HIGH"]),
            alert_severity="CRITICAL" if resp.risk_level == "HIGH" else "WARNING" if resp.risk_level == "MEDIUM" else None,
            main_risk_factors=resp.main_risk_factors,
            charging_status=resp.charging_status,
            alert_event=resp.alert_event,
        )


def get_risk_service() -> RiskAssessmentService:
    return RiskAssessmentService()
