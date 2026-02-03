// ============================================================================
// CONFIGURATION - IMPORTANT : MODIFIEZ CETTE URL !
// ============================================================================
// ⚠️ REMPLACEZ PAR L'URL NGROK OBTENUE DANS COLAB ⚠️
const API_URL = "https://thi-creasy-lightsomely.ngrok-free.dev/";  // ← À MODIFIER

// Éléments DOM
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteDisplay = document.getElementById('note-display');
const btnSave = document.getElementById('btn-save');
const btnTest = document.getElementById('btn-test');
const btnManual = document.getElementById('btn-manual');
const historyList = document.getElementById('history-list');
const sessionCount = document.getElementById('session-count');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const statusIndicator = document.getElementById('status-indicator');
const debugInfo = document.getElementById('debug-info');
const apiUrlDisplay = document.getElementById('current-api-url');
const confidenceBadge = document.getElementById('confidence-badge');

// Variables globales
let detectionCount = 0;
let isStreaming = false;
let isProcessing = false;
let apiConnected = false;
let detectionInterval = null;
let currentAPIUrl = API_URL;

// ============================================================================
// INITIALISATION
// ============================================================================
async function initializeApp() {
    console.log("🚀 Initialisation de NoteScanner...");
    
    // Afficher l'URL API utilisée
    apiUrlDisplay.textContent = currentAPIUrl;
    console.log(`🌐 URL API configurée: ${currentAPIUrl}`);
    
    // 1. Vérifier la connexion API
    await checkAPIHealth();
    
    // 2. Initialiser la caméra
    await initializeCamera();
    
    // 3. Démarrer la détection automatique
    if (apiConnected && isStreaming) {
        startDetectionLoop();
    }
}

// ============================================================================
// GESTION API
// ============================================================================
async function checkAPIHealth() {
    updateStatus("Connexion au serveur...", "connecting");
    
    try {
        const response = await fetch(`${currentAPIUrl}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            mode: 'cors',
            cache: 'no-store'
        });
        
        if (response.ok) {
            const data = await response.json();
            
            apiConnected = true;
            updateStatus(`✅ Connecté au serveur (${data.gpu ? 'GPU' : 'CPU'})`, "connected");
            
            debugInfo.textContent = `Serveur: ${data.status} | OCR: ${data.ocr || 'ready'}`;
            
            return true;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error("❌ Erreur connexion API:", error);
        
        apiConnected = false;
        updateStatus(`❌ Serveur hors ligne: ${error.message}`, "error");
        
        debugInfo.textContent = `Erreur: ${error.message}. Vérifiez que le backend Colab est actif.`;
        
        return false;
    }
}

function updateStatus(message, type) {
    connectionText.textContent = message;
    connectionStatus.className = `connection-status ${type}`;
    statusIndicator.className = `status-indicator ${type}`;
}

// ============================================================================
// GESTION CAMÉRA
// ============================================================================
async function initializeCamera() {
    try {
        updateStatus("Initialisation caméra...", "connecting");
        
        // Demander l'accès à la caméra
        const constraints = {
            video: {
                facingMode: "environment",  // Caméra arrière
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // Attendre que la vidéo soit prête
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                // Ajuster l'overlay à la taille de la vidéo
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;
                
                console.log(`📷 Caméra initialisée: ${video.videoWidth}x${video.videoHeight}`);
                isStreaming = true;
                resolve();
            };
        });
        
        return true;
        
    } catch (error) {
        console.error("❌ Erreur caméra:", error);
        
        updateStatus("❌ Erreur d'accès à la caméra", "error");
        debugInfo.textContent = `Erreur caméra: ${error.message}`;
        
        // Mode démo sans caméra
        showDemoMode();
        return false;
    }
}

function showDemoMode() {
    debugInfo.textContent += " | Mode démo activé";
    noteDisplay.textContent = "14.5/20";
    btnSave.disabled = false;
    
    // Simuler une détection
    setTimeout(() => {
        drawDemoDetection();
    }, 1000);
}

function drawDemoDetection() {
    // Dessiner une détection de démo
    const x1 = overlay.width * 0.3;
    const y1 = overlay.height * 0.3;
    const width = overlay.width * 0.4;
    const height = overlay.height * 0.4;
    
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;
    ctx.strokeRect(x1, y1, width, height);
    
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 16px Arial";
    ctx.fillText("NOTE (DÉMO)", x1 + 10, y1 - 10);
}

// ============================================================================
// DÉTECTION ET OCR
// ============================================================================
async function captureAndDetect() {
    if (!isStreaming || !apiConnected || isProcessing) return;
    
    isProcessing = true;
    
    try {
        debugInfo.textContent = "Capture en cours...";
        
        // Capturer une frame
        const imageBlob = await captureFrame();
        if (!imageBlob) return;
        
        // Envoyer au serveur
        const result = await sendToBackend(imageBlob);
        
        if (result) {
            processDetectionResult(result);
        }
        
    } catch (error) {
        console.error("Erreur détection:", error);
        debugInfo.textContent = `Erreur: ${error.message}`;
    } finally {
        isProcessing = false;
    }
}

async function captureFrame() {
    if (!isStreaming || video.readyState !== 4) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const tempCtx = canvas.getContext('2d');
    
    // Miroir horizontal pour correspondre à l'affichage
    tempCtx.translate(canvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
    });
}

async function sendToBackend(imageBlob) {
    const formData = new FormData();
    formData.append('frame', imageBlob, 'capture.jpg');
    
    try {
        const response = await fetch(`${currentAPIUrl}/detect`, {
            method: 'POST',
            body: formData,
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error("Erreur backend:", error);
        
        // Si erreur de connexion, vérifier l'état de l'API
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            apiConnected = false;
            updateStatus("❌ Connexion perdue", "error");
        }
        
        return null;
    }
}

function processDetectionResult(result) {
    debugInfo.textContent = `Traitement: ${result.processing_time_ms || 0}ms`;
    
    // Effacer l'overlay précédent
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Traiter la note
    if (result.note && result.note !== "---") {
        // Mettre à jour l'affichage
        noteDisplay.textContent = result.note;
        noteDisplay.classList.add('detected-pulse');
        
        setTimeout(() => {
            noteDisplay.classList.remove('detected-pulse');
        }, 500);
        
        // Activer le bouton sauvegarde
        btnSave.disabled = false;
        
        // Mettre à jour le badge de confiance
        if (result.detections && result.detections.length > 0) {
            const confidence = result.detections[0].conf;
            confidenceBadge.textContent = `${confidence}%`;
            confidenceBadge.style.background = confidence > 80 ? "#00ff00" : "#ff9900";
            
            // Dessiner la détection
            drawDetection(result.detections[0]);
        }
        
        updateStatus(`✅ ${result.note} détectée`, "connected");
        
    } else {
        noteDisplay.textContent = "---";
        btnSave.disabled = true;
        confidenceBadge.textContent = "0%";
        confidenceBadge.style.background = "#666";
        
        updateStatus("🔍 Recherche de note...", "connected");
    }
}

function drawDetection(detection) {
    const [x1, y1, x2, y2] = detection.box;
    const conf = detection.conf;
    const text = detection.text;
    
    const px1 = x1 * overlay.width;
    const py1 = y1 * overlay.height;
    const px2 = x2 * overlay.width;
    const py2 = y2 * overlay.height;
    
    const width = px2 - px1;
    const height = py2 - py1;
    
    // Rectangle de détection
    ctx.strokeStyle = conf > 80 ? "#00ff00" : "#ff9900";
    ctx.lineWidth = 3;
    ctx.strokeRect(px1, py1, width, height);
    
    // Label en haut
    ctx.fillStyle = conf > 80 ? "#00ff00" : "#ff9900";
    ctx.font = "bold 16px Arial";
    ctx.fillRect(px1, py1 - 25, 70, 25);
    
    ctx.fillStyle = "#000";
    ctx.fillText("NOTE", px1 + 5, py1 - 8);
    
    // Note en bas
    if (text && text !== "---") {
        ctx.fillStyle = conf > 80 ? "#00ff00" : "#ff9900";
        ctx.font = "bold 18px Arial";
        ctx.fillRect(px1, py2, 100, 30);
        
        ctx.fillStyle = "#000";
        ctx.fillText(text, px1 + 5, py2 + 20);
    }
}

// ============================================================================
# BOUCLE DE DÉTECTION
# ============================================================================
function startDetectionLoop() {
    // Arrêter l'intervalle existant
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    
    // Démarrer toutes les 1.5 secondes
    detectionInterval = setInterval(() => {
        if (apiConnected && isStreaming && !isProcessing) {
            captureAndDetect();
        }
    }, 1500);
    
    updateStatus("✅ Système prêt - Détection active", "connected");
}

// ============================================================================
# GESTION HISTORIQUE
# ============================================================================
function saveToHistory() {
    const note = noteDisplay.textContent;
    if (note === "---") return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const historyItem = document.createElement('li');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <span class="history-note">${note}</span>
        <span class="history-time">${timeString}</span>
    `;
    
    // Ajouter au début
    historyList.insertBefore(historyItem, historyList.firstChild);
    
    // Limiter à 10 éléments
    while (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
    
    // Mettre à jour le compteur
    detectionCount++;
    sessionCount.textContent = `${detectionCount} note${detectionCount !== 1 ? 's' : ''}`;
    
    // Désactiver le bouton
    btnSave.disabled = true;
    
    // Feedback
    updateStatus("💾 Note sauvegardée", "connected");
    setTimeout(() => {
        if (apiConnected) {
            updateStatus("✅ Prêt pour scan", "connected");
        }
    }, 2000);
}

# ============================================================================
# ÉVÉNEMENTS
# ============================================================================
btnSave.addEventListener('click', saveToHistory);

btnTest.addEventListener('click', async () => {
    updateStatus("Test de connexion...", "connecting");
    const connected = await checkAPIHealth();
    
    if (connected) {
        alert("✅ Connexion API réussie !");
    } else {
        alert("❌ Échec de connexion. Vérifiez le backend Colab.");
    }
});

btnManual.addEventListener('click', () => {
    if (apiConnected && isStreaming) {
        updateStatus("Détection manuelle...", "connecting");
        captureAndDetect();
    } else {
        alert("Veuillez d'abord initialiser la caméra et vérifier la connexion API.");
    }
});

// Touche Espace pour sauvegarder
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !btnSave.disabled) {
        e.preventDefault();
        saveToHistory();
    }
    
    // Touche D pour détection manuelle
    if (e.code === 'KeyD') {
        e.preventDefault();
        if (apiConnected && isStreaming) {
            captureAndDetect();
        }
    }
});

// ============================================================================
# DÉMARRAGE
# ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("📄 Page chargée, démarrage de l'application...");
    initializeApp();
});
