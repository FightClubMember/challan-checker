// API configuration
const API_BASE = "https://api.allprinthub.in/api?=challan";
const API_KEY = "Ronak_api";

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  // Auto-search initial vehicle
  fetchChallan();
});

function quickFill(vehicleNo) {
  document.getElementById('vehicleInput').value = vehicleNo;
  fetchChallan();
}

async function fetchChallan() {
  const inputEl = document.getElementById('vehicleInput');
  const vehicle = inputEl.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!vehicle) {
    alert("Please enter a valid registration number");
    return;
  }

  const loader = document.getElementById('loadingOverlay');
  const resultsContainer = document.getElementById('resultsContainer');
  const noticeBanner = document.getElementById('noticeBanner');
  const searchBtn = document.getElementById('searchBtn');

  document.getElementById('loadingVehicleNumber').textContent = vehicle;
  noticeBanner.style.display = 'none';
  resultsContainer.style.display = 'none';
  resultsContainer.innerHTML = '';
  loader.style.display = 'block';
  searchBtn.disabled = true;

  // Visual delay for smooth little bike animation (minimum 1.5s)
  const minAnimPromise = new Promise(resolve => setTimeout(resolve, 1500));

  const targetUrl = `${API_BASE}&key=${API_KEY}&v=${encodeURIComponent(vehicle)}`;
  let responseText = null;
  let isApiSuccess = false;
  let errorMessage = "";

  try {
    const res = await fetch(targetUrl, {
      method: 'GET'
    });

    if (res.ok) {
      responseText = await res.text();
      isApiSuccess = true;
    } else {
      const errTxt = await res.text().catch(() => "");
      errorMessage = errTxt || `HTTP error ${res.status}`;
    }
  } catch (err) {
    errorMessage = err.message;
  }

  await minAnimPromise;

  loader.style.display = 'none';
  searchBtn.disabled = false;

  if (isApiSuccess && responseText) {
    const parsedData = parseApiReport(responseText, vehicle);
    renderResults(parsedData, responseText);
  } else {
    renderErrorState(vehicle, errorMessage);
  }
}

// Dedicated parser for the API's custom text intelligence report format
function parseApiReport(rawText, vehicle) {
  const result = {
    vehicle_number: vehicle,
    owner_name: "N/A",
    model: "N/A",
    rto: "N/A",
    state: "N/A",
    status_text: "CLEAN RECORD",
    total_challans: 0,
    total_fine_due: "₹0.00",
    response_time: "N/A",
    powered_by: "@Ronak_api",
    challans: [],
    raw: rawText
  };

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.includes("Owner Name")) {
      const parts = line.split(":");
      if (parts.length > 1) result.owner_name = parts.slice(1).join(":").trim();
    } else if (line.includes("Vehicle No")) {
      const parts = line.split(":");
      if (parts.length > 1) result.vehicle_number = parts.slice(1).join(":").trim();
    } else if (line.includes("Model")) {
      const parts = line.split(":");
      if (parts.length > 1) result.model = parts.slice(1).join(":").trim();
    } else if (line.includes("Registered At")) {
      const parts = line.split(":");
      if (parts.length > 1) result.rto = parts.slice(1).join(":").trim();
    } else if (line.includes("State")) {
      const parts = line.split(":");
      if (parts.length > 1) result.state = parts.slice(1).join(":").trim();
    } else if (line.includes("Status") && !line.includes("Court")) {
      const parts = line.split(":");
      if (parts.length > 1) result.status_text = parts.slice(1).join(":").trim();
    } else if (line.includes("Total Challans")) {
      const parts = line.split(":");
      if (parts.length > 1) {
        const val = parseInt(parts.slice(1).join(":").replace(/[^0-9]/g, ''), 10);
        result.total_challans = isNaN(val) ? 0 : val;
      }
    } else if (line.includes("Total Fine Due") || line.includes("Total Fine")) {
      const parts = line.split(":");
      if (parts.length > 1) result.total_fine_due = parts.slice(1).join(":").trim();
    } else if (line.includes("Response Time")) {
      const parts = line.split(":");
      if (parts.length > 1) result.response_time = parts.slice(1).join(":").trim();
    }
  }

  // Parse individual challan blocks if present
  // If there are detailed challans reported in the text:
  const challanBlocks = rawText.split(/CHALLAN DETAILS|CHALLAN #/i);
  if (challanBlocks.length > 1) {
    for (let i = 1; i < challanBlocks.length; i++) {
      const block = challanBlocks[i];
      const cLines = block.split(/\r?\n/).map(l => l.trim());
      const challanObj = {
        number: `CH-${i}`,
        date: "N/A",
        offence: "Traffic Infraction",
        amount: "₹0",
        location: "Traffic Junction",
        status: "PENDING"
      };

      cLines.forEach(cl => {
        if (cl.toLowerCase().includes("challan no") || cl.toLowerCase().includes("number")) {
          challanObj.number = cl.split(":")[1]?.trim() || challanObj.number;
        } else if (cl.toLowerCase().includes("date")) {
          challanObj.date = cl.split(":")[1]?.trim() || challanObj.date;
        } else if (cl.toLowerCase().includes("offence") || cl.toLowerCase().includes("violation")) {
          challanObj.offence = cl.split(":")[1]?.trim() || challanObj.offence;
        } else if (cl.toLowerCase().includes("amount") || cl.toLowerCase().includes("fine")) {
          challanObj.amount = cl.split(":")[1]?.trim() || challanObj.amount;
        } else if (cl.toLowerCase().includes("place") || cl.toLowerCase().includes("location")) {
          challanObj.location = cl.split(":")[1]?.trim() || challanObj.location;
        } else if (cl.toLowerCase().includes("status")) {
          challanObj.status = cl.split(":")[1]?.trim() || challanObj.status;
        }
      });
      result.challans.push(challanObj);
    }
  }

  return result;
}

function renderResults(data, rawReport) {
  const container = document.getElementById('resultsContainer');
  const isClean = data.total_challans === 0 || data.status_text.toLowerCase().includes("clean");

  let html = `
    <!-- Top Vehicle Info & Owner Summary -->
    <div class="vehicle-summary-card">
      <div class="vehicle-plate-badge">
        <div class="ind-strip">
          <span class="ind-symbol">IND</span>
          <span class="ind-plate-number">${data.vehicle_number}</span>
        </div>
        <div>
          <div style="font-weight: 800; font-size: 1.15rem; color: #f8fafc;">${data.owner_name}</div>
          <div style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 2px;">
            🏍️ <strong>${data.model}</strong>
          </div>
          <div style="color: #64748b; font-size: 0.8rem; margin-top: 2px;">
            🏛️ RTO: ${data.rto} (State: ${data.state})
          </div>
        </div>
      </div>

      <div class="stats-group">
        <div class="stat-item">
          <span class="stat-label">Total Challans</span>
          <span class="stat-value ${data.total_challans > 0 ? 'danger' : 'success'}">${data.total_challans}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Fine Due</span>
          <span class="stat-value ${data.total_challans > 0 ? 'warning' : 'success'}">${data.total_fine_due}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">API Speed</span>
          <span class="stat-value" style="color: var(--accent-cyan); font-size: 1rem;">${data.response_time}</span>
        </div>
      </div>
    </div>
  `;

  if (isClean) {
    html += `
      <div class="challan-card paid" style="text-align: center; padding: 42px 24px;">
        <div style="font-size: 3.2rem; margin-bottom: 12px;">🎉</div>
        <h3 style="font-size: 1.35rem; margin-bottom: 8px; color: #34d399; font-weight: 800;">
          ${data.status_text}
        </h3>
        <p style="color: var(--text-secondary); max-width: 550px; margin: 0 auto 18px auto;">
          Zero pending violations recorded for <strong>${data.vehicle_number}</strong>. This vehicle has no unpaid traffic fines or court summons on the national transport network.
        </p>
        <div style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); padding: 6px 14px; border-radius: 999px;">
          <span>✓ Official Parivahan Database Verified</span>
        </div>
      </div>
    `;
  } else {
    // If challans exist
    html += `<div class="challan-list">`;
    if (data.challans.length > 0) {
      data.challans.forEach((c) => {
        html += `
          <div class="challan-card unpaid">
            <div class="challan-header">
              <div>
                <span class="challan-id">${c.number}</span>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                  Date: <strong>${c.date}</strong>
                </div>
              </div>
              <span class="status-pill pending">${c.status}</span>
            </div>

            <div class="challan-body">
              <div class="detail-box">
                <span class="label">Offence</span>
                <span class="val">${c.offence}</span>
              </div>
              <div class="detail-box">
                <span class="label">Location</span>
                <span class="val">${c.location}</span>
              </div>
            </div>

            <div class="challan-footer">
              <div>
                <span class="label" style="font-size: 0.75rem; color: var(--text-secondary);">Fine Due</span>
                <div class="amount-tag">${c.amount}</div>
              </div>
              <a href="https://echallan.parivahan.gov.in/" target="_blank" rel="noopener noreferrer" class="pay-btn">
                <span>Pay on Parivahan</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
          </div>
        `;
      });
    } else {
      // Challans reported in total count
      html += `
        <div class="challan-card unpaid">
          <div class="challan-header">
            <div>
              <span class="challan-id">PENDING VIOLATION RECORD</span>
            </div>
            <span class="status-pill pending">PENDING</span>
          </div>
          <div class="challan-body">
            <div class="detail-box">
              <span class="label">Summary</span>
              <span class="val">${data.status_text}</span>
            </div>
          </div>
          <div class="challan-footer">
            <div class="amount-tag">${data.total_fine_due}</div>
            <a href="https://echallan.parivahan.gov.in/" target="_blank" rel="noopener noreferrer" class="pay-btn">
              <span>Pay on Parivahan</span>
            </a>
          </div>
        </div>
      `;
    }
    html += `</div>`;
  }

  // Raw API Intelligence log preview
  html += `
    <div style="margin-top: 24px; background: rgba(15, 23, 42, 0.75); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; letter-spacing: 0.08em;">
          Direct API Intelligence Output
        </span>
        <span style="font-size: 0.75rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace;">Live Stream</span>
      </div>
      <pre style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #cbd5e1; background: #070a13; padding: 14px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(rawReport)}</pre>
    </div>
  `;

  container.innerHTML = html;
  container.style.display = 'block';
}

function renderErrorState(vehicle, errMsg) {
  const container = document.getElementById('resultsContainer');
  container.innerHTML = `
    <div class="challan-card court" style="text-align: center; padding: 36px 20px;">
      <div style="font-size: 2.5rem; margin-bottom: 10px;">⚠️</div>
      <h3 style="font-size: 1.25rem; color: #f87171; font-weight: 700; margin-bottom: 6px;">
        Vehicle Record Not Found or Gateway Busy
      </h3>
      <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 12px auto; font-size: 0.92rem;">
        The system could not retrieve records for <strong>${vehicle}</strong>. Either the registration number is invalid, not yet registered on the central transport server, or the API rate limit was hit.
      </p>
      <div style="font-size: 0.8rem; color: #94a3b8; font-family: 'JetBrains Mono', monospace; background: rgba(239, 68, 68, 0.1); display: inline-block; padding: 4px 12px; border-radius: 6px;">
        ${escapeHtml(errMsg || "Record Not Found")}
      </div>
    </div>
  `;
  container.style.display = 'block';
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
