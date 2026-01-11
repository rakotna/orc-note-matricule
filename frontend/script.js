const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const result = document.getElementById("result");

// 1️⃣ Ouvrir la caméra
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
.then(stream => {
    video.srcObject = stream;
})
.catch(err => alert("Erreur caméra: " + err));

// 2️⃣ Fonction pour envoyer zone au serveur OCR
async function sendToOCR(crop) {
    // Convertir crop en image base64
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

    } catch (err) {
        console.error(err);
        result.innerText = "Erreur serveur";
    }
}

// 3️⃣ Capture périodique de la zone
setInterval(() => {
    if(video.videoWidth === 0 || video.videoHeight === 0) return;

    // Taille du canvas = taille vidéo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Copier l'image vidéo dans le canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Zone de détection (bounding box)
    const bbox = {
        x: canvas.width/2 - 60,  // cadre centré horizontalement
        y: 150,                  // position verticale du cadre
        width: 120,
        height: 50
    };

    // Extraire la zone
    const crop = ctx.getImageData(bbox.x, bbox.y, bbox.width, bbox.height);

    // Envoi au serveur OCR
    sendToOCR(crop);

}, 1000); // toutes les 1s
