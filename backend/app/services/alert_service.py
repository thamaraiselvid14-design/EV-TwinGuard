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
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    vehicle_model TEXT NOT NULL,
                    battery_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS battery_analyses (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    temperature REAL NOT NULL,
                    current REAL NOT NULL,
                    voltage REAL NOT NULL,
                    soc REAL NOT NULL,
                    battery_age REAL NOT NULL,
                    cycles INTEGER NOT NULL,
                    predicted_temperature REAL NOT NULL,
                    risk_value REAL NOT NULL,
                    risk_level TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

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

            # Ensure additional alert_events columns exist for rich escalation tracking
            existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(alert_events)").fetchall()}
            extra_cols = [
                ("analysis_id", "TEXT"),
                ("user_id", "TEXT"),
                ("status", "TEXT DEFAULT 'SENT'"),
                ("message", "TEXT"),
                ("provider_response", "TEXT"),
                ("acknowledged_at", "TEXT"),
                ("acknowledgement_deadline", "TEXT"),
                ("escalated_at", "TEXT"),
                ("created_at", "TEXT"),
                ("sms_sent", "INTEGER DEFAULT 0"),
            ]
            for col_name, col_type in extra_cols:
                if col_name not in existing_cols:
                    try:
                        conn.execute(f"ALTER TABLE alert_events ADD COLUMN {col_name} {col_type}")
                    except Exception as e:
                        logger.warning(f"Could not alter alert_events table for {col_name}: {e}")

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
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        customer_phone: Optional[str] = None,
        vehicle_model: Optional[str] = None,
        acknowledgement_status: Optional[str] = None,
        timeout_escalation_note: Optional[str] = None,
    ) -> str:
        """
        Builds a comprehensive, human-readable EV battery analysis report for email dispatch.
        """
        factors_str = "\n".join([f"  - {f}" for f in main_risk_factors])
        recs_str = "\n".join([f"  - {r}" for r in recommendations])
        ack_str = acknowledgement_status or "Not Acknowledged"
        esc_str = f"\n*** ESCALATION NOTICE: {timeout_escalation_note} ***\n" if timeout_escalation_note else ""

        report = f"""======================================================================
EV TWINGUARD: BATTERY HEALTH & SAFETY ALERT REPORT
======================================================================
Report Generated:       {timestamp}
{esc_str}
--- CUSTOMER & VEHICLE DETAILS ---
Customer Name:          {customer_name or 'Registered EV Customer'}
Customer Email:         {customer_email or 'N/A'}
Customer Mobile:        {customer_phone or 'N/A'}
Vehicle Model:          {vehicle_model or 'Electric Vehicle'}
Battery Pack ID:        {battery_id}

--- SAFETY RISK EVALUATION ---
Safety Risk Level:      {risk_level}
Risk Value / Score:     {risk_score:.1f} / 100
Alert Status:           {alert_status}
Acknowledgement Status: {ack_str}
Contactor Pack State:   {charging_status}

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

--- 3. WHY IS IT {risk_level}? ---
Dynamic Risk Assessment Reason:
{factors_str}

--- 4. BMS RECOMMENDED MITIGATION ACTIONS ---
{recs_str}

======================================================================
EV TwinGuard AI Safety Platform • Automated Telemetry Monitoring
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
        Never logs or exposes the password.
        """
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port_raw = os.getenv("SMTP_PORT", "587")
        smtp_port = int(smtp_port_raw) if smtp_port_raw.isdigit() else 587
        smtp_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD")
        smtp_from = os.getenv("SMTP_FROM_EMAIL") or smtp_user
        smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() in ("true", "1", "yes")

        is_valid_smtp = bool(
            smtp_host and not smtp_host.startswith("your_") and
            smtp_user and not smtp_user.startswith("your_") and
            smtp_pass and not smtp_pass.startswith("your_")
        )

        if is_valid_smtp:
            for attempt in range(2):
                try:
                    msg = MIMEMultipart()
                    msg["From"] = smtp_from
                    msg["To"] = recipient
                    msg["Subject"] = subject
                    msg.attach(MIMEText(body_text, "plain", "utf-8"))

                    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                        if smtp_use_tls:
                            server.starttls()
                        server.login(smtp_user, smtp_pass)
                        server.send_message(msg)

                    logger.info(f"Successfully sent live SMTP email alert to {recipient} via {smtp_host}:{smtp_port}")
                    return {
                        "status": "SENT_VIA_SMTP",
                        "success": True,
                        "recipient": recipient,
                        "subject": subject,
                        "from_email": smtp_from,
                    }
                except Exception as e:
                    logger.warning(f"SMTP dispatch attempt {attempt+1} to {recipient} failed: {e}")
                    if attempt == 0:
                        time.sleep(1)
                    else:
                        logger.error(f"SMTP dispatch to {recipient} failed after retries: {e}")
                        return {
                            "status": "SMTP_FAILED",
                            "success": False,
                            "error": str(e),
                            "recipient": recipient,
                            "subject": subject,
                        }

        logger.info(f"[SIMULATED EMAIL DISPATCH] To: {recipient} | Subject: {subject}")
        return {
            "status": "SIMULATED_SUCCESS",
            "success": False,
            "recipient": recipient,
            "subject": subject,
            "simulated": True,
        }

    def get_email_config_status(self) -> Dict[str, str]:
        """
        Returns safe email configuration status that only reports:
        - SMTP configured: YES/NO
        - Recipient configured: YES/NO
        Never displays or returns the password.
        """
        smtp_host = os.getenv("SMTP_HOST")
        smtp_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD")
        recipient = os.getenv("ALERT_RECIPIENT_EMAIL") or os.getenv("ALERT_EMAIL_RECIPIENT")

        has_smtp = bool(smtp_host and smtp_user and smtp_pass)
        has_recipient = bool(recipient and "@" in recipient and not recipient.startswith("your_"))

        return {
            "smtp_configured": "YES" if has_smtp else "NO",
            "recipient_configured": "YES" if has_recipient else "NO",
        }

    def send_sms_alert(
        self,
        to_phone: str,
        message_text: str,
    ) -> Dict[str, Any]:
        """
        Dispatches emergency SMS alert via Twilio Messages API (or simulated fallback if unconfigured).
        """
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_phone = os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("TWILIO_FROM_PHONE", "+1-800-555-0100")

        is_valid_twilio = bool(
            account_sid and not account_sid.startswith("your_") and
            auth_token and not auth_token.startswith("your_")
        )

        if is_valid_twilio:
            try:
                import urllib.parse
                import urllib.request
                import base64

                url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                data = urllib.parse.urlencode({
                    "To": to_phone,
                    "From": from_phone,
                    "Body": message_text,
                }).encode("utf-8")

                req = urllib.request.Request(url, data=data)
                credentials = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("utf-8")
                req.add_header("Authorization", f"Basic {credentials}")

                with urllib.request.urlopen(req, timeout=5) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    msg_sid = res_body.get("sid", f"SM_{uuid.uuid4().hex[:12]}")
                    logger.info(f"Successfully sent live Twilio SMS: {msg_sid} to {to_phone}")
                    return {"status": "SENT_VIA_TWILIO", "sid": msg_sid, "to": to_phone, "body": message_text}
            except Exception as e:
                logger.warning(f"Twilio SMS API failed ({e}). Falling back to simulated SMS dispatch.")

        sim_sid = f"SM_SIMULATED_{uuid.uuid4().hex[:12].upper()}"
        logger.info(f"[SIMULATED SMS DISPATCH] To: {to_phone} | Body: '{message_text}'")
        return {"status": "SIMULATED_SUCCESS", "sid": sim_sid, "to": to_phone, "body": message_text}

    def trigger_twilio_call(
        self,
        battery_id: str,
        risk_score: float,
        predicted_temp: float,
        to_phone: Optional[str] = None,
        custom_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Triggers an emergency automated phone call via Twilio (or mocked call service if unconfigured).
        """
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        target_phone = to_phone or os.getenv("TWILIO_TO_PHONE", "+1-800-555-0199")
        from_phone = os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("TWILIO_FROM_PHONE", "+1-800-555-0100")

        call_message = custom_message or (
            f"Emergency safety alert from EV TwinGuard. Battery pack {battery_id} has exceeded critical safety thresholds "
            f"with a risk score of {risk_score:.0f} out of 100 and predicted future temperature of {predicted_temp:.1f} degrees Celsius. "
            f"Charging has been simulated disconnected. Immediate inspection required."
        )

        is_valid_twilio = bool(
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
                credentials = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("utf-8")

                try:
                    payload = {"To": target_phone, "From": from_phone, "Twiml": twiml}
                    data = urllib.parse.urlencode(payload).encode("utf-8")
                    req = urllib.request.Request(url, data=data)
                    req.add_header("Authorization", f"Basic {credentials}")
                    with urllib.request.urlopen(req, timeout=10) as response:
                        res_body = json.loads(response.read().decode("utf-8"))
                        call_sid = res_body.get("sid", f"CA_{uuid.uuid4().hex[:12]}")
                        logger.info(f"Initiated real Twilio phone call: {call_sid} to {target_phone}")
                        return {"status": "CALL_INITIATED", "call_sid": call_sid, "to": target_phone, "message": call_message}
                except urllib.error.HTTPError as he:
                    # Fallback for trial parameter access restrictions
                    payload_url = {"To": target_phone, "From": from_phone, "Url": "http://demo.twilio.com/docs/voice.xml"}
                    data_url = urllib.parse.urlencode(payload_url).encode("utf-8")
                    req_url = urllib.request.Request(url, data=data_url)
                    req_url.add_header("Authorization", f"Basic {credentials}")
                    with urllib.request.urlopen(req_url, timeout=10) as response2:
                        res_body2 = json.loads(response2.read().decode("utf-8"))
                        call_sid2 = res_body2.get("sid", f"CA_{uuid.uuid4().hex[:12]}")
                        logger.info(f"Initiated real Twilio phone call via URL: {call_sid2} to {target_phone}")
                        return {"status": "CALL_INITIATED", "call_sid": call_sid2, "to": target_phone, "message": call_message}
            except Exception as e:
                logger.warning(f"Twilio API call failed ({e}). Falling back to simulated phone call.")

        # Simulated Call Dispatch
        sim_sid = f"CA_SIMULATED_{uuid.uuid4().hex[:12].upper()}"
        logger.info(f"[SIMULATED PHONE CALL] Call SID: {sim_sid} | Target: {target_phone} | Audio TTS: '{call_message}'")
        return {
            "status": "SIMULATED_CALL_DISPATCHED",
            "call_sid": sim_sid,
            "to": target_phone,
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
        email_recipient = (
            os.getenv("ALERT_RECIPIENT_EMAIL") or
            os.getenv("ALERT_EMAIL_RECIPIENT") or
            "thamaraiselvid14@gmail.com"
        )
        email_res = self.send_email_alert(
            recipient=email_recipient,
            subject=email_subject,
            body_text=full_report,
        )
        email_delivered = bool(email_res.get("success") or email_res.get("status") == "SENT_VIA_SMTP")

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
                1 if email_delivered else 0,
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
            email_dispatched=email_delivered,
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

        risk.alert_event = dispatch
        risk.charging_status = dispatch.charging_status

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

    def save_battery_analysis(
        self,
        user_id: str,
        temperature: float,
        current: float,
        voltage: float,
        soc: float,
        battery_age: float,
        cycles: int,
        predicted_temperature: float,
        risk_value: float,
        risk_level: str,
    ) -> str:
        analysis_id = f"ANL-{uuid.uuid4().hex[:10].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO battery_analyses (
                    id, user_id, temperature, current, voltage, soc,
                    battery_age, cycles, predicted_temperature, risk_value,
                    risk_level, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                analysis_id, user_id, temperature, current, voltage, soc,
                battery_age, cycles, predicted_temperature, risk_value,
                risk_level, now
            ))
            conn.commit()
        return analysis_id

    def create_customer_alert(
        self,
        analysis_id: str,
        user_id: str,
        battery_id: str,
        risk_score: float,
        risk_level: str,
        predicted_temperature: float,
        current_temperature: float,
        soc: float,
        charging_current: float,
        voltage: float,
        battery_age: float,
        charging_cycles: int,
        main_risk_factors: List[str],
        recommendations: List[str],
        ambient_temperature: float = 25.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Applies strict EV TwinGuard Alert Logic:
        - LOW: Returns None (Dashboard only, no email, no SMS, no call).
        - MEDIUM: Saves alert with status='SENT'. Dispatches Email immediately ALWAYS. No SMS, no Call.
        - HIGH: Saves alert with status='PENDING', sets acknowledgement_deadline = now + 60s.
                Does NOT immediately dispatch SMS or Call or Email (waiting for 60s window).
                Returns alert details with deadline for frontend timer display.
        """
        if risk_level == "LOW":
            return None

        alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()

        # Fetch customer details from users table
        customer = None
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
            if row:
                customer = dict(row)

        customer_name = customer.get("name") if customer else "Registered Customer"
        customer_email = os.getenv("ALERT_RECIPIENT_EMAIL") or (customer.get("email") if customer else "thamaraiselvid14@gmail.com")
        customer_phone = customer.get("phone") if customer else os.getenv("TWILIO_TO_PHONE", "+1-800-555-0199")
        vehicle_model = customer.get("vehicle_model") if customer else "EV Model"

        if risk_level == "MEDIUM":
            alert_type = "EMAIL_REPORT"
            alert_status = "ELEVATED_MONITORING"
            charging_status = "CONNECTED"
            status = "SENT"

            full_report = self.generate_battery_report_text(
                battery_id=battery_id,
                timestamp=now_iso,
                predicted_temp=predicted_temperature,
                current_temp=current_temperature,
                soc=soc,
                voltage=voltage,
                charging_current=charging_current,
                ambient_temp=ambient_temperature,
                battery_age=battery_age,
                charging_cycles=charging_cycles,
                risk_score=risk_score,
                risk_level=risk_level,
                main_risk_factors=main_risk_factors,
                recommendations=recommendations,
                alert_status=alert_status,
                charging_status=charging_status,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                vehicle_model=vehicle_model,
                acknowledgement_status="Awaiting Acknowledgement",
            )

            # MEDIUM: Email ALWAYS sent immediately!
            email_res = self.send_email_alert(
                recipient=customer_email,
                subject=f"[EV TwinGuard MEDIUM ALERT] Pack {battery_id} - Elevated Risk ({risk_score:.1f}/100)",
                body_text=full_report,
            )
            email_delivered = bool(email_res.get("success") or email_res.get("status") == "SENT_VIA_SMTP")
            status = "SENT" if email_delivered else "DELIVERY_FAILED"
            msg = "Medium risk detected. Email report sent to your registered email." if email_delivered else f"Medium risk detected. Email delivery issue: {email_res.get('error', 'SMTP unreachable')}"

            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO alert_events (
                        id, timestamp, battery_id, risk_score, risk_level,
                        predicted_temperature, current_temperature, soc, charging_current,
                        voltage, battery_age, charging_cycles, main_risk_factors,
                        recommended_action, alert_type, alert_status, charging_status,
                        email_sent, call_triggered, full_report, acknowledged,
                        analysis_id, user_id, status, message, created_at, sms_sent
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    alert_id, now_iso, battery_id, risk_score, risk_level,
                    predicted_temperature, current_temperature, soc, charging_current,
                    voltage, battery_age, charging_cycles, json.dumps(main_risk_factors),
                    json.dumps(recommendations), alert_type, alert_status, charging_status,
                    1 if email_delivered else 0, 0, full_report, 0,
                    analysis_id, user_id, status, msg, now_iso, 0
                ))
                conn.commit()

            return {
                "id": alert_id,
                "analysis_id": analysis_id,
                "user_id": user_id,
                "risk_level": "MEDIUM",
                "risk_score": risk_score,
                "status": status,
                "acknowledged": False,
                "email_sent": email_delivered,
                "sms_sent": False,
                "call_triggered": False,
                "created_at": now_iso,
                "acknowledgement_deadline": None,
                "message": msg,
            }

        elif risk_level == "HIGH":
            from datetime import timedelta
            deadline_dt = now_dt + timedelta(seconds=60)
            deadline_iso = deadline_dt.isoformat()

            alert_type = "EMERGENCY_DISPATCH_AND_CALL"
            alert_status = "CRITICAL_ACTION_REQUIRED"
            charging_status = "SIMULATED DISCONNECT"
            status = "PENDING"

            full_report = self.generate_battery_report_text(
                battery_id=battery_id,
                timestamp=now_iso,
                predicted_temp=predicted_temperature,
                current_temp=current_temperature,
                soc=soc,
                voltage=voltage,
                charging_current=charging_current,
                ambient_temp=ambient_temperature,
                battery_age=battery_age,
                charging_cycles=charging_cycles,
                risk_score=risk_score,
                risk_level=risk_level,
                main_risk_factors=main_risk_factors,
                recommendations=recommendations,
                alert_status=alert_status,
                charging_status=charging_status,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                vehicle_model=vehicle_model,
                acknowledgement_status="Pending 60-Second Window",
            )

            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO alert_events (
                        id, timestamp, battery_id, risk_score, risk_level,
                        predicted_temperature, current_temperature, soc, charging_current,
                        voltage, battery_age, charging_cycles, main_risk_factors,
                        recommended_action, alert_type, alert_status, charging_status,
                        email_sent, call_triggered, full_report, acknowledged,
                        analysis_id, user_id, status, message, created_at, acknowledgement_deadline, sms_sent
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    alert_id, now_iso, battery_id, risk_score, risk_level,
                    predicted_temperature, current_temperature, soc, charging_current,
                    voltage, battery_age, charging_cycles, json.dumps(main_risk_factors),
                    json.dumps(recommendations), alert_type, alert_status, charging_status,
                    0, 0, full_report, 0,
                    analysis_id, user_id, status, "High risk detected. 60-second acknowledgement window active.",
                    now_iso, deadline_iso, 0
                ))
                conn.commit()

            return {
                "id": alert_id,
                "analysis_id": analysis_id,
                "user_id": user_id,
                "risk_level": "HIGH",
                "risk_score": risk_score,
                "status": status,
                "acknowledged": False,
                "email_sent": False,
                "sms_sent": False,
                "call_triggered": False,
                "created_at": now_iso,
                "acknowledgement_deadline": deadline_iso,
                "message": "High risk detected! Please acknowledge within 60 seconds.",
            }

        return None

    def acknowledge_customer_alert(self, alert_id: str, user_id: str) -> Dict[str, Any]:
        """
        Customer acknowledges alert.
        - MEDIUM: Updates status to ACKNOWLEDGED. Email has already been sent. No SMS, no Call.
        - HIGH:
          - If acknowledged within deadline / before escalation:
            Cancels escalation, sends Email report to customer. No SMS, no Call.
          - If already escalated: records acknowledgement, leaves escalated notifications intact.
        """
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM alert_events WHERE id = ? AND user_id = ?", (alert_id, user_id))
            alert = cur.fetchone()
            if not alert:
                return {"success": False, "error": "Alert not found or unauthorized"}

            alert_dict = dict(alert)
            if alert_dict.get("acknowledged") == 1:
                return {
                    "success": True,
                    "status": "ALREADY_ACKNOWLEDGED",
                    "message": "Alert was already acknowledged.",
                    "alert": alert_dict,
                }

            risk_level = alert_dict.get("risk_level")
            escalated_at = alert_dict.get("escalated_at")
            is_escalated = alert_dict.get("status") == "ESCALATED" or escalated_at is not None

            # Look up customer
            u_cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            u_row = u_cur.fetchone()
            customer = dict(u_row) if u_row else {}
            customer_email = os.getenv("ALERT_RECIPIENT_EMAIL") or customer.get("email") or "thamaraiselvid14@gmail.com"

            if risk_level == "MEDIUM":
                conn.execute("""
                    UPDATE alert_events
                    SET acknowledged = 1, acknowledged_at = ?, status = 'ACKNOWLEDGED'
                    WHERE id = ?
                """, (now, alert_id))
                conn.commit()
                return {
                    "success": True,
                    "status": "ACKNOWLEDGED",
                    "message": "Alert acknowledged successfully.",
                    "email_sent": bool(alert_dict.get("email_sent")),
                    "sms_sent": False,
                    "call_triggered": False,
                }

            elif risk_level == "HIGH":
                if is_escalated:
                    # Escalation had already occurred
                    conn.execute("""
                        UPDATE alert_events
                        SET acknowledged = 1, acknowledged_at = ?
                        WHERE id = ?
                    """, (now, alert_id))
                    conn.commit()
                    return {
                        "success": True,
                        "status": "ACKNOWLEDGED_POST_ESCALATION",
                        "message": "Alert acknowledged, but 60-second window had expired and emergency escalation already executed.",
                        "email_sent": bool(alert_dict.get("email_sent")),
                        "sms_sent": bool(alert_dict.get("sms_sent")),
                        "call_triggered": bool(alert_dict.get("call_triggered")),
                    }
                else:
                    # Acknowledged in time! Cancel escalation, send Email only
                    factors = json.loads(alert_dict.get("main_risk_factors") or "[]")
                    recs = json.loads(alert_dict.get("recommended_action") or "[]")
                    report_text = self.generate_battery_report_text(
                        battery_id=alert_dict.get("battery_id"),
                        timestamp=now,
                        predicted_temp=float(alert_dict.get("predicted_temperature") or 45.0),
                        current_temp=float(alert_dict.get("current_temperature") or 40.0),
                        soc=float(alert_dict.get("soc") or 80.0),
                        voltage=float(alert_dict.get("voltage") or 400.0),
                        charging_current=float(alert_dict.get("charging_current") or 50.0),
                        ambient_temp=25.0,
                        battery_age=float(alert_dict.get("battery_age") or 12.0),
                        charging_cycles=int(alert_dict.get("charging_cycles") or 300),
                        risk_score=float(alert_dict.get("risk_score") or 75.0),
                        risk_level="HIGH",
                        main_risk_factors=factors,
                        recommendations=recs,
                        alert_status="CRITICAL_ACTION_REQUIRED",
                        charging_status="SIMULATED DISCONNECT",
                        customer_name=customer.get("name"),
                        customer_email=customer_email,
                        customer_phone=customer.get("phone"),
                        vehicle_model=customer.get("vehicle_model"),
                        acknowledgement_status="Acknowledged by Customer within 1 Minute",
                    )

                    email_res = self.send_email_alert(
                        recipient=customer_email,
                        subject=f"[EV TwinGuard HIGH ALERT - ACKNOWLEDGED] Pack {alert_dict.get('battery_id')} (Risk: {float(alert_dict.get('risk_score') or 75.0):.1f}/100)",
                        body_text=report_text,
                    )
                    email_delivered = bool(email_res.get("success") or email_res.get("status") == "SENT_VIA_SMTP")

                    conn.execute("""
                        UPDATE alert_events
                        SET acknowledged = 1, acknowledged_at = ?, status = 'ACKNOWLEDGED',
                            email_sent = ?, full_report = ?
                        WHERE id = ?
                    """, (now, 1 if email_delivered else 0, report_text, alert_id))
                    conn.commit()

                    return {
                        "success": True,
                        "status": "ACKNOWLEDGED",
                        "message": "Alert acknowledged successfully. Battery report sent to your registered email.",
                        "email_sent": email_delivered,
                        "sms_sent": False,
                        "call_triggered": False,
                    }

            return {"success": True, "status": "ACKNOWLEDGED"}

    def check_and_escalate_pending_alerts(self) -> int:
        """
        Background escalation worker:
        Scans for any HIGH risk alerts where:
        - status == 'PENDING'
        - acknowledged == 0
        - acknowledgement_deadline <= now()
        Atomically marks them as ESCALATED and triggers Email + SMS + Twilio Call.
        """
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()

        escalated_count = 0
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT a.*, u.name as customer_name, u.email as customer_email,
                       u.phone as customer_phone, u.vehicle_model
                FROM alert_events a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.risk_level = 'HIGH'
                  AND a.status = 'PENDING'
                  AND a.acknowledged = 0
                  AND a.acknowledgement_deadline IS NOT NULL
                  AND a.acknowledgement_deadline <= ?
            """, (now_iso,))
            pending_alerts = [dict(row) for row in cursor.fetchall()]

            for alert in pending_alerts:
                alert_id = alert["id"]
                # Atomically mark as ESCALATED to avoid race conditions or duplicate dispatch
                upd = conn.execute("""
                    UPDATE alert_events
                    SET status = 'ESCALATED', escalated_at = ?
                    WHERE id = ? AND status = 'PENDING' AND acknowledged = 0
                """, (now_iso, alert_id))
                conn.commit()

                if upd.rowcount == 0:
                    continue  # Acknowledged or escalated concurrently

                escalated_count += 1
                logger.warning(f"ESCALATING unacknowledged HIGH alert [{alert_id}] for battery {alert['battery_id']}")

                customer_email = os.getenv("ALERT_RECIPIENT_EMAIL") or alert.get("customer_email") or "thamaraiselvid14@gmail.com"
                customer_phone = alert.get("customer_phone") or os.getenv("TWILIO_TO_PHONE", "+1-800-555-0199")
                predicted_temp = float(alert.get("predicted_temperature") or 55.0)
                risk_score = float(alert.get("risk_score") or 85.0)
                battery_id = alert.get("battery_id")

                # 1. Dispatch Email with escalation note
                factors = json.loads(alert.get("main_risk_factors") or "[]")
                recs = json.loads(alert.get("recommended_action") or "[]")
                report_text = self.generate_battery_report_text(
                    battery_id=battery_id,
                    timestamp=now_iso,
                    predicted_temp=predicted_temp,
                    current_temp=float(alert.get("current_temperature") or 50.0),
                    soc=float(alert.get("soc") or 90.0),
                    voltage=float(alert.get("voltage") or 410.0),
                    charging_current=float(alert.get("charging_current") or 65.0),
                    ambient_temp=25.0,
                    battery_age=float(alert.get("battery_age") or 24.0),
                    charging_cycles=int(alert.get("charging_cycles") or 800),
                    risk_score=risk_score,
                    risk_level="HIGH",
                    main_risk_factors=factors,
                    recommendations=recs,
                    alert_status="CRITICAL_ACTION_REQUIRED",
                    charging_status="SIMULATED DISCONNECT",
                    customer_name=alert.get("customer_name"),
                    customer_email=customer_email,
                    customer_phone=customer_phone,
                    vehicle_model=alert.get("vehicle_model"),
                    acknowledgement_status="UNACKNOWLEDGED (Window Expired)",
                    timeout_escalation_note="The dashboard alert was not acknowledged within 1 minute. Emergency notifications (SMS + Call) have been triggered.",
                )

                try:
                    self.send_email_alert(
                        recipient=customer_email,
                        subject=f"[EMERGENCY ESCALATION] HIGH Risk on Battery {battery_id} (Unacknowledged Timeout)",
                        body_text=report_text,
                    )
                except Exception as e:
                    logger.error(f"Failed to send escalation email: {e}")

                # 2. Dispatch SMS
                sms_message = (
                    f"EV TwinGuard ALERT: HIGH battery risk detected. Predicted temperature: {predicted_temp:.1f}°C. "
                    f"Risk value: {risk_score:.0f}. The dashboard alert was not acknowledged within 1 minute. "
                    f"Please inspect your EV battery immediately."
                )
                try:
                    self.send_sms_alert(to_phone=customer_phone, message_text=sms_message)
                except Exception as e:
                    logger.error(f"Failed to send escalation SMS: {e}")

                # 3. Trigger Twilio Voice Call
                call_voice_msg = (
                    "Warning. EV TwinGuard has detected a high-risk battery condition in your electric vehicle. "
                    "The dashboard alert was not acknowledged within one minute. Please inspect your EV battery immediately."
                )
                call_res = {}
                try:
                    call_res = self.trigger_twilio_call(
                        battery_id=battery_id,
                        risk_score=risk_score,
                        predicted_temp=predicted_temp,
                        to_phone=customer_phone,
                        custom_message=call_voice_msg,
                    )
                except Exception as e:
                    logger.error(f"Failed to trigger escalation voice call: {e}")
                    call_res = {"status": "FAILED", "error": str(e)}

                # Record successful escalation dispatch flags and provider response
                conn.execute("""
                    UPDATE alert_events
                    SET email_sent = 1, sms_sent = 1, call_triggered = 1, full_report = ?, provider_response = ?
                    WHERE id = ?
                """, (report_text, json.dumps({"call": call_res}), alert_id))
                conn.commit()

        return escalated_count

    def get_customer_analyses(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM battery_analyses
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
            return [dict(row) for row in cursor.fetchall()]

    def get_customer_alerts(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM alert_events
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (user_id, limit))
            return [dict(row) for row in cursor.fetchall()]

    def get_owner_metrics(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cust_row = conn.execute("SELECT COUNT(*) as count FROM users WHERE role = 'CUSTOMER'").fetchone()
            total_customers = cust_row["count"] if cust_row else 0

            anl_row = conn.execute("SELECT COUNT(*) as count FROM battery_analyses").fetchone()
            total_analyses = anl_row["count"] if anl_row else 0

            low_row = conn.execute("SELECT COUNT(*) as count FROM battery_analyses WHERE risk_level = 'LOW'").fetchone()
            low_risk_count = low_row["count"] if low_row else 0

            med_row = conn.execute("SELECT COUNT(*) as count FROM battery_analyses WHERE risk_level = 'MEDIUM'").fetchone()
            medium_risk_count = med_row["count"] if med_row else 0

            high_row = conn.execute("SELECT COUNT(*) as count FROM battery_analyses WHERE risk_level = 'HIGH'").fetchone()
            high_risk_count = high_row["count"] if high_row else 0

            alt_row = conn.execute("SELECT COUNT(*) as count FROM alert_events").fetchone()
            total_alerts = alt_row["count"] if alt_row else 0

            return {
                "total_customers": total_customers,
                "total_analyses": total_analyses,
                "low_risk_count": low_risk_count,
                "medium_risk_count": medium_risk_count,
                "high_risk_count": high_risk_count,
                "total_alerts": total_alerts,
            }

    def get_owner_customers(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            query = """
                SELECT u.id, u.name, u.email, u.phone, u.vehicle_model, u.battery_id, u.created_at,
                       COUNT(a.id) as analysis_count,
                       (SELECT risk_level FROM battery_analyses WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as latest_risk_level,
                       (SELECT created_at FROM battery_analyses WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as latest_analysis_date
                FROM users u
                LEFT JOIN battery_analyses a ON u.id = a.user_id
                WHERE u.role = 'CUSTOMER'
            """
            params = []
            if search and search.strip():
                query += " AND (u.name LIKE ? OR u.email LIKE ? OR u.battery_id LIKE ? OR u.vehicle_model LIKE ?)"
                term = f"%{search.strip()}%"
                params.extend([term, term, term, term])

            query += " GROUP BY u.id ORDER BY u.created_at DESC"
            cursor = conn.execute(query, tuple(params))
            return [dict(row) for row in cursor.fetchall()]

    def get_owner_customer_detail(self, customer_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            u_row = conn.execute("SELECT * FROM users WHERE id = ? AND role = 'CUSTOMER'", (customer_id,)).fetchone()
            if not u_row:
                return None
            customer = dict(u_row)

            # Analyses
            anl_cur = conn.execute("""
                SELECT * FROM battery_analyses
                WHERE user_id = ?
                ORDER BY created_at DESC
            """, (customer_id,))
            analyses = [dict(r) for r in anl_cur.fetchall()]

            # Alerts
            alt_cur = conn.execute("""
                SELECT * FROM alert_events
                WHERE user_id = ?
                ORDER BY timestamp DESC
            """, (customer_id,))
            alerts = [dict(r) for r in alt_cur.fetchall()]

            latest_analysis = analyses[0] if analyses else None

            return {
                "customer": customer,
                "latest_analysis": latest_analysis,
                "analyses": analyses,
                "alerts": alerts,
            }

    def get_owner_all_alerts(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT a.*, u.name as customer_name, u.vehicle_model, u.email as customer_email, u.phone as customer_phone
                FROM alert_events a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.timestamp DESC
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_owner_all_analyses(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT a.*, u.name as customer_name, u.battery_id as user_battery_id, u.vehicle_model
                FROM battery_analyses a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.created_at DESC
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]


def get_alert_service() -> AlertService:
    return AlertService.get_instance()
