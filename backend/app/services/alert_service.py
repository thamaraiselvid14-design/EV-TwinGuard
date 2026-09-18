from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.schemas.battery import (
    AlertAcknowledgeRequest,
    AlertDispatchDetails,
    AlertHistoryItem,
    AlertItem,
    AlertSimulateRequest,
    BatteryInput,
    RiskAssessment,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
)

logger = logging.getLogger("ev_twinguard.alert_service")

# Database file location
DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_PATH = DB_DIR / "alerts.db"


class AlertService:
    _instance: Optional["AlertService"] = None

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self._init_database()

    @classmethod
    def get_instance(cls) -> "AlertService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_connection(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        """
        Initializes the SQLite database schema and seeds initial records if empty.
        """
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS alert_events (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    battery_id TEXT NOT NULL,
                    risk_score REAL NOT NULL,
                    risk_level TEXT NOT NULL,
                    predicted_temperature REAL NOT NULL,
                    current_temperature REAL NOT NULL,
                    soc REAL NOT NULL,
                    charging_current REAL NOT NULL,
                    voltage REAL NOT NULL,
                    battery_age REAL NOT NULL,
                    charging_cycles INTEGER NOT NULL,
                    main_risk_factors TEXT NOT NULL,
                    recommended_action TEXT NOT NULL,
                    alert_type TEXT NOT NULL,
                    alert_status TEXT NOT NULL,
                    charging_status TEXT NOT NULL,
                    email_sent INTEGER NOT NULL,
                    call_triggered INTEGER NOT NULL,
                    full_report TEXT NOT NULL,
                    acknowledged INTEGER NOT NULL DEFAULT 0
                )
            """)

            # Seed demo records if empty
            cur = conn.execute("SELECT COUNT(*) as count FROM alert_events")
            row = cur.fetchone()
            if row and row["count"] == 0:
                now = datetime.now(timezone.utc).isoformat()
                conn.execute("""
                    INSERT INTO alert_events (
                        id, timestamp, battery_id, risk_score, risk_level,
                        predicted_temperature, current_temperature, soc, charging_current,
                        voltage, battery_age, charging_cycles, main_risk_factors,
                        recommended_action, alert_type, alert_status, charging_status,
                        email_sent, call_triggered, full_report, acknowledged
                    ) VALUES 
                    (
                        'ALT-INIT-001', ?, 'EV-DEMO-04', 58.5, 'MEDIUM',
                        46.8, 42.0, 82.0, 55.0, 405.0, 14.0, 420,
                        '["Elevated future battery temperature", "High State of Charge (SOC > 80%)"]',
                        '["Monitor temperature rise slope and enable active cooling fans."]',
                        'EMAIL_REPORT', 'ELEVATED_MONITORING', 'CONNECTED',
                        1, 0, 'Demo Report for EV-DEMO-04', 0
                    ),
                    (
                        'ALT-INIT-002', ?, 'EV-FLEET-12', 78.0, 'HIGH',
                        55.2, 51.0, 91.0, 70.0, 416.0, 36.0, 1100,
                        '["Critical thermal runaway risk (>50°C)", "High charging current", "High cycle wear"]',
                        '["CRITICAL: SIMULATED DISCONNECT executed. Charging contactor tripped."]',
                        'EMERGENCY_DISPATCH_AND_CALL', 'CRITICAL_ACTION_REQUIRED', 'SIMULATED DISCONNECT',
                        1, 1, 'Emergency Report for EV-FLEET-12', 0
                    )
                """, (now, now))
            conn.commit()

    def generate_battery_report_text(
        self,
        battery_id: str,
        timestamp: str,
        predicted_temp: float,
        current_temp: float,
        soc: float,
        voltage: float,
        charging_current: float,
        ambient_temp: float,
        battery_age: float,
        charging_cycles: int,
        risk_score: float,
        risk_level: str,
        main_risk_factors: List[str],
        recommendations: List[str],
        alert_status: str,
        charging_status: str,
    ) -> str:
        """
        Builds a comprehensive, human-readable EV battery analysis report for email dispatch.
        """
        factors_str = "\n".join([f"  - {f}" for f in main_risk_factors])
        recs_str = "\n".join([f"  - {r}" for r in recommendations])

        report = f"""======================================================================
EV TWINGUARD: BATTERY HEALTH & SAFETY ALERT REPORT
======================================================================
Report Generated:    {timestamp}
Battery ID:          {battery_id}
Safety Risk Level:   {risk_level} (Score: {risk_score}/100)
Alert Status:        {alert_status}
Pack State:          {charging_status}

--- 1. PHYSICAL TELEMETRY PARAMETERS ---
State of Charge (SOC):      {soc:.1f} %
Operating Voltage:          {voltage:.1f} V
Charging Current:           {charging_current:.1f} A
Current Measured Temp:      {current_temp:.1f} °C
Ambient Environmental Temp: {ambient_temp:.1f} °C
Battery Age:                {battery_age:.1f} Months
Cumulative Charge Cycles:   {charging_cycles}

--- 2. AI THERMAL PREDICTION ---
Predicted Future Temp:      {predicted_temp:.1f} °C (Horizon: +15 min continuous)

--- 3. MAIN RISK DRIVING FACTORS ---
{factors_str}

--- 4. BMS RECOMMENDED MITIGATION ACTIONS ---
{recs_str}

======================================================================
EV TwinGuard AI Safety Platform &bull; Automated Telemetry Monitoring
======================================================================
"""
        return report

    def send_email_alert(
        self,
        recipient: str,
        subject: str,
        body_text: str,
    ) -> Dict[str, Any]:
        """
        Sends email via SMTP if configured, or performs simulated dispatch with logged metadata.
        """
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port_raw = os.getenv("SMTP_PORT", "587")
        smtp_port = int(smtp_port_raw) if smtp_port_raw.isdigit() else 587
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD")

        is_valid_smtp = (
            smtp_host and not smtp_host.startswith("your_") and
            smtp_user and not smtp_user.startswith("your_") and
            smtp_pass and not smtp_pass.startswith("your_")
        )

        if is_valid_smtp:
            try:
                msg = MIMEMultipart()
                msg["From"] = smtp_user
                msg["To"] = recipient
                msg["Subject"] = subject
                msg.attach(MIMEText(body_text, "plain"))

                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)

                logger.info(f"Successfully sent live SMTP email alert to {recipient}")
                return {"status": "SENT_VIA_SMTP", "recipient": recipient, "subject": subject}
            except Exception as e:
                logger.warning(f"SMTP dispatch failed ({e}). Falling back to simulated email dispatch.")

        logger.info(f"[SIMULATED EMAIL DISPATCH] To: {recipient} | Subject: {subject}")
        return {"status": "SIMULATED_SUCCESS", "recipient": recipient, "subject": subject}

    def trigger_twilio_call(
        self,
        battery_id: str,
        risk_score: float,
        predicted_temp: float,
    ) -> Dict[str, Any]:
        """
        Triggers an emergency automated phone call via Twilio (or mocked call service if unconfigured).
        """
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        to_phone = os.getenv("TWILIO_TO_PHONE", "+1-800-555-0199")
        from_phone = os.getenv("TWILIO_FROM_PHONE", "+1-800-555-0100")

        call_message = (
            f"Emergency safety alert from EV TwinGuard. Battery pack {battery_id} has exceeded critical safety thresholds "
            f"with a risk score of {risk_score} out of 100 and predicted future temperature of {predicted_temp:.1f} degrees Celsius. "
            f"Charging has been simulated disconnected. Immediate inspection required."
        )

        is_valid_twilio = (
            account_sid and not account_sid.startswith("your_") and
            auth_token and not auth_token.startswith("your_")
        )

        if is_valid_twilio:
            try:
                import urllib.parse
                import urllib.request
                import base64

                url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"
                twiml = f"<Response><Say voice='Polly.Amy'>{call_message}</Say></Response>"
                data = urllib.parse.urlencode({
                    "To": to_phone,
                    "From": from_phone,
                    "Twiml": twiml,
                }).encode("utf-8")

                req = urllib.request.Request(url, data=data)
                credentials = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("utf-8")
                req.add_header("Authorization", f"Basic {credentials}")

                with urllib.request.urlopen(req, timeout=5) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    call_sid = res_body.get("sid", f"CA_{uuid.uuid4().hex[:12]}")
                    logger.info(f"Initiated real Twilio phone call: {call_sid} to {to_phone}")
                    return {"status": "CALL_INITIATED", "call_sid": call_sid, "to": to_phone, "message": call_message}
            except Exception as e:
                logger.warning(f"Twilio API call failed ({e}). Falling back to simulated phone call.")

        # Simulated Call Dispatch
        sim_sid = f"CA_SIMULATED_{uuid.uuid4().hex[:12].upper()}"
        logger.info(f"[SIMULATED PHONE CALL] Call SID: {sim_sid} | Target: {to_phone} | Audio TTS: '{call_message}'")
        return {
            "status": "SIMULATED_CALL_DISPATCHED",
            "call_sid": sim_sid,
            "to": to_phone,
            "transcript": call_message,
        }

    def handle_risk_assessment_alert(
        self,
        req: RiskAssessmentRequest,
        risk_resp: RiskAssessmentResponse,
    ) -> Optional[AlertDispatchDetails]:
        """
        Executes automatic safety alerting based on the classified risk level:
        - LOW: No alerts.
        - MEDIUM: Dispatches detailed battery analysis email report.
        - HIGH: Dispatches detailed email report + triggers simulated/Twilio phone call + triggers SIMULATED DISCONNECT.
        Logs all alerts to SQLite database.
        """
        if risk_resp.risk_level == "LOW":
            return None

        alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
        timestamp = datetime.now(timezone.utc).isoformat()
        battery_id = req.battery_id or "EV-UNIT-01"
        predicted_temp = float(req.predicted_future_temperature if req.predicted_future_temperature is not None else 35.0)
        current_temp = float(req.current_temperature if req.current_temperature is not None else predicted_temp - 2.0)
        voltage = float(req.voltage or 400.0)
        ambient_temp = float(req.ambient_temperature or 25.0)

        # Determine actions based on risk level
        if risk_resp.risk_level == "HIGH":
            alert_type = "EMERGENCY_DISPATCH_AND_CALL"
            alert_status = "CRITICAL_ACTION_REQUIRED"
            charging_status = "SIMULATED DISCONNECT"
            email_subject = f"[CRITICAL EV ALERT] Battery {battery_id} - Immediate Disconnect (Risk: {risk_resp.risk_score}/100)"
            call_needed = True
        else:
            alert_type = "EMAIL_REPORT"
            alert_status = "ELEVATED_MONITORING"
            charging_status = "CONNECTED"
            email_subject = f"[WARNING ALERT] Battery {battery_id} - Elevated Risk Detected (Risk: {risk_resp.risk_score}/100)"
            call_needed = False

        # Generate full report text
        full_report = self.generate_battery_report_text(
            battery_id=battery_id,
            timestamp=timestamp,
            predicted_temp=predicted_temp,
            current_temp=current_temp,
            soc=req.soc,
            voltage=voltage,
            charging_current=req.charging_current,
            ambient_temp=ambient_temp,
            battery_age=req.battery_age,
            charging_cycles=req.charging_cycles,
            risk_score=risk_resp.risk_score,
            risk_level=risk_resp.risk_level,
            main_risk_factors=risk_resp.main_risk_factors,
            recommendations=risk_resp.recommendations,
            alert_status=alert_status,
            charging_status=charging_status,
        )

        # 1. Send Email Report
        email_recipient = os.getenv("ALERT_EMAIL_RECIPIENT", "safety-alerts@evtwinguard.io")
        email_res = self.send_email_alert(
            recipient=email_recipient,
            subject=email_subject,
            body_text=full_report,
        )

        # 2. Trigger Phone Call (if HIGH)
        call_res = None
        if call_needed:
            call_res = self.trigger_twilio_call(
                battery_id=battery_id,
                risk_score=risk_resp.risk_score,
                predicted_temp=predicted_temp,
            )

        # 3. Log alert event to SQLite database
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO alert_events (
                    id, timestamp, battery_id, risk_score, risk_level,
                    predicted_temperature, current_temperature, soc, charging_current,
                    voltage, battery_age, charging_cycles, main_risk_factors,
                    recommended_action, alert_type, alert_status, charging_status,
                    email_sent, call_triggered, full_report, acknowledged
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                alert_id,
                timestamp,
                battery_id,
                risk_resp.risk_score,
                risk_resp.risk_level,
                predicted_temp,
                current_temp,
                req.soc,
                req.charging_current,
                voltage,
                req.battery_age,
                req.charging_cycles,
                json.dumps(risk_resp.main_risk_factors),
                json.dumps(risk_resp.recommendations),
                alert_type,
                alert_status,
                charging_status,
                1,
                1 if call_needed else 0,
                full_report,
                0,
            ))
            conn.commit()

        logger.info(f"Recorded and dispatched safety alert [{alert_id}] ({alert_type}) for {battery_id}")

        return AlertDispatchDetails(
            alert_id=alert_id,
            timestamp=timestamp,
            alert_type=alert_type,
            alert_status=alert_status,
            charging_status=charging_status,
            email_dispatched=True,
            email_recipient=email_recipient,
            email_subject=email_subject,
            call_triggered=call_needed,
            call_status=call_res.get("status") if call_res else None,
            call_sid=call_res.get("call_sid") if call_res else None,
            full_report=full_report,
        )

    def process_telemetry_risk(self, telemetry: BatteryInput, risk: RiskAssessment) -> Optional[AlertItem]:
        """
        Legacy helper for general background simulation and telemetry streams.
        """
        req = RiskAssessmentRequest(
            battery_id=telemetry.battery_id,
            predicted_future_temperature=telemetry.battery_temperature,
            soc=telemetry.soc,
            charging_current=telemetry.charging_current,
            battery_age=telemetry.battery_age,
            charging_cycles=telemetry.charging_cycles,
            voltage=telemetry.voltage,
            current_temperature=telemetry.battery_temperature,
            ambient_temperature=telemetry.ambient_temperature,
        )
        resp = RiskAssessmentResponse(
            risk_score=risk.overall_risk_score,
            risk_level=risk.risk_level,
            level=risk.risk_level,
            main_risk_factors=risk.main_risk_factors or ["Elevated battery telemetry"],
            factors=risk.main_risk_factors or ["Elevated battery telemetry"],
            recommendations=risk.recommendations,
        )
        dispatch = self.handle_risk_assessment_alert(req, resp)
        if not dispatch:
            return None

        return AlertItem(
            id=dispatch.alert_id,
            timestamp=dispatch.timestamp,
            battery_id=telemetry.battery_id,
            severity="CRITICAL" if risk.risk_level == "HIGH" else "WARNING",
            title=dispatch.email_subject or f"Safety Alert for {telemetry.battery_id}",
            message=f"Risk Score {risk.overall_risk_score}/100. Charging state: {dispatch.charging_status}.",
            metrics_summary={"battery_temperature": telemetry.battery_temperature, "soc": telemetry.soc, "charging_current": telemetry.charging_current},
            acknowledged=False,
            dispatched_channels=["Email Dispatch", "Simulated Phone Call"] if risk.risk_level == "HIGH" else ["Email Dispatch"],
            charging_status=dispatch.charging_status,
        )

    def get_alerts(self, limit: int = 50) -> List[AlertItem]:
        """
        Queries active and historical alerts from SQLite database.
        """
        results: List[AlertItem] = []
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, timestamp, battery_id, risk_score, risk_level,
                       predicted_temperature, charging_status, alert_status,
                       main_risk_factors, acknowledged
                FROM alert_events
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            for row in cursor.fetchall():
                factors = json.loads(row["main_risk_factors"]) if row["main_risk_factors"] else []
                severity = "CRITICAL" if row["risk_level"] == "HIGH" else "WARNING" if row["risk_level"] == "MEDIUM" else "INFO"
                channels = ["Email Dispatch", "Twilio / Phone Call"] if row["risk_level"] == "HIGH" else ["Email Dispatch"]
                results.append(
                    AlertItem(
                        id=row["id"],
                        timestamp=row["timestamp"],
                        battery_id=row["battery_id"],
                        severity=severity,
                        title=f"[{row['risk_level']} Alert] Pack {row['battery_id']}",
                        message=f"Risk: {row['risk_score']}/100 | State: {row['charging_status']}. Factors: {', '.join(factors[:2])}",
                        metrics_summary={"predicted_temperature": row["predicted_temperature"], "risk_score": row["risk_score"]},
                        acknowledged=bool(row["acknowledged"]),
                        dispatched_channels=channels,
                        charging_status=row["charging_status"],
                    )
                )
        return results

    def get_alert_history(self, limit: int = 50) -> List[AlertHistoryItem]:
        """
        Retrieves flattened alert history events from SQLite database.
        """
        results: List[AlertHistoryItem] = []
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, timestamp, battery_id, risk_score, risk_level,
                       predicted_temperature, charging_status, alert_type, alert_status,
                       main_risk_factors
                FROM alert_events
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            for row in cursor.fetchall():
                factors = json.loads(row["main_risk_factors"]) if row["main_risk_factors"] else []
                results.append(
                    AlertHistoryItem(
                        id=row["id"],
                        timestamp=row["timestamp"],
                        battery_id=row["battery_id"],
                        predicted_temperature=row["predicted_temperature"],
                        risk_score=row["risk_score"],
                        risk_level=row["risk_level"],
                        alert_type=row["alert_type"],
                        charging_status=row["charging_status"],
                        alert_status=row["alert_status"],
                        main_risk_factors=factors,
                    )
                )
        return results

    def acknowledge_alert(self, alert_id: str) -> bool:
        with self._get_connection() as conn:
            cur = conn.execute("UPDATE alert_events SET acknowledged = 1 WHERE id = ?", (alert_id,))
            conn.commit()
            return cur.rowcount > 0

    def simulate_custom_alert(self, req: AlertSimulateRequest) -> Dict[str, Any]:
        sim_req = RiskAssessmentRequest(
            battery_id=req.battery_id,
            predicted_future_temperature=float(req.metrics_summary.get("battery_temperature", 48.0)),
            soc=float(req.metrics_summary.get("soc", 85.0)),
            charging_current=float(req.metrics_summary.get("charging_current", 50.0)),
            battery_age=12.0,
            charging_cycles=350,
        )
        sim_resp = RiskAssessmentResponse(
            risk_score=78.0 if req.severity == "CRITICAL" else 48.0,
            risk_level="HIGH" if req.severity == "CRITICAL" else "MEDIUM",
            level="HIGH" if req.severity == "CRITICAL" else "MEDIUM",
            main_risk_factors=["High charging current", "Elevated future battery temperature"],
            factors=["High charging current", "Elevated future battery temperature"],
            recommendations=["Initiate active chiller cooling and derate current."],
        )
        dispatch = self.handle_risk_assessment_alert(sim_req, sim_resp)
        return {
            "status": "dispatched",
            "alert": {"id": dispatch.alert_id, "status": dispatch.alert_status},
            "dispatch": dispatch,
        }


def get_alert_service() -> AlertService:
    return AlertService.get_instance()
