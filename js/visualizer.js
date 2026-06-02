/**
 * Kelas untuk menggambar arsitektur Jaringan Saraf Tiruan secara real-time.
 */
class Visualizer {
    /**
     * Menggambar struktur jaringan saraf ke canvas visualizer.
     * @param {HTMLCanvasElement} canvas - Canvas target visualisasi.
     * @param {NeuralNetwork} network - Jaringan saraf yang divisualisasikan.
     */
    static drawNetwork(canvas, network) {
        if (!network || !network.levels || network.levels.length === 0) return;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const margin = 35;
        const width = canvas.width - margin * 2;
        const height = canvas.height - margin * 2;

        const levelsCount = network.levels.length;
        const levelWidth = width / (levelsCount);

        // Kumpulkan semua koordinat neuron untuk penggambaran koneksi (bobot)
        const nodeCoordinates = [];

        // 1. Hitung koordinat semua neuron di setiap kolom (layer)
        for (let i = 0; i <= levelsCount; i++) {
            const isOutputLayer = (i === levelsCount);
            
            // Tentukan jumlah neuron di layer ini
            let nodeCount = 0;
            let nodeOutputs = [];
            if (!isOutputLayer) {
                nodeCount = network.levels[i].inputs.length;
                nodeOutputs = network.levels[i].inputs;
            } else {
                nodeCount = network.levels[i - 1].outputs.length;
                nodeOutputs = network.levels[i - 1].outputs;
            }

            const x = margin + i * levelWidth;
            const coords = [];

            for (let j = 0; j < nodeCount; j++) {
                // Distribusikan neuron secara vertikal
                const y = margin + (nodeCount > 1 ? (j / (nodeCount - 1)) * height : height / 2);
                coords.push({ x, y, value: nodeOutputs[j] || 0 });
            }
            nodeCoordinates.push(coords);
        }

        // 2. Gambar koneksi (bobot/weights) antarlapisan terlebih dahulu agar berada di bawah lingkaran neuron
        for (let i = 0; i < levelsCount; i++) {
            const level = network.levels[i];
            const currentLayerCoords = nodeCoordinates[i];
            const nextLayerCoords = nodeCoordinates[i + 1];

            for (let j = 0; j < level.inputs.length; j++) {
                for (let k = 0; k < level.outputs.length; k++) {
                    const weight = level.weights[j][k];
                    const start = currentLayerCoords[j];
                    const end = nextLayerCoords[k];

                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);

                    // Ketebalan garis sebanding dengan besar bobot mutlak
                    ctx.lineWidth = Math.abs(weight) * 2.5;

                    // Warna koneksi: Cyan jika positif, Merah/Magenta jika negatif
                    if (weight > 0) {
                        ctx.strokeStyle = `rgba(0, 242, 254, ${Math.abs(weight) * 0.4})`; // Cyan neon
                    } else {
                        ctx.strokeStyle = `rgba(239, 68, 68, ${Math.abs(weight) * 0.4})`; // Merah neon
                    }
                    ctx.stroke();
                }
            }
        }

        // 3. Gambar lingkaran neuron dan label teks pendukung
        const sensorCount = network.levels[0].inputs.length - 3; // Kurangi 3 input tambahan (target + speed)

        for (let i = 0; i < nodeCoordinates.length; i++) {
            const layerCoords = nodeCoordinates[i];
            const isInputLayer = (i === 0);
            const isOutputLayer = (i === nodeCoordinates.length - 1);

            for (let j = 0; j < layerCoords.length; j++) {
                const node = layerCoords[j];

                // Hitung pendaran (glow) lingkaran berdasarkan nilai aktivasi neuron
                // Nilai berkisar antara -1 s.d 1
                ctx.save();
                ctx.beginPath();
                ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);

                const activeVal = node.value; // -1 s.d 1
                
                // Isi lingkaran: jika aktif (positif) berwarna putih-cyan bersinar, jika negatif redup/gelap
                if (activeVal > 0) {
                    ctx.fillStyle = `rgba(0, 242, 254, ${0.3 + activeVal * 0.7})`;
                    ctx.shadowColor = "rgba(0, 242, 254, 0.8)";
                    ctx.shadowBlur = 6;
                } else {
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.1 + Math.abs(activeVal) * 0.4})`;
                    ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
                    ctx.shadowBlur = 4;
                }
                ctx.fill();

                // Lingkaran pembatas
                ctx.strokeStyle = activeVal > 0 ? "#ffffff" : "#475569";
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();

                // Tulis label teks untuk memperjelas input/output
                if (isInputLayer || isOutputLayer) {
                    ctx.fillStyle = "#94a3b8";
                    ctx.font = "bold 9px 'Space Grotesk'";
                    ctx.textBaseline = "middle";

                    let label = "";
                    if (isInputLayer) {
                        ctx.textAlign = "right";
                        if (j < sensorCount) {
                            label = `S${j + 1}`; // Label sensor raycast
                        } else if (j === sensorCount) {
                            label = "T_sin"; // Sudut target sin
                        } else if (j === sensorCount + 1) {
                            label = "T_cos"; // Sudut target cos
                        } else if (j === sensorCount + 2) {
                            label = "Speed"; // Kecepatan
                        }
                        ctx.fillText(label, node.x - 12, node.y);
                    } else if (isOutputLayer) {
                        ctx.textAlign = "left";
                        if (j === 0) {
                            label = "Gas/Thrust";
                        } else if (j === 1) {
                            label = "Kemudi/Steer";
                        }
                        ctx.fillText(label, node.x + 12, node.y);
                    }
                }
            }
        }
    }
}
