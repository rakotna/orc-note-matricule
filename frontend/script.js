const API_URL = "https://VOTRE_URL_NGROK.ngrok-free.dev/detect"; // METTRE A JOUR
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteDisplay = document.getElementById('note-value');

// Initialisation caméra
navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: "environment", width: 640 } 
}).then(stream => { video.srcObject = stream; });

function drawBox(boxes) {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    boxes.forEach(box => {
        // Ajustement des ratios canvas/vidéo
        const scaleX = overlay.width / video.videoWidth;
        const scaleY = overlay.height / video.videoHeight;
        ctx.strokeRect(box[0]*scaleX, box[1]*scaleY, (box[2]-box[0])*scaleX, (box[3]-box[1])*scaleY);
    });
}

async function sendFrame() {
    if (video.videoWidth === 0) return;
    
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    captureCanvas.getContext('2d').drawImage(video, 0, 0);

    captureCanvas.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append('frame', blob);

        try {
            const response = await fetch(API_URL, { method: 'POST', body: fd });
            const data = await response.json();
            
            if (data.note) noteDisplay.textContent = data.note;
            if (data.boxes) drawBox(data.boxes);
            
        } catch (e) { console.error("Erreur Sync"); }
    }, 'image/jpeg', 0.5);
}

// Déclenchement régulier
setInterval(sendFrame, 1000);
