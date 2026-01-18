// --- CONFIGURATION ---
const API_URL = "https://thi-creasy-lightsomely.ngrok-free.dev";

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteDisplay = document.getElementById('note-display');
const btnSave = document.getElementById('btn-save');
const historyList = document.getElementById('history-list');

navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(s => video.srcObject = s);

function drawUI(detections) {
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    detections.forEach(d => {
        const [x1, y1, x2, y2] = d.box.map((val, i) => i % 2 === 0 ? val * overlay.width : val * overlay.height);
        const w = x2 - x1;
        const h = y2 - y1;

        // 1. Dessiner le rectangle néon
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, w, h);

        // 2. Dessiner le label (Fond vert)
        ctx.fillStyle = "#22c55e";
        const label = `NOTE: ${d.text} (${d.conf}%)`;
        const txtWidth = ctx.measureText(label).width;
        ctx.fillRect(x1, y1 - 25, txtWidth + 10, 25);

        // 3. Texte du label
        ctx.fillStyle = "black";
        ctx.font = "bold 14px Arial";
        ctx.fillText(label, x1 + 5, y1 - 7);
    });
}

async function scan() {
    if (video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 640;
    canvas.getContext('2d').drawImage(video, 0, 0, 640, 640);

    canvas.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append('frame', blob);
        try {
            const r = await fetch(API_URL + "/detect", { method: 'POST', body: fd });
            const data = await r.json();
            
            if (data.note !== "---") {
                noteDisplay.innerText = data.note;
                btnSave.disabled = false;
            }
            drawUI(data.detections);
        } catch (e) { console.log("Erreur API"); }
    }, 'image/jpeg', 0.8);
}

btnSave.onclick = () => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${noteDisplay.innerText}</b> - ${new Date().toLocaleTimeString()}`;
    historyList.insertBefore(li, historyList.firstChild);
    btnSave.disabled = true;
};

setInterval(scan, 1200); // Un peu plus lent pour laisser l'IA réfléchir
