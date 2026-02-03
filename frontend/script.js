// --- CONFIGURATION ---
const API_URL = "https://thi-creasy-lightsomely.ngrok-free.app";
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteDisplay = document.getElementById('note-display');
const btnSave = document.getElementById('btn-save');
const historyList = document.getElementById('history-list');
const sessionCount = document.getElementById('session-count');
const aiStatus = document.getElementById('ai-status');
const debugStatus = document.getElementById('debug-status');
const fpsCounter = document.getElementById('fps-counter');
const confidenceBadge = document.getElementById('confidence-badge');

let detectionCount = 0;
let isStreaming = false;
let frameCount = 0;
let lastFrameTime = performance.now();
let fps = 0;

// Initialisation de la caméra
async function initCamera() {
    try {
        aiStatus.textContent = "📷 Initialisation caméra...";
        
        const constraints = {
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        return new Promise(resolve => {
            video.onloadedmetadata = () => {
                // Ajuster la taille de l'overlay à la vidéo
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;
                console.log(`Caméra: ${video.videoWidth}x${video.videoHeight}`);
                isStreaming = true;
                aiStatus.textContent = "✅ Caméra prête";
                resolve();
            };
        });
    } catch (error) {
        console.error("Erreur caméra:", error);
        aiStatus.textContent = "❌ Erreur caméra";
        throw error;
    }
}

// Dessiner les détections
function drawDetections(detections) {
    if (!detections || detections.length === 0) {
        // Effacer l'overlay s'il n'y a pas de détections
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        return;
    }
    
    // Effacer le canvas
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    detections.forEach(detection => {
        // Convertir les coordonnées normalisées en pixels
        const x1 = detection.box[0] * overlay.width;
        const y1 = detection.box[1] * overlay.height;
        const x2 = detection.box[2] * overlay.width;
        const y2 = detection.box[3] * overlay.height;
        
        const width = x2 - x1;
        const height = y2 - y1;
        
        // Dessiner un rectangle vert épais avec glow
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#00FF00";
        ctx.shadowBlur = 15;
        ctx.strokeRect(x1, y1, width, height);
        ctx.shadowBlur = 0;
        
        // Ajouter un fond semi-transparent
        ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
        ctx.fillRect(x1, y1, width, height);
        
        // Dessiner le label "NOTE"
        ctx.fillStyle = "#00FF00";
        ctx.font = "bold 18px Arial";
        const label = "NOTE";
        const labelWidth = ctx.measureText(label).width;
        
        // Rectangle de fond pour le label
        ctx.fillRect(x1, y1 - 30, labelWidth + 20, 30);
        
        // Texte du label
        ctx.fillStyle = "#000";
        ctx.fillText(label, x1 + 10, y1 - 8);
        
        // Si une note est détectée, afficher la valeur
        if (detection.text && detection.text !== "---") {
            const noteText = `${detection.text}`;
            const confText = `${detection.conf}%`;
            
            ctx.fillStyle = "#00FF00";
            ctx.font = "bold 22px Arial";
            const noteWidth = ctx.measureText(noteText).width;
            
            // Rectangle de fond pour la note
            ctx.fillRect(x1, y2, noteWidth + 20, 35);
            
            // Texte de la note
            ctx.fillStyle = "#000";
            ctx.fillText(noteText, x1 + 10, y2 + 25);
            
            // Badge de confiance
            ctx.fillStyle = detection.conf > 80 ? "#00FF00" : "#FF9900";
            ctx.font = "bold 14px Arial";
            const confWidth = ctx.measureText(confText).width;
            ctx.fillRect(x2 - confWidth - 15, y1, confWidth + 10, 25);
            ctx.fillStyle = "#000";
            ctx.fillText(confText, x2 - confWidth - 10, y1 + 18);
            
            // Mettre à jour le badge de confiance dans l'UI
            confidenceBadge.textContent = `${detection.conf}%`;
            confidenceBadge.style.background = detection.conf > 80 ? "#00FF00" : "#FF9900";
        }
    });
}

// Capturer et envoyer au backend
async function captureAndDetect() {
    if (!isStreaming || video.readyState !== 4) {
        return;
    }
    
    // Mettre à jour les FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        fpsCounter.textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastFrameTime = now;
    }
    
    try {
        // Créer un canvas temporaire
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const tempCtx = canvas.getContext('2d');
        
        // Dessiner la vidéo (miroir pour correspondre à l'affichage)
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        tempCtx.restore();
        
        // Convertir en blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.9);
        });
        
        if (!blob) {
            debugStatus.textContent = "Erreur: impossible de créer l'image";
            return;
        }
        
        // Préparer la requête
        const formData = new FormData();
        formData.append('frame', blob, 'capture.jpg');
        
        aiStatus.textContent = "🔍 Analyse en cours...";
        
        // Envoyer au backend
        const response = await fetch(`${API_URL}/detect`, {
            method: 'POST',
            body: formData,
            headers: {
                'ngrok-skip-browser-warning': 'true'
            },
            signal: AbortSignal.timeout(5000) // Timeout de 5 secondes
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        debugStatus.textContent = `Détection: ${data.processing_time || 0}ms`;
        
        // Traiter la réponse
        if (data.note && data.note !== "---") {
            // Note détectée avec succès
            noteDisplay.textContent = data.note;
            noteDisplay.classList.add('detected-pulse');
            
            setTimeout(() => {
                noteDisplay.classList.remove('detected-pulse');
            }, 500);
            
            btnSave.disabled = false;
            aiStatus.textContent = `✅ ${data.note} détectée`;
            
            // Jouer un son court
            playDetectionSound();
            
        } else {
            // Aucune note détectée
            aiStatus.textContent = "🔍 Recherche de note...";
            noteDisplay.textContent = "---";
            confidenceBadge.textContent = "0%";
            confidenceBadge.style.background = "#666";
            btnSave.disabled = true;
        }
        
        // Dessiner les détections sur l'overlay
        drawDetections(data.detections || []);
        
    } catch (error) {
        console.error("Erreur détection:", error);
        
        if (error.name === 'AbortError') {
            aiStatus.textContent = "⏱️ Timeout de connexion";
        } else {
            aiStatus.textContent = "❌ Erreur serveur";
        }
        
        // Effacer l'overlay en cas d'erreur
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        noteDisplay.textContent = "---";
        btnSave.disabled = true;
        
        // Réessayer après 2 secondes
        setTimeout(() => {
            aiStatus.textContent = "Réessai...";
        }, 2000);
    }
}

// Son de détection
function playDetectionSound() {
    try {
        // Créer un contexte audio simple
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.05);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        // Silencieux si l'audio n'est pas supporté
    }
}

// Sauvegarder la note
function saveNoteToHistory() {
    const note = noteDisplay.textContent;
    if (note === "---") return;
    
    const now = new Date();
    const listItem = document.createElement('li');
    
    listItem.innerHTML = `
        <span class="history-note">${note}</span>
        <span class="history-time">${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    `;
    
    historyList.insertBefore(listItem, historyList.firstChild);
    
    // Limiter à 10 éléments
    if (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
    
    detectionCount++;
    sessionCount.textContent = `${detectionCount} note${detectionCount !== 1 ? 's' : ''}`;
    
    btnSave.disabled = true;
    aiStatus.textContent = "💾 Note sauvegardée";
    
    // Animation de confirmation
    noteDisplay.style.color = "#4ade80";
    setTimeout(() => {
        noteDisplay.style.color = "#00FF00";
    }, 1000);
    
    setTimeout(() => {
        aiStatus.textContent = "Prêt pour scan";
    }, 1500);
}

// Initialisation
async function initApp() {
    try {
        await initCamera();
        
        // Vérifier la connexion API
        try {
            const healthResponse = await fetch(`${API_URL}/health`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (healthResponse.ok) {
                aiStatus.textContent = "✅ Système prêt";
            }
        } catch (apiError) {
            console.warn("API health check échoué:", apiError);
            aiStatus.textContent = "⚠️ API non disponible";
        }
        
        // Démarrer la boucle de détection (toutes les 800ms)
        setInterval(captureAndDetect, 800);
        
        // Première détection après 1 seconde
        setTimeout(captureAndDetect, 1000);
        
    } catch (error) {
        console.error("Erreur initialisation:", error);
        aiStatus.textContent = "❌ Erreur initialisation";
    }
}

// Événements
btnSave.addEventListener('click', saveNoteToHistory);

// Touche Espace pour sauvegarder
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !btnSave.disabled) {
        e.preventDefault();
        saveNoteToHistory();
    }
    
    // Touche 'D' pour forcer une détection (debug)
    if (e.code === 'KeyD') {
        e.preventDefault();
        captureAndDetect();
    }
});

// Démarrer l'application
window.addEventListener('DOMContentLoaded', initApp);
