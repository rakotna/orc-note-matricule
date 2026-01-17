const API_URL = "https://NGROK_URL/detect";

const video = document.getElementById("video");
const noteSpan = document.getElementById("note");

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// Accès caméra arrière
navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
})
.then(stream => video.srcObject = stream)
.catch(err => alert("Erreur caméra : " + err));

// Stabilisation (3 frames)
let history = [];

function stableNote(arr) {
    if (arr.length < 3) return null;
    return arr.filter(v => v === arr[0]).length >= 2 ? arr[0] : null;
}

// Capture + envoi frame
setInterval(() => {
    if (video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async blob => {
        const formData = new FormData();
        formData.append("frame", blob);

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (data.note) {
                history.push(data.note);
                history = history.slice(-3);

                const stable = stableNote(history);
                if (stable) noteSpan.textContent = stable;
            }

        } catch (e) {
            console.error("Erreur API", e);
        }

    }, "image/jpeg", 0.7);

}, 1200); // 1 image / seconde
