document.addEventListener("DOMContentLoaded", () => {
    function escapeWiFi(text) {
      return String(text).replace(/([\\;,":])/g, "\\$1");
    }
  
    function buildWifiPayload({ ssid, password, auth, hidden }) {
      const S = escapeWiFi(ssid);
      const H = hidden ? "H:true;" : "";
      if (auth === "nopass") {
        return `WIFI:T:nopass;S:${S};${H};`;
      }
      const P = escapeWiFi(password);
      return `WIFI:T:${auth};S:${S};P:${P};${H};`;
    }
  
    const form = document.getElementById("wifi-form");
    const ssidEl = document.getElementById("ssid");
    const passEl = document.getElementById("password");
    const authEl = document.getElementById("auth");
    const hiddenEl = document.getElementById("hidden");
    const payloadEl = document.getElementById("payload");
    const canvas = document.getElementById("qr-canvas");
    const downloadBtn = document.getElementById("download");
    const copyBtn = document.getElementById("copy");
    const passwordWrap = document.getElementById("password-wrap");
  
    function togglePasswordVisibility() {
      passwordWrap.style.display = authEl.value === "nopass" ? "none" : "grid";
    }
    togglePasswordVisibility();
    authEl.addEventListener("change", togglePasswordVisibility);
  
    async function drawQR(text) {
      await QRCode.toCanvas(canvas, text, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: "M"
      });
    }
  
    async function generateAndRender() {
      const data = {
        ssid: ssidEl.value.trim(),
        password: passEl.value,
        auth: authEl.value,
        hidden: hiddenEl.checked
      };
  
      if (!data.ssid) {
        alert("Please enter the Wi-Fi name (SSID).");
        ssidEl.focus();
        return;
      }
      if (data.auth !== "nopass" && !data.password) {
        alert("Please enter the Wi-Fi password (or choose None).");
        passEl.focus();
        return;
      }
  
      const payload = buildWifiPayload(data);
      payloadEl.textContent = payload;
  
      await drawQR(payload);
    }
  
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      generateAndRender();
    });
  
    downloadBtn.addEventListener("click", () => {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `wifi-qr-${Date.now()}.png`;
      a.click();
    });
  
    copyBtn.addEventListener("click", async () => {
      const text = payloadEl.textContent.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy Text Payload"), 1200);
      } catch {
        alert("Could not copy to clipboard.");
      }
    });
});
  