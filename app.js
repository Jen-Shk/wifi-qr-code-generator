document.addEventListener("DOMContentLoaded", () => {
  function escapeWiFi(text) {
    return String(text).replace(/([\\;,":])/g, "\\$1");
  }

  function buildWifiPayload({ ssid, password, auth, hidden }) {
    const S = escapeWiFi(ssid);
    const H = hidden ? "H:true;" : "";
    if (auth === "nopass") return `WIFI:T:nopass;S:${S};${H};`;
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
    const ssid = ssidEl.value.trim();
    if (!ssid) {
      alert("Please generate a QR first.");
      return;
    }
    const qrCanvas = canvas;
    if (!qrCanvas) return;
    const downloadCanvas = document.createElement("canvas");
    const ctx = downloadCanvas.getContext("2d");
    const width = 400;
    const height = 460;
    downloadCanvas.width = width;
    downloadCanvas.height = height;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#000";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(ssid, width / 2, 30);
    const qrSize = 320;
    ctx.drawImage(qrCanvas, (width - qrSize) / 2, 60, qrSize, qrSize);
    const a = document.createElement("a");
    a.href = downloadCanvas.toDataURL("image/png");
    a.download = `wifi-qr-${ssid || "network"}.png`;
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

  // === Scanner code with camera selector ===
  const video = document.getElementById("video");
  const scanResult = document.getElementById("scan-result");
  const scanInfo = document.getElementById("scan-info");
  const scanSSID = document.getElementById("scan-ssid");
  const scanPass = document.getElementById("scan-pass");
  const copyPassBtn = document.getElementById("copy-pass");
  const cameraSelect = document.getElementById("camera-select");
  let stream;

  function parseWiFiPayload(payload) {
    const match = /^WIFI:T:(.*?);S:(.*?);P:(.*?);/.exec(payload);
    if (!match) return null;
    return { type: match[1], ssid: match[2], pass: match[3] };
  }

  function handleCode(code) {
    if (code && code.data.startsWith("WIFI:")) {
      const parsed = parseWiFiPayload(code.data);
      if (parsed) {
        scanInfo.classList.remove("hidden");
        scanSSID.textContent = parsed.ssid || "(none)";
        scanPass.textContent = parsed.pass || "(none)";
        scanResult.textContent = "Wi-Fi QR Detected ✅";
        copyPassBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(parsed.pass || "");
            copyPassBtn.textContent = "Copied!";
            setTimeout(() => (copyPassBtn.textContent = "Copy"), 1200);
          } catch {
            alert("Could not copy password.");
          }
        };
      }
    } else {
      scanResult.textContent = "Invalid or non-WiFi QR";
    }
  }

  async function getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");
    cameraSelect.innerHTML = "";
    videoDevices.forEach((device, i) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `Camera ${i + 1}`;
      cameraSelect.appendChild(option);
    });
  }

  cameraSelect.addEventListener("change", startCam);
  getCameras();

  async function startCam() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  
    let constraints;
    if (cameraSelect.value) {
      // If user picked a camera, use it
      constraints = { video: { deviceId: cameraSelect.value } };
    } else {
      // Otherwise, prefer back camera on phones
      constraints = { video: { facingMode: "environment" } };
    }
  
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.setAttribute("playsinline", true); // iOS Safari fix
  
      const canvasCapture = document.createElement("canvas");
      const ctx = canvasCapture.getContext("2d");
  
      function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvasCapture.width = video.videoWidth;
          canvasCapture.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvasCapture.width, canvasCapture.height);
          const imgData = ctx.getImageData(0, 0, canvasCapture.width, canvasCapture.height);
          const code = jsQR(imgData.data, canvasCapture.width, canvasCapture.height);
          if (code) handleCode(code);
        }
        requestAnimationFrame(tick);
      }
      tick();
    } catch (err) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError") {
        scanResult.textContent =
          "Camera permission denied 🚫. Please allow it in browser/site settings.";
      } else {
        scanResult.textContent = "Unable to access camera.";
      }
    }
  }
  
  document.getElementById("fileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvasCapture = document.createElement("canvas");
      const ctx = canvasCapture.getContext("2d");
      canvasCapture.width = img.width;
      canvasCapture.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvasCapture.width, canvasCapture.height);
      const code = jsQR(imgData.data, canvasCapture.width, canvasCapture.height);
      handleCode(code);
    };
    img.src = URL.createObjectURL(file);
  });

  // === Tabs switch ===
  const genTab = document.getElementById("tab-gen");
  const scanTab = document.getElementById("tab-scan");
  const gen = document.getElementById("generator");
  const scan = document.getElementById("scanner");

  genTab.onclick = () => {
    genTab.classList.add("active");
    scanTab.classList.remove("active");
    gen.classList.remove("hidden");
    scan.classList.add("hidden");
    if (stream) {
      video.srcObject.getTracks().forEach(track => track.stop());
      stream = null;
    }
  };

  scanTab.onclick = () => {
    scanTab.classList.add("active");
    genTab.classList.remove("active");
    scan.classList.remove("hidden");
    gen.classList.add("hidden");
    startCam();
  };
});
