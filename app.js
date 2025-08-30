document.addEventListener("DOMContentLoaded", () => {
    // ===== Wi-Fi QR Generator =====
    function escapeWiFi(text) {
        return String(text).replace(/([\\;,":])/g, "\\$1");
    }

    function buildWifiPayload({ ssid, password, auth, hidden }) {
        const S = escapeWiFi(ssid);
        const H = hidden ? "H:true;" : "H:false;";
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

    // Show or hide password field based on auth type
    function togglePasswordVisibility() {
        passwordWrap.style.display = authEl.value === "nopass" ? "none" : "grid";
    }
    togglePasswordVisibility();
    authEl.addEventListener("change", togglePasswordVisibility);

    // Draw QR code on canvas
    async function drawQR(text) {
        await QRCode.toCanvas(canvas, text, { width: 280, margin: 1, errorCorrectionLevel: "M" });
    }

    // Generate QR code and update payload
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

    // Download QR code as an image
    downloadBtn.addEventListener("click", () => {
        const ssid = ssidEl.value.trim();
        if (!ssid) {
            alert("Please generate a QR first.");
            return;
        }

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
        ctx.drawImage(canvas, (width - qrSize) / 2, 60, qrSize, qrSize);

        const a = document.createElement("a");
        a.href = downloadCanvas.toDataURL("image/png");
        a.download = `wifi-qr-${ssid || "network"}.png`;
        a.click();
    });

    // Copy QR payload text to clipboard
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

    // ===== Wi-Fi QR Scanner =====
    const video = document.getElementById("video");
    const scanResult = document.getElementById("scan-result");
    const scanInfo = document.getElementById("scan-info");
    const scanSSID = document.getElementById("scan-ssid");
    const scanPass = document.getElementById("scan-pass");
    const copyPassBtn = document.getElementById("copy-pass");
    const cameraSelect = document.getElementById("camera-select");
    const startBtn = document.getElementById("start-scan");
    const stopBtn = document.getElementById("stop-scan");
    const videoCanvas = document.getElementById("video-canvas");
    const videoCtx = videoCanvas.getContext("2d");
    const clearBtn = document.getElementById("clear-screen");

    let stream = null;
    let scanning = false;

    function parseWiFiPayload(payload) {
        const match = /^WIFI:(.*);?$/.exec(payload);
        if (!match) return null;

        const parts = match[1].split(';');
        const result = { type: "nopass", ssid: "", pass: "", hidden: false };

        for (const part of parts) {
            if (part.startsWith("T:")) result.type = part.slice(2);
            else if (part.startsWith("S:")) result.ssid = part.slice(2);
            else if (part.startsWith("P:")) result.pass = part.slice(2);
            else if (part.startsWith("H:")) result.hidden = part.slice(2).toLowerCase() === "true";
        }
        return result;
    }

    // ===== Handle QR Code result =====
    function handleCode(code, sourceImage = null) {
        scanInfo.classList.add("hidden");
        document.getElementById("scan-payload").textContent = "";

        if (code && code.data.startsWith("WIFI:")) {
            const parsed = parseWiFiPayload(code.data);
            if (parsed) {
                scanInfo.classList.remove("hidden");

                document.getElementById("scan-type").textContent = parsed.type;
                scanSSID.textContent = parsed.ssid || "(none)";
                scanPass.textContent = parsed.pass || "(none)";
                document.getElementById("scan-hidden").textContent = parsed.hidden ? "Yes" : "No";

                scanResult.textContent = "Wi-Fi QR Detected ✅";
                document.getElementById("scan-payload").textContent = code.data;

                video.classList.add("hidden");
                videoCanvas.classList.remove("hidden");
                const ctx = videoCanvas.getContext("2d");

                videoCanvas.width = 280;
                videoCanvas.height = 280;
                ctx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

                QRCode.toCanvas(videoCanvas, code.data, { width: 280, margin: 1 }, function(error) {
                    if (error) console.error(error);
                });

                pauseCam();

                copyPassBtn.onclick = async () => {
                    if (!parsed.pass) {
                        copyPassBtn.textContent = "No password";
                        setTimeout(() => (copyPassBtn.textContent = "Copy"), 1200);
                        return;
                    }
                    try {
                        await navigator.clipboard.writeText(parsed.pass);
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

    // ===== List available cameras =====
    async function listCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            cameraSelect.innerHTML = "";
            devices.forEach((device, i) => {
                if (device.kind === "videoinput") {
                    const option = document.createElement("option");
                    option.value = device.deviceId;
                    option.text = device.label || `Camera ${i + 1}`;
                    cameraSelect.appendChild(option);
                }
            });

            const savedCam = localStorage.getItem("lastCameraId");
            if (savedCam && [...cameraSelect.options].some(opt => opt.value === savedCam)) {
                cameraSelect.value = savedCam;
            }
        } catch (err) {
            console.warn("Error listing cameras:", err);
        }
    }

    // ===== Start camera & scanning =====
    async function startCam() {
        video.classList.remove("hidden");
        videoCanvas.classList.add("hidden");

        if (stream) stopCam();

        const constraints = cameraSelect.value
            ? { video: { deviceId: { exact: cameraSelect.value } } }
            : { video: { facingMode: "environment" } };

        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            video.setAttribute("playsinline", true);

            localStorage.setItem("lastCameraId", cameraSelect.value);

            const canvasCapture = document.createElement("canvas");
            const ctx = canvasCapture.getContext("2d");
            scanning = true;

            function tick() {
                if (!scanning) return;
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
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error("Camera error:", err);
            scanResult.textContent =
                err.name === "NotAllowedError"
                    ? "Camera permission denied 🚫. Please allow it in browser settings."
                    : "Unable to access camera.";
        }
    }

    // ===== Pause camera (stop video feed, keep canvas) =====
    function pauseCam() {
        if (!stream) return;

        stream.getTracks().forEach(track => track.stop());
        stream = null;

        video.classList.add("hidden");
        videoCanvas.classList.remove("hidden");

        scanning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }

    // ===== Stop camera & reset =====
    function stopCam() {
        scanning = false;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        video.srcObject = null;

        video.classList.remove("hidden");
        videoCanvas.classList.add("hidden");
        videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

        startBtn.disabled = false;
        stopBtn.disabled = true;
    }

    // ===== Clear screen function =====
    function clearScreen() {
        if (stream) {
            stopCam();
        } else {
            videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
            videoCanvas.classList.remove("hidden");
            video.classList.add("hidden");
        }

        scanResult.textContent = "";
        document.getElementById("scan-type").textContent = "";
        scanSSID.textContent = "";
        scanPass.textContent = "";
        document.getElementById("scan-hidden").textContent = "";
        document.getElementById("scan-payload").textContent = "";
        scanInfo.classList.add("hidden");

        if (fileInput) fileInput.value = "";
    }

    // ===== Button events =====
    startBtn.addEventListener("click", startCam);
    stopBtn.addEventListener("click", stopCam);
    clearBtn.addEventListener("click", clearScreen);

    cameraSelect.addEventListener("change", () => {
        if (scanning) startCam();
    });

    // ===== File input scanning =====
    document.getElementById("fileInput").addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            const maxSize = 400;
            let w = img.width;
            let h = img.height;
            if (w > maxSize) {
                h = h * (maxSize / w);
                w = maxSize;
            }

            const canvasCapture = document.createElement("canvas");
            const ctx = canvasCapture.getContext("2d");
            canvasCapture.width = w;
            canvasCapture.height = h;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, w, h);

            ctx.drawImage(img, 0, 0, w, h);

            const imgData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imgData.data, w, h);

            if (code) {
                handleCode(code);
            } else {
                console.log("❌ jsQR failed to detect QR at all");
                scanResult.textContent = "Could not read QR from image ❌";
            }
        };
        img.src = URL.createObjectURL(file);
    });

    // ===== Tab switching =====
    const genTab = document.getElementById("tab-gen");
    const scanTab = document.getElementById("tab-scan");
    const gen = document.getElementById("generator");
    const scan = document.getElementById("scanner");

    genTab.onclick = () => {
        genTab.classList.add("active");
        scanTab.classList.remove("active");
        gen.classList.remove("hidden");
        scan.classList.add("hidden");
        stopCam();
    };

    scanTab.onclick = async () => {
        scanTab.classList.add("active");
        genTab.classList.remove("active");
        scan.classList.remove("hidden");
        gen.classList.add("hidden");
        await listCameras();
    };

    // ===== Footer =====
    document.getElementById("year").textContent = new Date().getFullYear();
});
