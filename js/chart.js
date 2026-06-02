/**
 * Kelas untuk merender grafik garis kustom dari sejarah data kemajuan evolusi.
 */
class EvolutionChart {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.history = []; // Menyimpan data { generation, maxFitness, avgFitness, successCount, popSize }
    }

    /**
     * Menambahkan entri data baru ke dalam riwayat grafik dan menggambar ulang.
     */
    addData(generation, maxFitness, avgFitness, successCount, popSize) {
        this.history.push({
            generation,
            maxFitness,
            avgFitness,
            successCount,
            popSize
        });
        this.draw();
    }

    /**
     * Mereset data grafik.
     */
    reset() {
        this.history = [];
        this.draw();
    }

    /**
     * Menggambar grafik ke Canvas.
     */
    draw() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const paddingLeft = 40;
        const paddingRight = 15;
        const paddingTop = 15;
        const paddingBottom = 25;

        const chartWidth = canvas.width - paddingLeft - paddingRight;
        const chartHeight = canvas.height - paddingTop - paddingBottom;

        // 1. Gambar Grid Background
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        
        // Garis Horizontal Grid (5 tingkat)
        for (let i = 0; i <= 4; i++) {
            const y = paddingTop + (i / 4) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(canvas.width - paddingRight, y);
            ctx.stroke();
        }

        // Tampilkan teks jika belum ada data generasi
        if (this.history.length === 0) {
            ctx.fillStyle = "#64748b";
            ctx.font = "12px 'Outfit'";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Menunggu pergantian generasi...", canvas.width / 2, canvas.height / 2);
            return;
        }

        // 2. Cari Nilai Maksimal untuk Skala Vertikal (Y-axis scaling)
        let maxFitVal = 0.1;
        this.history.forEach(d => {
            if (d.maxFitness > maxFitVal) maxFitVal = d.maxFitness;
            if (d.avgFitness > maxFitVal) maxFitVal = d.avgFitness;
        });

        // Berikan sedikit buffer di atas nilai maksimal
        maxFitVal *= 1.1;

        const dataPointsCount = this.history.length;

        // 3. Gambar Batang Jumlah Sukses (Success Rates) di latar belakang
        this.history.forEach((data, index) => {
            const x = paddingLeft + (dataPointsCount > 1 
                ? (index / (dataPointsCount - 1)) * (chartWidth - 10) 
                : chartWidth / 2 - 5);
            
            // Normalisasi jumlah sukses terhadap ukuran populasi
            const successRatio = data.successCount / (data.popSize || 100);
            const barHeight = successRatio * chartHeight;
            const y = canvas.height - paddingBottom - barHeight;

            ctx.fillStyle = "rgba(168, 85, 247, 0.15)"; // Purple transparan
            ctx.fillRect(x - 3, y, 6, barHeight);
        });

        // 4. Gambar Garis Tren Rata-rata Fitness (Average Fitness - Green)
        ctx.beginPath();
        this.history.forEach((data, index) => {
            const x = paddingLeft + (dataPointsCount > 1 
                ? (index / (dataPointsCount - 1)) * (chartWidth - 10) 
                : chartWidth / 2);
            const y = canvas.height - paddingBottom - (data.avgFitness / maxFitVal) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.strokeStyle = "#10b981"; // Green neon
        ctx.lineWidth = 2;
        ctx.stroke();

        // 5. Gambar Garis Tren Fitness Tertinggi (Max Fitness - Cyan)
        ctx.beginPath();
        this.history.forEach((data, index) => {
            const x = paddingLeft + (dataPointsCount > 1 
                ? (index / (dataPointsCount - 1)) * (chartWidth - 10) 
                : chartWidth / 2);
            const y = canvas.height - paddingBottom - (data.maxFitness / maxFitVal) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.strokeStyle = "#00f2fe"; // Cyan neon
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(0, 242, 254, 0.4)";
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        // 6. Gambar Titik-titik Data (jika data sedikit agar lebih kelihatan)
        if (dataPointsCount < 30) {
            this.history.forEach((data, index) => {
                const x = paddingLeft + (dataPointsCount > 1 
                    ? (index / (dataPointsCount - 1)) * (chartWidth - 10) 
                    : chartWidth / 2);
                
                const yMax = canvas.height - paddingBottom - (data.maxFitness / maxFitVal) * chartHeight;
                ctx.beginPath();
                ctx.arc(x, yMax, 3, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.strokeStyle = "#00f2fe";
                ctx.stroke();
            });
        }

        // 7. Render Teks Sumbu Y (Nilai Fitness)
        ctx.fillStyle = "#64748b";
        ctx.font = "9px 'Space Grotesk'";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        ctx.fillText(maxFitVal.toFixed(0), paddingLeft - 8, paddingTop);
        ctx.fillText((maxFitVal / 2).toFixed(0), paddingLeft - 8, paddingTop + chartHeight / 2);
        ctx.fillText("0", paddingLeft - 8, canvas.height - paddingBottom);

        // 8. Render Teks Sumbu X (Generasi)
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        // Hanya tampilkan label generasi pertama, tengah, dan terakhir jika data banyak
        if (dataPointsCount > 0) {
            const firstGen = this.history[0].generation;
            const lastGen = this.history[dataPointsCount - 1].generation;
            
            ctx.fillText(`Gen ${firstGen}`, paddingLeft, canvas.height - paddingBottom + 6);
            
            if (dataPointsCount > 2) {
                const midIndex = Math.floor(dataPointsCount / 2);
                const midGen = this.history[midIndex].generation;
                const midX = paddingLeft + (midIndex / (dataPointsCount - 1)) * (chartWidth - 10);
                ctx.fillText(`Gen ${midGen}`, midX, canvas.height - paddingBottom + 6);
            }
            
            if (dataPointsCount > 1) {
                ctx.fillText(`Gen ${lastGen}`, paddingLeft + chartWidth - 10, canvas.height - paddingBottom + 6);
            }
        }
    }
}
