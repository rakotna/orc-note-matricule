const API_URL = "https://thi-creasy-lightsomely.ngrok-free.dev"; // METTRE A JOUR
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteValue = document.getElementById('note-value');
const statusDot = document.getElementById('status-dot');

// 1. Accès caméra arrière avec haute résolution
navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } } 
}).then(stream => { video.srcObject = stream; });

// 2. Fonction pour dessiner les boîtes YOLO
function drawDetections(detections) {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box; // Coordonnées relatives (0 à 1)
        
        // Conversion des coordonnées relatives en pixels selon la taille du canvas
        const bx = x1 * overlay.width;
        const by = y1 * overlay.height;
        const bw = (x2 - x1) * overlay.width;
        const bh = (y2 - y1) * overlay.height;

        // Dessin du rectangle
        ctx.strokeStyle = "#22c55e"; // Vert
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, bw, bh);

        // Label de confiance
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(`NOTE ${Math.round(det.conf * 100)}%`, bx, by - 5);
    });
}

// 3. Capture et envoi vers Colab
async function captureFrame() {
    if (video.videoWidth === 0) return;

    // Ajuster le canvas de dessin à la taille de la vidéo affichée
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    captureCanvas.getContext('2d').drawImage(video, 0, 0);

    captureCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('frame', blob);

        try {
            statusDot.style.background = "#eab308"; // Jaune (en cours)
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            const data = await response.json();

            if (data.note && data.note !== "---") {
                if (noteValue.innerText !== data.note) {
                    window.navigator.vibrate(50); // Vibration sur Android
                }
                noteValue.innerText = data.note;
                statusDot.style.background = "#22c55e"; // Vert (succès)
            }

            // Dessiner les boîtes YOLO renvoyées par le serveur
            if (data.detections) {
                drawDetections(data.detections);
            }

        } catch (e) {
            statusDot.style.background = "#ef4444"; // Rouge (erreur)
            console.error("Erreur API");
        }
    }, 'image/jpeg', 0.6);
}

// Lancement toutes les 800ms
setInterval(captureFrame, 800);
