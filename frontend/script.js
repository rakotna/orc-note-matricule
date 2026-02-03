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
    video: { 
        facingMode: "environment", 
        width: { ideal: 1280 },
        height: { ideal: 720 }
    } 
})
.then(stream => {
    video.srcObject = stream;
    video.play().then(() => {
        // Attendre que la vidéo soit prête
        video.onloadeddata = () => {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            console.log(`Caméra: ${video.videoWidth}x${video.videoHeight}`);
            aiStatus.textContent = "✅ Caméra prête - Recherche de notes...";
        };
    });
})
.catch(err => {
    console.error("Erreur caméra:", err);
    aiStatus.textContent = "❌ Erreur caméra";
});

// Fonction pour dessiner les détections
function drawDetections(detections) {
    if (!detections || detections.length === 0) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        return;
    }
    
    console.log("Détections reçues:", detections);
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    detections.forEach(d => {
        // Les coordonnées sont déjà normalisées entre 0 et 1
        const x1 = d.box[0] * overlay.width;
        const y1 = d.box[1] * overlay.height;
        const x2 = d.box[2] * overlay.width;
        const y2 = d.box[3] * overlay.height;
        
        const width = x2 - x1;
        const height = y2 - y1;
        
        console.log(`Box: ${x1}, ${y1}, ${width}, ${height}`);
        
        // CADRE VERT
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, width, height);
        
        // Fond pour le texte
        ctx.fillStyle = "#00FF00";
        ctx.font = "bold 16px Arial";
        
        // Texte "Note" en haut
        const labelTop = "Note";
        const labelTopWidth = ctx.measureText(labelTop).width;
        ctx.fillRect(x1, y1 - 25, labelTopWidth + 10, 25);
        
        // Texte de la note en bas
        if (d.text && d.text !== "---") {
            const valueText = `${d.text} (${d.conf}%)`;
            const valueWidth = ctx.measureText(valueText).width;
            ctx.fillRect(x1, y2, valueWidth + 10, 25);
            
            // Texte noir
            ctx.fillStyle = "black";
            ctx.fillText(labelTop, x1 + 5, y1 - 8);
            ctx.fillText(valueText, x1 + 5, y2 + 18);
        } else {
            // Texte noir juste pour "Note"
            ctx.fillStyle = "black";
            ctx.fillText(labelTop, x1 + 5, y1 - 8);
        }
    });
}

// Fonction de capture et détection
async function capture() {
    if (!video.videoWidth || video.readyState !== 4) {
        console.log("Vidéo non prête");
        return;
    }
    
    // Créer un canvas temporaire avec la même taille que la vidéo
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const tempCtx = canvas.getContext('2d');
    
    // Dessiner la vidéo complète (sans crop)
    tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convertir en blob
    canvas.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append('frame', blob, 'frame.jpg');
        
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
            console.log("Réponse backend:", data);
            
            if (data.note && data.note !== "---") {
                noteDisplay.innerText = data.note;
                noteDisplay.classList.add('detected-pulse');
                setTimeout(() => noteDisplay.classList.remove('detected-pulse'), 500);
                btnSave.disabled = false;
                aiStatus.textContent = `✅ Note détectée: ${data.note}`;
            } else {
                aiStatus.textContent = "🔍 Recherche de note...";
            }
            
            // Dessiner les détections reçues
            drawDetections(data.detections);
            
        } catch (e) {
            console.error("Erreur API:", e);
            aiStatus.textContent = "❌ Erreur connexion backend";
            ctx.clearRect(0, 0, overlay.width, overlay.height);
        }
    }, 'image/jpeg', 0.9); // Qualité à 90%
}

// Sauvegarde dans l'historique
btnSave.onclick = () => {
    const note = noteDisplay.innerText;
    if (note === "---") return;
    
    const li = document.createElement('li');
    li.innerHTML = `<b>${note}</b> - ${new Date().toLocaleTimeString()}`;
    historyList.insertBefore(li, historyList.firstChild);
    
    detectionCount++;
    sessionCount.textContent = `${detectionCount} note${detectionCount > 1 ? 's' : ''}`;
    
    btnSave.disabled = true;
    aiStatus.textContent = "💾 Note sauvegardée !";
    setTimeout(() => aiStatus.textContent = "Prêt pour scan", 2000);
};

// Boucle de détection toutes les 800ms
setInterval(capture, 800);

// Optionnel: ajouter un bouton pour tester manuellement
const testBtn = document.createElement('button');
testBtn.textContent = "TEST DÉTECTION";
testBtn.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 1000; padding: 10px;";
testBtn.onclick = capture;
document.body.appendChild(testBtn);
