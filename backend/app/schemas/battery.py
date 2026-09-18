from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class CurrentBatteryState(BaseModel):
    soc: float
    voltage: float
    current_temperature: float
    ambient_temperature: float
    battery_age: float
    charging_cycles: int


class ChargingScenarioResult(BaseModel):
    charging_current: float
    predicted_future_temperature: float
    risk_score: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    main_risk_factors: List[str]


class ChargingSimulationRequest(BaseModel):
    """
    Input schema for the What-If Charging Simulator.
    Takes current battery state and evaluates charging currents [12A, 18A, 25A].
    """
    battery_id: Optional[str] = Field(default="EV001", description="Battery pack ID.")
    soc: float = Field(..., ge=0.0, le=100.0, description="State of Charge (SOC %).")
    voltage: float = Field(..., gt=0.0, description="Pack operating voltage (V).")
    charging_current: Optional[float] = Field(default=18.0, ge=0.0, description="Reference charging current (A).")
    current_temperature: Optional[float] = Field(default=None, ge=-50.0, le=120.0, description="Current measured battery temp (°C).")
    battery_temperature: Optional[float] = Field(default=None, ge=-50.0, le=120.0, description="Alias for current temp (°C).")
    ambient_temperature: float = Field(..., ge=-50.0, le=70.0, description="Ambient temperature (°C).")
    battery_age: float = Field(..., ge=0.0, description="Battery age (months).")
    charging_cycles: int = Field(..., ge=0, description="Cumulative charge cycles.")

    @model_validator(mode="after")
    def resolve_temp(self):
        if self.current_temperature is None and self.battery_temperature is not None:
            self.current_temperature = self.battery_temperature
        elif self.current_temperature is not None and self.battery_temperature is None:
            self.battery_temperature = self.current_temperature
        elif self.current_temperature is None and self.battery_temperature is None:
            self.current_temperature = 25.0
            self.battery_temperature = 25.0
        return self


class ChargingSimulationResponse(BaseModel):
    battery_id: str
    current_battery_state: CurrentBatteryState
    scenarios: List[ChargingScenarioResult]


class RiskAssessmentRequest(BaseModel):
    """
    Input schema for the risk calculation module.
    Takes predicted future temperature plus core battery parameters.
    """
    predicted_future_temperature: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=120.0,
        description="Predicted future battery temperature in °C.",
        examples=[46.5],
    )
    predicted_temperature: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=120.0,
        description="Alias for predicted future temperature in °C.",
        examples=[46.5],
    )
    soc: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="State of Charge (SOC) percentage (0.0% - 100.0%).",
        examples=[85.0],
    )
    charging_current: float = Field(
        ...,
        ge=0.0,
        description="Charging current in Amperes (A).",
        examples=[55.0],
    )
    battery_age: float = Field(
        ...,
        ge=0.0,
        description="Battery age in months.",
        examples=[18.0],
    )
    charging_cycles: int = Field(
        ...,
        ge=0,
        description="Cumulative charging cycles.",
        examples=[450],
    )
    voltage: Optional[float] = Field(
        default=400.0,
        gt=0.0,
        description="Pack operating voltage in Volts (V).",
        examples=[402.0],
    )
    current_temperature: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=120.0,
        description="Current measured battery temperature in °C.",
        examples=[38.0],
    )
    ambient_temperature: Optional[float] = Field(
        default=25.0,
        ge=-50.0,
        le=70.0,
        description="Ambient environmental temperature in °C.",
        examples=[28.0],
    )
    battery_id: Optional[str] = Field(
        default="EV-UNIT-01",
        description="Unique identifier for the battery pack.",
    )

    @model_validator(mode="after")
    def resolve_predicted_temp(self):
        if self.predicted_future_temperature is None and self.predicted_temperature is not None:
            self.predicted_future_temperature = self.predicted_temperature
        elif self.predicted_future_temperature is not None and self.predicted_temperature is None:
            self.predicted_temperature = self.predicted_future_temperature
        elif self.predicted_future_temperature is None and self.predicted_temperature is None:
            temp = self.current_temperature if self.current_temperature is not None else 35.0
            self.predicted_future_temperature = temp
            self.predicted_temperature = temp
        return self


class AlertDispatchDetails(BaseModel):
    alert_id: str
    timestamp: str
    alert_type: str
    alert_status: str
    charging_status: str = Field(..., description="'CONNECTED' or 'SIMULATED DISCONNECT'")
    email_dispatched: bool
    email_recipient: Optional[str] = None
    email_subject: Optional[str] = None
    call_triggered: bool
    call_status: Optional[str] = None
    call_sid: Optional[str] = None
    full_report: Optional[str] = None


class RiskAssessmentResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Computed composite risk score (0 to 100).")
    risk_level: Literal["LOW", "MEDIUM", "HIGH"] = Field(..., description="Classified risk tier: LOW (0-39), MEDIUM (40-69), HIGH (70-100).")
    level: Literal["LOW", "MEDIUM", "HIGH"] = Field(..., description="Alias for risk_level.")
    main_risk_factors: List[str] = Field(..., description="Identified driving risk factors.")
    factors: List[str] = Field(..., description="Alias for main_risk_factors.")
    factor_scores: Dict[str, float] = Field(default_factory=dict, description="Normalized 0-100 sub-scores per component.")
    recommendations: List[str] = Field(default_factory=list, description="Actionable BMS mitigation recommendations.")
    alert_triggered: bool = Field(default=False, description="True if MEDIUM or HIGH risk triggered automatic alert.")
    charging_status: str = Field(default="CONNECTED", description="'CONNECTED' or 'SIMULATED DISCONNECT'.")
    alert_event: Optional[AlertDispatchDetails] = Field(default=None, description="Details of automated alert dispatches.")


class BatteryPredictionRequest(BaseModel):
    battery_id: Optional[str] = Field(
        default="EV-PRED-01",
        description="Optional unique identifier for the battery pack.",
    )
    soc: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="State of Charge (SOC) as a percentage (0.0% to 100.0%).",
        examples=[75.5],
    )
    voltage: float = Field(
        ...,
        gt=0.0,
        description="Battery operating voltage in Volts (V).",
        examples=[400.2],
    )
    charging_current: float = Field(
        ...,
        ge=0.0,
        description="Battery charging current in Amperes (A).",
        examples=[25.0],
    )
    current_temperature: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=120.0,
        description="Current measured battery/cell temperature in °C.",
        examples=[32.5],
    )
    battery_temperature: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=120.0,
        description="Alias for current_temperature in °C.",
        examples=[32.5],
    )
    ambient_temperature: float = Field(
        ...,
        ge=-50.0,
        le=70.0,
        description="Ambient environmental temperature in °C.",
        examples=[25.0],
    )
    battery_age: float = Field(
        ...,
        ge=0.0,
        description="Battery age in months.",
        examples=[12.0],
    )
    charging_cycles: int = Field(
        ...,
        ge=0,
        description="Cumulative charge cycles completed.",
        examples=[350],
    )

    @model_validator(mode="after")
    def populate_temperature_alias(self):
        if self.current_temperature is None and self.battery_temperature is not None:
            self.current_temperature = self.battery_temperature
        elif self.current_temperature is not None and self.battery_temperature is None:
            self.battery_temperature = self.current_temperature
        elif self.current_temperature is None and self.battery_temperature is None:
            raise ValueError("Either 'current_temperature' or 'battery_temperature' must be provided.")
        return self


class BatteryInput(BaseModel):
    battery_id: str = Field(
        ...,
        min_length=1,
        description="Unique identifier for the battery unit or pack (non-empty string).",
        examples=["EV001"],
    )
    soc: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="State of Charge (SOC) as a percentage (0.0% to 100.0%).",
        examples=[75.5],
    )
    voltage: float = Field(
        ...,
        gt=0.0,
        description="Battery pack operating voltage in Volts (V). Must be greater than 0.",
        examples=[400.2],
    )
    charging_current: float = Field(
        ...,
        ge=0.0,
        description="Battery charging current in Amperes (A). Must be greater than or equal to 0.",
        examples=[18.0],
    )
    battery_temperature: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=120.0,
        description="Internal battery/cell temperature in degrees Celsius (°C). Physically valid range [-50°C to 120°C].",
        examples=[32.5],
    )
    current_temperature: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=120.0,
        description="Alias for battery_temperature in degrees Celsius (°C).",
        examples=[32.5],
    )
    ambient_temperature: float = Field(
        ...,
        ge=-50.0,
        le=70.0,
        description="Ambient environmental temperature in degrees Celsius (°C). Physically valid range [-50°C to 70°C].",
        examples=[28.0],
    )
    battery_age: float = Field(
        ...,
        ge=0.0,
        description="Battery age in months. Must be non-negative.",
        examples=[18.0],
    )
    charging_cycles: int = Field(
        ...,
        ge=0,
        description="Total cumulative charging cycles completed. Must be non-negative integer.",
        examples=[450],
    )

    @model_validator(mode="after")
    def resolve_temperature(self):
        if self.battery_temperature is None and self.current_temperature is not None:
            self.battery_temperature = self.current_temperature
        elif self.current_temperature is None and self.battery_temperature is not None:
            self.current_temperature = self.battery_temperature
        elif self.battery_temperature is None and self.current_temperature is None:
            raise ValueError("Either 'battery_temperature' or 'current_temperature' must be provided.")
        return self

    @field_validator("battery_id")
    @classmethod
    def validate_battery_id(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("battery_id cannot be empty or solely whitespace.")
        return trimmed


class BatteryValidationResponse(BaseModel):
    status: str = Field(default="validated")
    message: str = Field(default="Battery data validated successfully.")
    data: BatteryInput


class PredictionResult(BaseModel):
    predicted_future_temperature: float = Field(..., description="Predicted future battery temperature in °C.")
    predicted_temperature: float = Field(..., description="Alias for predicted future temperature in °C.")
    current_temperature: float = Field(..., description="Starting measured battery temperature in °C.")
    temperature_delta: float = Field(..., description="Forecasted temperature change in °C.")
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    thermal_status: Literal["OPTIMAL", "ELEVATED", "CRITICAL"]
    feature_contributions: Dict[str, float] = Field(default_factory=dict)


class RiskFactorBreakdown(BaseModel):
    thermal_risk_score: float = Field(..., ge=0.0, le=100.0)
    thermal_status: Literal["SAFE", "ELEVATED", "CRITICAL"]
    crate_stress_score: float = Field(..., ge=0.0, le=100.0)
    crate_status: Literal["SAFE", "MODERATE", "SEVERE"]
    degradation_score: float = Field(..., ge=0.0, le=100.0)
    soh_percentage: float = Field(..., ge=0.0, le=100.0)
    voltage_stability: Literal["STABLE", "HIGH_VOLTAGE", "VOLTAGE_SAG"]


class RiskAssessment(BaseModel):
    overall_risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    risk_factors: RiskFactorBreakdown
    recommendations: List[str] = Field(default_factory=list)
    alert_triggered: bool
    alert_severity: Optional[Literal["INFO", "WARNING", "CRITICAL"]] = None
    main_risk_factors: List[str] = Field(default_factory=list)
    charging_status: str = Field(default="CONNECTED")
    alert_event: Optional[AlertDispatchDetails] = None


class ComprehensiveAnalysisResponse(BaseModel):
    battery_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    telemetry: BatteryInput
    prediction: PredictionResult
    risk_assessment: RiskAssessment


class SimulationRequest(BaseModel):
    battery_id: str = Field(default="EV-TWIN-01")
    initial_soc: float = Field(default=20.0, ge=0.0, le=100.0)
    pack_voltage: float = Field(default=400.0, gt=0.0)
    charging_current: float = Field(default=45.0, ge=0.0, le=200.0)
    ambient_temperature: float = Field(default=30.0, ge=-30.0, le=60.0)
    battery_age: float = Field(default=12.0, ge=0.0)
    charging_cycles: int = Field(default=350, ge=0)
    duration_minutes: int = Field(default=60, ge=5, le=180)
    time_step_minutes: int = Field(default=2, ge=1, le=10)
    cooling_efficiency: float = Field(default=0.8, ge=0.0, le=1.0)


class SimulationDataPoint(BaseModel):
    time_min: int
    soc: float
    battery_temperature: float
    ambient_temperature: float
    charging_current: float
    cooling_active: bool
    risk_score: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]


class SimulationResponse(BaseModel):
    battery_id: str
    duration_minutes: int
    initial_soc: float
    final_soc: float
    initial_temperature: float
    max_temperature: float
    final_temperature: float
    time_to_80_soc_min: Optional[int] = None
    time_to_thermal_warning_min: Optional[int] = None
    max_risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    cooling_efficiency_applied: float
    timeline: List[SimulationDataPoint]


class AlertAcknowledgeRequest(BaseModel):
    alert_id: str


class AlertSimulateRequest(BaseModel):
    battery_id: str
    severity: Literal["INFO", "WARNING", "CRITICAL"] = "WARNING"
    title: Optional[str] = "Simulated Safety Alert"
    message: Optional[str] = "Simulated high risk condition detected."
    metrics_summary: Dict[str, Any] = Field(default_factory=dict)


class AlertItem(BaseModel):
    id: str
    timestamp: str
    battery_id: str
    severity: Literal["INFO", "WARNING", "CRITICAL"]
    title: str
    message: str
    metrics_summary: Dict[str, float] = Field(default_factory=dict)
    acknowledged: bool = False
    dispatched_channels: List[str] = Field(default_factory=list)
    charging_status: Optional[str] = "CONNECTED"


class AlertHistoryItem(BaseModel):
    id: str
    timestamp: str
    battery_id: str
    predicted_temperature: float
    risk_score: float
    risk_level: str
    alert_type: str
    charging_status: str
    alert_status: Optional[str] = "LOGGED"
    main_risk_factors: List[str] = Field(default_factory=list)
