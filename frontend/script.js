const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const result = document.getElementById("result");

// 1️⃣ Ouvrir caméra
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
.then(stream => video.srcObject = stream)
.catch(err => alert("Erreur caméra: " + err));

// 2️⃣ Fonction pour envoyer frame au backend
async function sendFrame() {
    if(video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL("image/jpeg");

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

// 3️⃣ Envoyer frame toutes les 0.5s
setInterval(sendFrame, 500);
