// --- CONFIGURATION ---
// Remplace bien cette URL par celle donnée par ton Ngrok dans Colab
const API_URL = "https://thi-creasy-lightsomely.ngrok-free.dev/detect";

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteValue = document.getElementById('note-value');
const btnSave = document.getElementById('btn-save');
const historyList = document.getElementById('history-list');
const countBadge = document.getElementById('detection-count');
const statusDot = document.getElementById('status-dot');

let lastDetectedNote = "";

// 1. DEMARRER LA CAMERA
navigator.mediaDevices.getUserMedia({ 
    video: { 
        facingMode: "environment", 
        width: { ideal: 640 }, 
        height: { ideal: 640 } 
    } 
})
.then(stream => { 
    video.srcObject = stream;
    statusDot.style.background = "#eab308"; // Jaune : Caméra OK, en attente API
})
.catch(err => {
    alert("Erreur caméra : " + err);
    statusDot.style.background = "#ef4444"; // Rouge : Erreur
});

// 2. DESSINER LES BOITES YOLO
function drawDetections(detections) {
    // On ajuste le canvas à la taille réelle de la vidéo affichée à l'écran
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    ctx.strokeStyle = "#22c55e"; // Vert
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#22c55e";

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box; // Coordonnées relatives (0 à 1)
        
        // Conversion en pixels
        const bx = x1 * overlay.width;
        const by = y1 * overlay.height;
        const bw = (x2 - x1) * overlay.width;
        const bh = (y2 - y1) * overlay.height;

        ctx.strokeRect(bx, by, bw, bh);

        // Badge de confiance au dessus de la boite
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 14px Arial";
        ctx.fillText(`NOTE ${Math.round(det.conf * 100)}%`, bx, by - 10);
    });
}

// 3. CAPTURER ET ENVOYER L'IMAGE A COLAB
async function processFrame() {
    if (video.videoWidth === 0) return;

    // Création d'un canvas invisible pour capturer l'image brute
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const captureCtx = captureCanvas.getContext('2d');
    captureCtx.drawImage(video, 0, 0);

    // Conversion en JPEG et envoi
    captureCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('frame', blob);

        try {
            const response = await fetch(API_URL, { 
                method: 'POST', 
                body: formData 
            });

            if (!response.ok) throw new Error("Erreur Serveur");

            const data = await response.json();

            // Gestion de la note texte
            if (data.note && data.note !== "---") {
                noteValue.innerText = data.note;
                lastDetectedNote = data.note;
                btnSave.disabled = false;
                statusDot.style.background = "#22c55e"; // Vert : Tout est OK
            }

            // Mise à jour du compteur et des boites
            countBadge.innerText = `${data.detections ? data.detections.length : 0} Note(s) trouvée(s)`;
            if (data.detections) {
                drawDetections(data.detections);
            }

        } catch (e) {
            console.error("L'API ne répond pas");
            statusDot.style.background = "#ef4444"; // Rouge
        }
    }, 'image/jpeg', 0.6);
}

// 4. SAUVEGARDER DANS L'HISTORIQUE
btnSave.addEventListener('click', () => {
    if (!lastDetectedNote) return;

    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    const li = document.createElement('li');
    li.style.cssText = "background: #1e293b; margin-bottom: 5px; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; border-left: 4px solid #22c55e;";
    
    li.innerHTML = `
        <span>Note : <strong>${lastDetectedNote}</strong></span>
        <small style="color: #94a3b8;">${time}</small>
    `;

    // Ajouter en haut de la liste
    historyList.insertBefore(li, historyList.firstChild);

    // Petit feedback visuel
    btnSave.innerText = "C'est fait !";
    btnSave.disabled = true;
    window.navigator.vibrate(100); // Vibre sur Android

    setTimeout(() => {
        btnSave.innerText = "✅ Enregistrer";
        noteValue.innerText = "---";
        lastDetectedNote = "";
        ctx.clearRect(0, 0, overlay.width, overlay.height);
    }, 1500);
});

// Lancer la boucle (environ 1 image par seconde pour ne pas saturer Ngrok)
setInterval(processFrame, 1000);
