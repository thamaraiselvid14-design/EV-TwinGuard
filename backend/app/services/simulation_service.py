import logging
from typing import List, Optional
import numpy as np
from app.schemas.battery import (
    BatteryInput,
    BatteryPredictionRequest,
    ChargingScenarioResult,
    ChargingSimulationRequest,
    ChargingSimulationResponse,
    CurrentBatteryState,
    RiskAssessmentRequest,
    SimulationDataPoint,
    SimulationRequest,
    SimulationResponse,
)
from app.services.prediction_service import get_prediction_service
from app.services.risk_service import get_risk_service

logger = logging.getLogger("ev_twinguard.simulation_service")

# Configurable scenario currents
SIMULATION_CURRENTS: List[float] = [12.0, 18.0, 25.0]


class DigitalTwinSimulationService:
    def __init__(self):
        self.prediction_service = get_prediction_service()
        self.risk_service = get_risk_service()

    def simulate_charging_scenarios(
        self,
        req: ChargingSimulationRequest,
    ) -> ChargingSimulationResponse:
        """
        Executes Phase 5 What-If Charging Simulator.
        Evaluates battery behavior under 12A, 18A, and 25A charging currents.
        Reuses the existing prediction model and risk assessment service without duplicating logic.
        """
        current_temp = float(req.current_temperature if req.current_temperature is not None else 25.0)

        current_state = CurrentBatteryState(
            soc=req.soc,
            voltage=req.voltage,
            current_temperature=current_temp,
            ambient_temperature=req.ambient_temperature,
            battery_age=req.battery_age,
            charging_cycles=req.charging_cycles,
        )

        scenarios: List[ChargingScenarioResult] = []

        for current_val in SIMULATION_CURRENTS:
            # 1. Run prediction model with current_val
            pred_req = BatteryPredictionRequest(
                battery_id=req.battery_id or "EV001",
                soc=req.soc,
                voltage=req.voltage,
                charging_current=current_val,
                current_temperature=current_temp,
                ambient_temperature=req.ambient_temperature,
                battery_age=req.battery_age,
                charging_cycles=req.charging_cycles,
            )
            pred_res = self.prediction_service.predict(pred_req)
            predicted_temp = pred_res.predicted_future_temperature

            # 2. Pass predicted temperature into risk assessment service (trigger_alerts=False for what-if scenarios)
            risk_req = RiskAssessmentRequest(
                battery_id=req.battery_id or "EV001",
                predicted_future_temperature=predicted_temp,
                soc=req.soc,
                voltage=req.voltage,
                charging_current=current_val,
                current_temperature=current_temp,
                ambient_temperature=req.ambient_temperature,
                battery_age=req.battery_age,
                charging_cycles=req.charging_cycles,
            )
            risk_res = self.risk_service.assess_risk(risk_req, trigger_alerts=False)

            scenarios.append(
                ChargingScenarioResult(
                    charging_current=current_val,
                    predicted_future_temperature=predicted_temp,
                    risk_score=risk_res.risk_score,
                    risk_level=risk_res.risk_level,
                    main_risk_factors=risk_res.main_risk_factors,
                )
            )

        return ChargingSimulationResponse(
            battery_id=req.battery_id or "EV001",
            current_battery_state=current_state,
            scenarios=scenarios,
        )

    def run_simulation(self, req: SimulationRequest) -> SimulationResponse:
        """
        Executes a physics-informed parametric time-series simulation of EV battery pack charging.
        Simulates electro-thermal dynamics, state of charge trajectory, active cooling, and risk progression.
        """
        timeline: List[SimulationDataPoint] = []
        
        # Nominal pack capacity 75 kWh
        PACK_CAPACITY_KWH = 75.0
        THERMAL_CAPACITY_J_PER_C = 22000.0  # Pack thermal mass heat capacity
        
        current_soc = req.initial_soc
        current_temp = req.ambient_temperature + 2.0  # Initial pack resting temp slightly above ambient
        initial_temp = round(current_temp, 2)
        
        # Degradation-based internal resistance (Ohms)
        r_internal = 0.024 + (req.battery_age / 120.0) * 0.018 + (req.charging_cycles / 2000.0) * 0.025
        
        time_to_80: Optional[int] = None
        time_to_thermal_warn: Optional[int] = None
        max_temp = current_temp
        max_risk_level = "LOW"
        risk_level_rank = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}

        # Step through time
        for t in range(0, req.duration_minutes + 1, req.time_step_minutes):
            dt_min = req.time_step_minutes if t > 0 else 0
            dt_sec = dt_min * 60.0

            # CC-CV Charging current taper as SOC nears 100%
            active_current = req.charging_current
            if current_soc >= 95.0:
                active_current = req.charging_current * 0.15
            elif current_soc >= 85.0:
                active_current = req.charging_current * 0.45
            elif current_soc >= 80.0:
                active_current = req.charging_current * 0.75

            if t > 0:
                # 1. Energy added (kWh) = V * I * dt / 1000
                energy_kwh = (req.pack_voltage * active_current * (dt_min / 60.0)) / 1000.0
                delta_soc = (energy_kwh / PACK_CAPACITY_KWH) * 100.0
                current_soc = min(100.0, current_soc + delta_soc)

                # 2. Thermal Heat Generation (Watts): P_joule = I^2 * R
                joule_heat = (active_current ** 2) * r_internal
                # Polarization heat when charging fast at high SOC
                polarization = ((current_soc - 75.0) * 0.18 * active_current) if current_soc > 75.0 else 0.0
                total_heat_gen = joule_heat + polarization

                # 3. Cooling Dissipation (Watts)
                delta_t_ambient = max(0.0, current_temp - req.ambient_temperature)
                ambient_convection = delta_t_ambient * 45.0
                active_chiller = (req.cooling_efficiency * 1800.0) if current_temp > 32.0 else 0.0
                total_heat_dissipated = ambient_convection + active_chiller

                # 4. Net Temperature Change
                q_net = total_heat_gen - total_heat_dissipated
                delta_temp = (q_net * dt_sec) / THERMAL_CAPACITY_J_PER_C
                current_temp = current_temp + delta_temp
                current_temp = max(req.ambient_temperature - 5.0, min(110.0, current_temp))

            # Track peak metrics
            if current_temp > max_temp:
                max_temp = current_temp

            if time_to_80 is None and current_soc >= 80.0:
                time_to_80 = t

            if time_to_thermal_warn is None and current_temp >= 45.0:
                time_to_thermal_warn = t

            # Instantaneous risk assessment
            step_telemetry = BatteryInput(
                battery_id=req.battery_id,
                soc=round(current_soc, 2),
                voltage=req.pack_voltage,
                charging_current=round(active_current, 2),
                battery_temperature=round(current_temp, 2),
                ambient_temperature=req.ambient_temperature,
                battery_age=req.battery_age,
                charging_cycles=req.charging_cycles,
            )
            step_risk = self.risk_service.calculate_risk(step_telemetry)

            if risk_level_rank[step_risk.risk_level] > risk_level_rank[max_risk_level]:
                max_risk_level = step_risk.risk_level

            timeline.append(
                SimulationDataPoint(
                    time_min=t,
                    soc=round(current_soc, 2),
                    battery_temperature=round(current_temp, 2),
                    ambient_temperature=req.ambient_temperature,
                    charging_current=round(active_current, 2),
                    cooling_active=(req.cooling_efficiency > 0.3 and current_temp > 32.0),
                    risk_score=step_risk.overall_risk_score,
                    risk_level=step_risk.risk_level,
                )
            )

        return SimulationResponse(
            battery_id=req.battery_id,
            duration_minutes=req.duration_minutes,
            initial_soc=req.initial_soc,
            final_soc=round(current_soc, 2),
            initial_temperature=initial_temp,
            max_temperature=round(max_temp, 2),
            final_temperature=round(current_temp, 2),
            time_to_80_soc_min=time_to_80,
            time_to_thermal_warning_min=time_to_thermal_warn,
            max_risk_level=max_risk_level,
            cooling_efficiency_applied=req.cooling_efficiency,
            timeline=timeline,
        )


def get_simulation_service() -> DigitalTwinSimulationService:
    return DigitalTwinSimulationService()
