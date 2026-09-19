const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Universal fetch with proxy support and direct fallback.
 * Automatically tries same-origin relative endpoint (Vite dev proxy) first,
 * and falls back to direct http://127.0.0.1:8000 if proxy fails.
 */
async function apiFetch(endpoint, options = {}) {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
  try {
    return await fetch(primaryUrl, options);
  } catch (err) {
    if (!API_BASE_URL && typeof window !== 'undefined' && !window.location.host.includes(':8000')) {
      try {
        const directUrl = `http://127.0.0.1:8000${endpoint}`;
        return await fetch(directUrl, options);
      } catch (directErr) {
        throw new Error(
          `Unable to connect to backend server at ${primaryUrl} or http://127.0.0.1:8000${endpoint}. Please check if the FastAPI backend is running.`
        );
      }
    }
    throw err;
  }
}

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

/**
 * Gets real-time dataset stream status.
 * GET ${API_BASE_URL}/api/realtime/status
 */
export async function getRealtimeStatus() {
  try {
    const response = await apiFetch('/api/realtime/status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to get realtime stream status (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('API getRealtimeStatus error:', error);
    throw error;
  }
}

/**
 * Starts or configures real-time dataset stream.
 * POST ${API_BASE_URL}/api/realtime/start
 */
export async function startRealtimeStream(intervalSeconds = 3) {
  try {
    const response = await apiFetch('/api/realtime/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ interval_seconds: intervalSeconds }),
    });
    if (!response.ok) {
      throw new Error(`Failed to start realtime stream (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('API startRealtimeStream error:', error);
    throw error;
  }
}

/**
 * Pauses real-time dataset stream.
 * POST ${API_BASE_URL}/api/realtime/pause
 */
export async function pauseRealtimeStream() {
  try {
    const response = await apiFetch('/api/realtime/pause', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to pause realtime stream (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('API pauseRealtimeStream error:', error);
    throw error;
  }
}

/**
 * Resets real-time dataset stream index.
 * POST ${API_BASE_URL}/api/realtime/reset
 */
export async function resetRealtimeStream() {
  try {
    const response = await apiFetch('/api/realtime/reset', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to reset realtime stream (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('API resetRealtimeStream error:', error);
    throw error;
  }
}

/**
 * Fetches next real-time dataset record & analysis.
 * GET ${API_BASE_URL}/api/realtime/next
 */
export async function getRealtimeNext() {
  try {
    const response = await apiFetch('/api/realtime/next', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch next realtime record (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('API getRealtimeNext error:', error);
    throw error;
  }
}

/* =========================================================================
   AUTHENTICATION APIS
   ========================================================================= */

export async function registerCustomer(data) {
  const payload = {
    full_name: data.full_name,
    email: data.email,
    mobile_number: data.mobile_number,
    password: data.password,
    confirm_password: data.confirm_password,
    vehicle_model: data.vehicle_model,
    battery_id: data.battery_id || data.battery_pack_id,
    battery_pack_id: data.battery_pack_id || data.battery_id,
  };

  const response = await apiFetch('/api/auth/customer/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });

  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 400 && typeof resData.detail === 'string' && resData.detail.toLowerCase().includes('already registered')) {
      throw new Error('Email already registered. Please sign in or use another email.');
    }
    if (response.status === 400 && typeof resData.detail === 'string' && resData.detail.toLowerCase().includes('already exists')) {
      throw new Error('Email already registered. Please sign in or use another email.');
    }
    if (response.status === 422 && Array.isArray(resData.detail)) {
      const fieldErrors = resData.detail.map((d) => `${d.loc ? d.loc.slice(-1)[0] : 'field'}: ${d.msg}`).join(', ');
      throw new Error(`Validation Error: ${fieldErrors}`);
    }
    throw new Error(resData.detail || resData.message || `Registration failed (HTTP ${response.status})`);
  }
  return resData;
}

export async function loginCustomer(credentials) {
  const response = await apiFetch('/api/auth/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
    throw new Error(resData.detail || resData.message || `Customer login failed (HTTP ${response.status})`);
  }
  return resData;
}

export async function loginOwner(credentials) {
  const response = await apiFetch('/api/auth/owner/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
    throw new Error(resData.detail || resData.message || `Owner login failed (HTTP ${response.status})`);
  }
  return resData;
}

export async function getCurrentUser(token) {
  const response = await apiFetch('/api/auth/me', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }
  return await response.json();
}

/* =========================================================================
   CUSTOMER PORTAL APIS
   ========================================================================= */

export async function getCustomerProfile(token) {
  const response = await apiFetch('/api/customer/profile', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch customer profile');
  }
  return await response.json();
}

export async function getCustomerAnalyses(token, limit = 50) {
  const response = await apiFetch(`/api/customer/analyses?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch customer analyses');
  }
  return await response.json();
}

export async function getCustomerAlerts(token, limit = 50) {
  const response = await apiFetch(`/api/customer/alerts?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch customer alerts');
  }
  return await response.json();
}

export async function analyzeCustomerBattery(batteryData, token) {
  const response = await apiFetch('/api/customer/battery/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(batteryData),
  });
  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || 'Battery analysis failed');
  }
  return resData;
}

export async function acknowledgeCustomerAlert(alertId, token) {
  const response = await apiFetch(`/api/customer/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || 'Failed to acknowledge alert');
  }
  return resData;
}

export async function changeCustomerPassword(currentPassword, newPassword, token) {
  const response = await apiFetch('/api/customer/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || resData.message || 'Failed to change password.');
  }
  return resData;
}

/* =========================================================================
   OWNER PORTAL APIS
   ========================================================================= */

export async function getOwnerDashboard(token) {
  const response = await apiFetch('/api/owner/dashboard', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch owner dashboard metrics');
  }
  return await response.json();
}

export async function getOwnerCustomers(token, search = null) {
  const url = search
    ? `/api/owner/customers?q=${encodeURIComponent(search)}`
    : '/api/owner/customers';
  const response = await apiFetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch owner customers list');
  }
  return await response.json();
}

export async function getOwnerCustomerView(customerId, token) {
  const response = await apiFetch(`/api/owner/customers/${customerId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch customer view');
  }
  return await response.json();
}

export async function getOwnerAlerts(token, limit = 100) {
  const response = await apiFetch(`/api/owner/alerts?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch owner alerts');
  }
  return await response.json();
}

export async function getOwnerAnalyses(token, limit = 100) {
  const response = await apiFetch(`/api/owner/analyses?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch owner analyses');
  }
  return await response.json();
}

export { API_BASE_URL };

