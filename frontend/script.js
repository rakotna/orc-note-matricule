// --- CONFIGURATION ---
const API_URL = "https://thi-creasy-lightsomely.ngrok-free.dev";
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteDisplay = document.getElementById('note-display');
const btnSave = document.getElementById('btn-save');
const historyList = document.getElementById('history-list');
const sessionCount = document.getElementById('session-count');
const aiStatus = document.getElementById('ai-status');

let detectionCount = 0;

// Démarrage caméra
navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: "environment", width: 1280, height: 720 } 
})
.then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
    };
})
.catch(err => {
    console.error("Erreur caméra:", err);
    aiStatus.textContent = "❌ Erreur caméra";
});

// Fonction pour dessiner les détections
function drawDetections(detections) {
    const scaleX = overlay.width / video.videoWidth;
    const scaleY = overlay.height / video.videoHeight;
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    detections.forEach(d => {
        // Conversion des coordonnées normalisées
        const x1 = d.box[0] * overlay.width;
        const y1 = d.box[1] * overlay.height;
        const x2 = d.box[2] * overlay.width;
        const y2 = d.box[3] * overlay.height;
        
        const width = x2 - x1;
        const height = y2 - y1;
        
        // ✅ CADRE VERT ÉPAIS
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#00FF00";
        ctx.shadowBlur = 10;
        ctx.strokeRect(x1, y1, width, height);
        ctx.shadowBlur = 0;
        
        // ✅ ÉTIQUETTE EN HAUT : "Note" (zone YOLO)
        ctx.fillStyle = "#00FF00";
        ctx.font = "bold 18px Arial";
        const labelTop = "Note";
        const labelTopWidth = ctx.measureText(labelTop).width;
        
        ctx.fillRect(x1, y1 - 30, labelTopWidth + 20, 30);
        ctx.fillStyle = "black";
        ctx.fillText(labelTop, x1 + 10, y1 - 8);
        
        // ✅ VALEUR DÉTECTÉE EN BAS (OCR)
        if (d.text && d.text !== "---") {
            ctx.fillStyle = "#00FF00";
            ctx.font = "bold 20px Arial";
            const valueText = `${d.text} (${d.conf}%)`;
            const valueWidth = ctx.measureText(valueText).width;
            
            ctx.fillRect(x1, y2 + 5, valueWidth + 20, 35);
            ctx.fillStyle = "black";
            ctx.fillText(valueText, x1 + 10, y2 + 28);
        }
    });
}

// Fonction de capture et détection
async function capture() {
    if (video.videoWidth === 0 || video.readyState !== 4) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const tempCtx = canvas.getContext('2d');
    
    // Capture centrée
    const aspect = video.videoWidth / video.videoHeight;
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    
    if (aspect > 1) {
        sw = video.videoHeight;
        sx = (video.videoWidth - sw) / 2;
    } else {
        sh = video.videoWidth;
        sy = (video.videoHeight - sh) / 2;
    }
    
    tempCtx.drawImage(video, sx, sy, sw, sh, 0, 0, 640, 640);
    
    canvas.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append('frame', blob);
        
        try {
            aiStatus.textContent = "🔍 Analyse en cours...";
            
            const res = await fetch(API_URL + "/detect", { 
                method: 'POST', 
                body: fd,
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            
            const data = await res.json();
            
            if (data.note !== "---") {
                noteDisplay.innerText = data.note;
                noteDisplay.classList.add('detected-pulse');
                setTimeout(() => noteDisplay.classList.remove('detected-pulse'), 500);
                btnSave.disabled = false;
                aiStatus.textContent = `✅ Note détectée: ${data.note}`;
            } else {
                aiStatus.textContent = "🔍 Recherche de note...";
            }
            
            drawDetections(data.detections || []);
            
        } catch (e) {
            console.error("Erreur API:", e);
            aiStatus.textContent = "❌ Erreur connexion backend";
            ctx.clearRect(0, 0, overlay.width, overlay.height);
        }
    }, 'image/jpeg', 0.85);
}

// Sauvegarde dans l'historique
btnSave.onclick = () => {
    const note = noteDisplay.innerText;
    const li = document.createElement('li');
    li.innerHTML = `<b>${note}</b> - ${new Date().toLocaleTimeString()}`;
    historyList.insertBefore(li, historyList.firstChild);
    
    detectionCount++;
    sessionCount.textContent = `${detectionCount} note${detectionCount > 1 ? 's' : ''}`;
    
    btnSave.disabled = true;
    aiStatus.textContent = "💾 Note sauvegardée !";
    setTimeout(() => aiStatus.textContent = "Prêt pour scan", 2000);
};

// Boucle de détection toutes les 1.2 secondes
setInterval(capture, 1200);
