// --- CONFIGURATION ---
const API_URL = "https://thi-creasy-lightsomely.ngrok-free.dev/detect";
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteValue = document.getElementById('note-value');
const btnSave = document.getElementById('btn-save');
const historyList = document.getElementById('history-list');
const countBadge = document.getElementById('detection-count');
const statusDot = document.getElementById('status-dot');

let lastNoteBuffer = [];

navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: "environment", width: 640, height: 640 } 
}).then(stream => { video.srcObject = stream; });

function drawBoxes(detections) {
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    
    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        ctx.strokeRect(x1 * overlay.width, y1 * overlay.height, (x2-x1) * overlay.width, (y2-y1) * overlay.height);
    });
}

async function capture() {
    if (video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 640;
    canvas.getContext('2d').drawImage(video, 0, 0, 640, 640);

    canvas.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append('frame', blob);
        try {
            const res = await fetch(API_URL, { method: 'POST', body: fd });
            const data = await res.json();

            // STABILISATION : On vérifie la cohérence de la note
            if (data.note && data.note !== "---") {
                lastNoteBuffer.push(data.note);
                if (lastNoteBuffer.length > 2) lastNoteBuffer.shift();
                
                // Si les 2 dernières lectures sont identiques, on affiche
                if (lastNoteBuffer[0] === lastNoteBuffer[1]) {
                    noteValue.innerText = data.note;
                    btnSave.disabled = false;
                    statusDot.style.background = "#22c55e";
                }
            }

            countBadge.innerText = `${data.count} Note(s) trouvée(s)`;
            drawBoxes(data.detections || []);
        } catch (e) { statusDot.style.background = "#ef4444"; }
    }, 'image/jpeg', 0.7);
}

btnSave.onclick = () => {
    const li = document.createElement('li');
    li.innerHTML = `<span>Note: <b>${noteValue.innerText}</b></span>`;
    historyList.insertBefore(li, historyList.firstChild);
    window.navigator.vibrate(50);
    btnSave.disabled = true;
    noteValue.innerText = "---";
};

setInterval(capture, 1000); // 1 scan par seconde
