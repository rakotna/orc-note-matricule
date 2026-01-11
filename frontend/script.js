const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const result = document.getElementById("result");

// Ouvrir la caméra
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
.then(stream => video.srcObject = stream)
.catch(err => alert("Erreur caméra: " + err));

// Fonction pour envoyer zone au serveur OCR
async function sendToOCR(crop) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = crop.width;
    tempCanvas.height = crop.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(crop, 0, 0);

    const dataURL = tempCanvas.toDataURL("image/jpeg");

    try {
        const response = await fetch("https://thi-creasy-lightsomely.ngrok-free.dev/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataURL })
        });
        const data = await response.json();
        if(data.error){
            result.innerText = "Erreur OCR: " + data.error;
        } else {
            result.innerText = "Matricule : " + data.matricule + "\nNote : " + data.note;
        }
    } catch(err){
        console.error(err);
        result.innerText = "Erreur serveur";
    }
}

// Capture périodique
setInterval(() => {
    if(video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // --- Zone matricule ---
    const bboxMatricule = { x: canvas.width/2 - 80, y: 130, width: 160, height: 50 };
    const cropMatricule = ctx.getImageData(bboxMatricule.x, bboxMatricule.y, bboxMatricule.width, bboxMatricule.height);
    sendToOCR(cropMatricule);

    // --- Zone note ---
    const bboxNote = { x: canvas.width/2 - 80, y: 200, width: 160, height: 50 };
    const cropNote = ctx.getImageData(bboxNote.x, bboxNote.y, bboxNote.width, bboxNote.height);
    sendToOCR(cropNote);

}, 1000); // 1 frame / seconde
