// --- CONFIGURATION ---
const API_URL = "https://thi-creasy-lightsomely.ngrok-free.dev";
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const noteVal = document.getElementById('note-val');
const btnSave = document.getElementById('btn-save');
const historyList = document.getElementById('history-list');

navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => video.srcObject = stream);

function drawDetections(detections) {
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    detections.forEach(d => {
        const [x1, y1, x2, y2] = d.box.map((v, i) => i % 2 === 0 ? v * overlay.width : v * overlay.height);
        
        // Rectangle néon vert
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Étiquette avec Note et Confiance
        ctx.fillStyle = "#00FF00";
        const label = `${d.text} (${d.conf}%)`;
        ctx.font = "bold 14px Arial";
        const txtWidth = ctx.measureText(label).width;
        
        ctx.fillRect(x1, y1 - 25, txtWidth + 10, 25);
        ctx.fillStyle = "black";
        ctx.fillText(label, x1 + 5, y1 - 7);
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
            const res = await fetch(API_URL + "/detect", { method: 'POST', body: fd });
            const data = await res.json();
            
            if (data.note !== "---") {
                noteVal.innerText = data.note;
                btnSave.disabled = false;
            }
            drawDetections(data.detections || []);
        } catch (e) { console.error("Erreur connexion API"); }
    }, 'image/jpeg', 0.8);
}

btnSave.onclick = () => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${noteVal.innerText}</b> - ${new Date().toLocaleTimeString()}`;
    historyList.insertBefore(li, historyList.firstChild);
    btnSave.disabled = true;
};

setInterval(capture, 1200);// Un peu plus lent pour laisser l'IA réfléchir
