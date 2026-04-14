const statusEl = document.getElementById("status") as HTMLDivElement;
const portInput = document.getElementById("port") as HTMLInputElement;
const tokenInput = document.getElementById("token") as HTMLInputElement;
const btnClip = document.getElementById("btnClip") as HTMLButtonElement;
const btnCheck = document.getElementById("btnCheck") as HTMLButtonElement;
const resultEl = document.getElementById("result") as HTMLDivElement;

function getPort(): number {
  return parseInt(portInput.value, 10) || 27124;
}

function getToken(): string {
  return tokenInput.value.trim();
}

function setStatus(text: string, cls: string): void {
  statusEl.textContent = text;
  statusEl.className = `status ${cls}`;
}

function showResult(html: string): void {
  resultEl.innerHTML = html;
  resultEl.classList.remove("hidden");
}

function hideResult(): void {
  resultEl.classList.add("hidden");
}

async function checkConnection(): Promise<void> {
  setStatus("Checking connection...", "info");
  btnClip.disabled = true;

  try {
    const healthy: boolean = await chrome.runtime.sendMessage({
      type: "HEALTH_CHECK",
      port: getPort(),
      authToken: getToken() || undefined,
    }).then(r => r?.healthy ?? false);

    if (healthy) {
      setStatus("Connected to Obsidian AuthClip plugin", "ok");
      btnClip.disabled = false;
    } else {
      setStatus("Cannot connect. Ensure Obsidian is running with AuthClip plugin enabled.", "error");
    }
  } catch {
    setStatus("Connection check failed. Ensure Obsidian is running.", "error");
  }
}

async function clipPage(): Promise<void> {
  setStatus("Clipping page with local assets...", "working");
  btnClip.disabled = true;
  btnCheck.disabled = true;
  hideResult();

  try {
    const response = await chrome.runtime.sendMessage({
      type: "CLIP_PAGE",
      port: getPort(),
      authToken: getToken() || undefined,
    });

    if (response.success === false && response.error) {
      setStatus(`Error: ${response.error}`, "error");
      return;
    }

    if (response.success) {
      if (response.status === "partial") {
        setStatus(`Saved with warnings — ${response.failedCount} asset(s) failed`, "warn");
      } else {
        setStatus("Saved successfully!", "ok");
      }

      let html = "";
      if (response.notePath) {
        html += `<div class="detail"><span class="label">Note:</span> <span class="value">${escapeHtml(response.notePath)}</span></div>`;
      }
      html += `<div class="detail"><span class="label">Assets saved:</span> <span class="value">${response.savedCount ?? 0}</span></div>`;
      if (response.failedCount > 0) {
        html += `<div class="detail"><span class="label">Assets failed:</span> <span class="value">${response.failedCount}</span></div>`;
      }
      if (response.fetchFailures > 0) {
        html += `<div class="detail"><span class="label">Fetch failures:</span> <span class="value">${response.fetchFailures}</span></div>`;
      }
      showResult(html);
    } else {
      setStatus(`Failed: ${response.error ?? "unknown error"}`, "error");
    }
  } catch (err) {
    setStatus(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`, "error");
  } finally {
    btnCheck.disabled = false;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

btnClip.addEventListener("click", clipPage);
btnCheck.addEventListener("click", checkConnection);

checkConnection();
