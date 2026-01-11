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

// 2️⃣ Capture et traitement périodique
setInterval(() => {
    // Taille du canvas = taille vidéo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Copier l'image vidéo dans le canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Définir la zone de détection (bounding box)
    const bbox = {
        x: canvas.width/2 - 60,  // cadre centré
        y: 150,                  // position verticale
        width: 120,
        height: 50
    };

    // Extraire la zone (crop)
    const crop = ctx.getImageData(bbox.x, bbox.y, bbox.width, bbox.height);

    // Pour l’instant, juste afficher la zone sur le canvas (debug)
    // ctx.putImageData(crop, 0, 0); // optionnel

    // Simuler envoi au serveur OCR
    // Ici tu peux convertir crop en blob ou base64 pour envoi POST
    // Ex: sendToOCR(crop);

    result.innerText = "Zone prête pour OCR (numéro/note)";
}, 500); // toutes les 0.5s
