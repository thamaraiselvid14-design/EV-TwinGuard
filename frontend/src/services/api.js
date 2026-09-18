const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

/**
 * Checks backend health status.
 * Sends GET request to ${API_BASE_URL}/api/health
 */
export async function getHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API getHealth error:', error);
    throw error;
  }
}

/**
 * Predicts future battery temperature using the ML model.
 * POST ${API_BASE_URL}/api/battery/predict
 */
export async function predictBattery(batteryData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(batteryData),
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 422 && data.detail) {
        const errorMessages = Array.isArray(data.detail)
          ? data.detail.map((d) => `${d.loc ? d.loc.slice(-1)[0] : 'field'}: ${d.msg}`).join(' | ')
          : JSON.stringify(data.detail);
        throw new Error(`Validation Error: ${errorMessages}`);
      }
      throw new Error(data.detail || data.message || `Prediction failed (HTTP ${response.status})`);
    }
    return data;
  } catch (error) {
    console.error('API predictBattery error:', error);
    throw error;
  }
}

/**
 * Calculates multi-factor risk assessment and triggers automated alerts if MEDIUM/HIGH.
 * POST ${API_BASE_URL}/api/battery/risk-assessment
 */
export async function assessRisk(riskData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/risk-assessment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(riskData),
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 422 && data.detail) {
        const errorMessages = Array.isArray(data.detail)
          ? data.detail.map((d) => `${d.loc ? d.loc.slice(-1)[0] : 'field'}: ${d.msg}`).join(' | ')
          : JSON.stringify(data.detail);
        throw new Error(`Validation Error: ${errorMessages}`);
      }
      throw new Error(data.detail || data.message || `Risk assessment failed (HTTP ${response.status})`);
    }
    return data;
  } catch (error) {
    console.error('API assessRisk error:', error);
    throw error;
  }
}

/**
 * Retrieves persisted alert history records from SQLite database.
 * GET ${API_BASE_URL}/api/battery/alerts/history
 */
export async function getAlertHistory(limit = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/alerts/history?limit=${limit}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch alert history (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('API getAlertHistory error:', error);
    throw error;
  }
}

/**
 * Submits manual battery telemetry for validation.
 * POST ${API_BASE_URL}/api/battery/manual-input
 */
export async function submitManualBatteryData(batteryData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/manual-input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(batteryData),
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 422 && data.detail) {
        const errorMessages = Array.isArray(data.detail)
          ? data.detail.map((d) => `${d.loc ? d.loc.slice(-1)[0] : 'field'}: ${d.msg}`).join(' | ')
          : JSON.stringify(data.detail);
        const err = new Error(`Validation Error: ${errorMessages}`);
        err.validationErrors = data.detail;
        throw err;
      }
      throw new Error(data.message || `Server returned HTTP ${response.status}: ${response.statusText}`);
    }
    return data;
  } catch (error) {
    console.error('API submitManualBatteryData error:', error);
    throw error;
  }
}

/**
 * Runs end-to-end unified battery analysis (Validation + AI Prediction + Multi-Factor Risk Assessment).
 * POST ${API_BASE_URL}/api/battery/analyze
 */
export async function analyzeBattery(batteryData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(batteryData),
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 422 && data.detail) {
        const errorMessages = Array.isArray(data.detail)
          ? data.detail.map((d) => `${d.loc ? d.loc.slice(-1)[0] : 'field'}: ${d.msg}`).join(' | ')
          : JSON.stringify(data.detail);
        const err = new Error(`Validation Error: ${errorMessages}`);
        err.validationErrors = data.detail;
        throw err;
      }
      throw new Error(data.detail || data.message || `Server returned HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    console.error('API analyzeBattery error:', error);
    throw error;
  }
}

/**
 * Executes What-If Charging Simulator for 12A, 18A, and 25A currents.
 * POST ${API_BASE_URL}/api/battery/simulate-charging
 */
export async function simulateCharging(batteryData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/simulate-charging`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(batteryData),
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 422 && data.detail) {
        const errorMessages = Array.isArray(data.detail)
          ? data.detail.map((d) => `${d.loc ? d.loc.slice(-1)[0] : 'field'}: ${d.msg}`).join(' | ')
          : JSON.stringify(data.detail);
        throw new Error(`Validation Error: ${errorMessages}`);
      }
      throw new Error(data.detail || data.message || `Simulation failed (HTTP ${response.status})`);
    }
    return data;
  } catch (error) {
    console.error('API simulateCharging error:', error);
    throw error;
  }
}

/**
 * Executes a Digital Twin Parametric Time-Series Simulation.
 * POST ${API_BASE_URL}/api/battery/simulate
 */
export async function runSimulation(params) {

  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || `Simulation error HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    console.error('API runSimulation error:', error);
    throw error;
  }
}

/**
 * Retrieves active and historical safety alerts.
 * GET ${API_BASE_URL}/api/battery/alerts
 */
export async function getAlerts(limit = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/alerts?limit=${limit}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch alerts HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API getAlerts error:', error);
    throw error;
  }
}

/**
 * Acknowledges a safety alert.
 * POST ${API_BASE_URL}/api/battery/alerts/acknowledge
 */
export async function acknowledgeAlert(alertId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/alerts/acknowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ alert_id: alertId }),
    });
    return await response.json();
  } catch (error) {
    console.error('API acknowledgeAlert error:', error);
    throw error;
  }
}

/**
 * Simulates alert dispatch (email/SMS preview).
 * POST ${API_BASE_URL}/api/battery/alerts/simulate
 */
export async function simulateAlert(alertPayload) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/alerts/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(alertPayload),
    });
    return await response.json();
  } catch (error) {
    console.error('API simulateAlert error:', error);
    throw error;
  }
}

/**
 * Samples telemetry records from the large dataset.
 * GET ${API_BASE_URL}/api/battery/dataset/sample
 */
export async function getDatasetSample(n = 10) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/battery/dataset/sample?n=${n}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch dataset sample HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API getDatasetSample error:', error);
    throw error;
  }
}

export { API_BASE_URL };
