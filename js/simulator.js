// Ambil referensi elemen DOM
const simCanvas = document.getElementById("sim-canvas");
const nnCanvas = document.getElementById("nn-canvas");
const chartCanvas = document.getElementById("chart-canvas");

const btnPlayPause = document.getElementById("btn-play-pause");
const btnRestart = document.getElementById("btn-restart");
const speedSlider = document.getElementById("speed-slider");
const speedVal = document.getElementById("speed-val");

const agentTypeSelect = document.getElementById("agent-type-select");
const toggleSensors = document.getElementById("toggle-sensors");
const toggleBestOnly = document.getElementById("toggle-best-only");

const popSizeSlider = document.getElementById("pop-size-slider");
const popSizeVal = document.getElementById("pop-size-val");
const mutationSlider = document.getElementById("mutation-slider");
const mutationVal = document.getElementById("mutation-val");
const sensorSlider = document.getElementById("sensor-count-slider");
const sensorVal = document.getElementById("sensor-count-val");

const dynamicObsSlider = document.getElementById("dynamic-obs-slider");
const dynamicObsVal = document.getElementById("dynamic-obs-val");
const btnClearWalls = document.getElementById("btn-clear-walls");

const btnSaveBrain = document.getElementById("btn-save-brain");
const btnLoadBrain = document.getElementById("btn-load-brain");

const genCountText = document.getElementById("gen-count");
const bestFitnessText = document.getElementById("best-fitness");
const successRateText = document.getElementById("success-rate");
const aliveCountText = document.getElementById("alive-count");

// Context Canvas
const ctxSim = simCanvas.getContext("2d");

// Variabel Utama Simulasi
let isPlaying = true;
let speedMultiplier = 1;
let generation = 1;
let currentSteps = 0;
const maxStepsPerGen = 700; // Batas langkah sebelum generasi di-reset

let spawnPos = { x: 80, y: 300 };
let target = { x: 680, y: 300, radius: 20 };
let startDistance = 600; // Jarak awal spawn ke target

let population = [];
let walls = [];
let userWalls = []; // Dinding buatan user
let dynamicObstacles = [];

// Riwayat data
let chartVisualizer = null;
let savedBrainData = null; // Menyimpan otak terbaik secara memori

// Pengaturan Menggambar Obstacle
let isDrawing = false;
let lastMousePos = { x: 0, y: 0 };
let currentCanvasMode = "draw"; // draw, erase, target

/**
 * Inisialisasi Canvas dan Tata Letak Awal
 */
function initLayout() {
    const rect = simCanvas.parentElement.getBoundingClientRect();
    simCanvas.width = rect.width;
    simCanvas.height = rect.height;

    // Canvas visualizer saraf disesuaikan ukurannya
    const nnRect = nnCanvas.parentElement.getBoundingClientRect();
    nnCanvas.width = nnRect.width;
    nnCanvas.height = 250;

    // Canvas chart disesuaikan ukurannya
    const chartRect = chartCanvas.parentElement.getBoundingClientRect();
    chartCanvas.width = chartRect.width;
    chartCanvas.height = 150;

    // Atur ulang posisi spawn dan target di tengah layar
    spawnPos = { x: 80, y: simCanvas.height / 2 };
    target = { x: simCanvas.width - 90, y: simCanvas.height / 2, radius: 20 };
    startDistance = Math.hypot(target.x - spawnPos.x, target.y - spawnPos.y);

    initObstacles();
}

/**
 * Inisialisasi Dinding Pembatas & Rintangan Bawaan
 */
function initObstacles() {
    walls = [];
    
    // Dinding pembatas luar canvas
    const margin = 8;
    const w = simCanvas.width;
    const h = simCanvas.height;
    
    walls.push(new Wall(margin, margin, w - margin, margin, true)); // Atas
    walls.push(new Wall(w - margin, margin, w - margin, h - margin, true)); // Kanan
    walls.push(new Wall(w - margin, h - margin, margin, h - margin, true)); // Bawah
    walls.push(new Wall(margin, h - margin, margin, margin, true)); // Kiri

    // Rintangan bawaan agar ada tantangan awal (tata letak labirin sederhana)
    // Dinding tengah berbentuk celah/gerbang
    const midX = w / 2;
    walls.push(new Wall(midX, margin, midX, h * 0.35));
    walls.push(new Wall(midX, h * 0.65, midX, h - margin));

    // Sinkronkan rintangan buatan user yang sudah ada
    walls = [...walls, ...userWalls];

    // Sinkronkan jumlah rintangan bergerak (Dynamic Obstacles)
    updateDynamicObstaclesCount();
}

/**
 * Menghasilkan rintangan bergerak sesuai nilai slider
 */
function updateDynamicObstaclesCount() {
    const targetCount = parseInt(dynamicObsSlider.value);
    
    // Sesuaikan jumlah rintangan bergerak
    if (dynamicObstacles.length < targetCount) {
        // Tambahkan rintangan dinamis baru
        const margin = 30;
        const w = simCanvas.width;
        const h = simCanvas.height;

        while (dynamicObstacles.length < targetCount) {
            const rad = 20 + Math.random() * 15;
            // Spawn di area tengah agar tidak langsung menindih spawn agen
            const rx = w * 0.3 + Math.random() * (w * 0.4);
            const ry = h * 0.15 + Math.random() * (h * 0.7);
            
            // Kecepatan gerak acak
            const sx = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2);
            const sy = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2);

            dynamicObstacles.push(
                new DynamicObstacle(rx, ry, rad, sx, sy, margin, w - margin, margin, h - margin)
            );
        }
    } else if (dynamicObstacles.length > targetCount) {
        dynamicObstacles.splice(targetCount);
    }
}

/**
 * Memulai Populasi Agen
 */
function initPopulation(loadBrain = null) {
    const popSize = parseInt(popSizeSlider.value);
    const sensorCount = parseInt(sensorSlider.value);
    
    population = [];
    for (let i = 0; i < popSize; i++) {
        const agent = new Agent(spawnPos.x, spawnPos.y, sensorCount);
        
        // Jika ada otak acuan yang mau dimuat (hasil load simpanan)
        if (loadBrain) {
            agent.brain = NeuralNetwork.clone(loadBrain);
            // Lakukan mutasi sedikit (kecuali agen pertama sebagai elit)
            if (i > 0) {
                NeuralNetwork.mutate(agent.brain, 0.15, 0.25);
            }
        }
        
        population.push(agent);
    }
    currentSteps = 0;
}

/**
 * Mendapatkan agen yang memiliki performa terbaik saat ini.
 */
function getBestAgent() {
    let bestAgent = population[0];
    let maxFit = -Infinity;

    // Hitung progress sementara untuk agen yang masih hidup/mati
    population.forEach(agent => {
        // Tentukan progress: jarak terdekat ke target
        const minDist = agent.minDistanceToTarget;
        let tempFitness = 0;

        if (agent.reachedTarget) {
            tempFitness = 10000 - agent.stepsTaken;
        } else {
            // Makin dekat ke target, fitness makin tinggi
            tempFitness = Math.max(0, startDistance - minDist);
        }

        if (tempFitness > maxFit) {
            maxFit = tempFitness;
            bestAgent = agent;
        }
    });

    return bestAgent;
}

/**
 * Memproses Satu Frame Langkah Fisika Simulasi
 */
function updatePhysics() {
    let allFinished = true;
    let aliveCount = 0;

    // Perbarui posisi rintangan dinamis
    dynamicObstacles.forEach(obs => obs.update());

    // Perbarui status semua agen
    const activeAgentType = agentTypeSelect.value;
    population.forEach(agent => {
        // Update agen (berikan tipe agen agar batasan fisik seperti maxSpeed menyesuaikan)
        // Kecepatan max disesuaikan sedikit: lalat & mobil lebih cepat, semut lambat
        if (activeAgentType === "ant") agent.maxSpeed = 2.8;
        else if (activeAgentType === "plane") agent.maxSpeed = 5.2;
        else if (activeAgentType === "car") agent.maxSpeed = 4.5;
        else agent.maxSpeed = 4.0;

        agent.update(walls, dynamicObstacles, target, maxStepsPerGen);

        if (!agent.damaged && !agent.reachedTarget) {
            allFinished = false;
            aliveCount++;
        }
    });

    currentSteps++;

    // Update info statistik panel header secara berkala
    const bestAgent = getBestAgent();
    const successCount = population.filter(a => a.reachedTarget).length;
    const successRate = Math.round((successCount / population.length) * 100);
    
    // Tampilkan fitness sementara agen terbaik
    // Hitung nilai visualisasi fitness
    let displayFitness = 0;
    if (bestAgent.reachedTarget) {
        displayFitness = 1000 + (maxStepsPerGen - bestAgent.stepsTaken);
    } else {
        displayFitness = Math.max(0, startDistance - bestAgent.minDistanceToTarget);
    }

    // Tulis data ke UI
    genCountText.innerText = generation;
    bestFitnessText.innerText = displayFitness.toFixed(1);
    successRateText.innerText = `${successRate}%`;
    aliveCountText.innerText = `${aliveCount}/${population.length}`;

    // Deteksi jika satu generasi selesai (semua mati/sukses atau batas langkah tercapai)
    if (allFinished || currentSteps >= maxStepsPerGen) {
        handleGenerationTransition();
    }
}

/**
 * Mengurus transisi antar-generasi (Hitung fitness, seleksi alam, mutasi, evolusi baru)
 */
function handleGenerationTransition() {
    // 1. Hitung fitness akhir untuk semua agen
    population.forEach(agent => {
        GeneticAlgorithm.calculateFitness(agent, target, startDistance, maxStepsPerGen);
    });

    // 2. Kumpulkan metrik untuk grafik
    let maxFitness = -Infinity;
    let totalFitness = 0;
    let successCount = 0;

    population.forEach(agent => {
        if (agent.fitness > maxFitness) maxFitness = agent.fitness;
        totalFitness += agent.fitness;
        if (agent.reachedTarget) successCount++;
    });

    const avgFitness = totalFitness / population.length;

    // 3. Masukkan data ke grafik
    chartVisualizer.addData(generation, maxFitness, avgFitness, successCount, population.length);

    // Simpan otak terbaik mutlak sejauh ini
    population.sort((a, b) => b.fitness - a.fitness);
    savedBrainData = NeuralNetwork.clone(population[0].brain);

    // 4. Hasilkan generasi baru melalui GA
    const popSize = parseInt(popSizeSlider.value);
    const mutationRate = parseInt(mutationSlider.value) / 100;
    const sensorCount = parseInt(sensorSlider.value);

    population = GeneticAlgorithm.nextGeneration(
        population,
        popSize,
        mutationRate,
        sensorCount,
        spawnPos
    );

    generation++;
    currentSteps = 0;
}

/**
 * Loop Animasi Frame (Render loop)
 */
function loop() {
    if (isPlaying) {
        // Jalankan kalkulasi fisika sebanyak kecepatan multiplier (Speed slider)
        for (let s = 0; s < speedMultiplier; s++) {
            updatePhysics();
        }
    }

    render();
    requestAnimationFrame(loop);
}

/**
 * Render Semua Objek ke Canvas Utama & Samping
 */
function render() {
    // 1. Bersihkan Canvas Simulasi
    ctxSim.fillStyle = "#0b0f19";
    ctxSim.fillRect(0, 0, simCanvas.width, simCanvas.height);

    // Gambarkan Grid Latar Belakang (Teknologi grid futuristik)
    ctxSim.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctxSim.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < simCanvas.width; x += gridSize) {
        ctxSim.beginPath();
        ctxSim.moveTo(x, 0);
        ctxSim.lineTo(x, simCanvas.height);
        ctxSim.stroke();
    }
    for (let y = 0; y < simCanvas.height; y += gridSize) {
        ctxSim.beginPath();
        ctxSim.moveTo(0, y);
        ctxSim.lineTo(simCanvas.width, y);
        ctxSim.stroke();
    }

    // 2. Gambar Target (Pulsing neon ring)
    ctxSim.save();
    const pulseRadius = target.radius + Math.sin(Date.now() * 0.007) * 3;
    ctxSim.beginPath();
    ctxSim.arc(target.x, target.y, pulseRadius, 0, Math.PI * 2);
    ctxSim.fillStyle = "rgba(168, 85, 247, 0.15)";
    ctxSim.fill();
    ctxSim.strokeStyle = "#a855f7"; // Ungu neon
    ctxSim.lineWidth = 3;
    ctxSim.shadowColor = "#a855f7";
    ctxSim.shadowBlur = 10;
    ctxSim.stroke();
    
    // Titik pusat target
    ctxSim.beginPath();
    ctxSim.arc(target.x, target.y, 4, 0, Math.PI * 2);
    ctxSim.fillStyle = "#ffffff";
    ctxSim.fill();
    ctxSim.restore();

    // 3. Gambar Semua Rintangan Statis & Dinamis
    walls.forEach(wall => wall.draw(ctxSim));
    dynamicObstacles.forEach(obs => obs.draw(ctxSim));

    // 4. Dapatkan agen terbaik saat ini untuk digambar secara detail & divisualkan
    const bestAgent = getBestAgent();
    const showBestOnly = toggleBestOnly.checked;
    const showSensors = toggleSensors.checked;
    const activeAgentType = agentTypeSelect.value;

    // Gambar populasi agen
    population.forEach(agent => {
        const isBest = (agent === bestAgent);
        
        if (showBestOnly && !isBest) {
            return; // Skip jika user centang hanya tampilkan yang terbaik
        }

        // Tampilkan sensor hanya untuk agen terbaik agar layar tidak semrawut laser hijau
        const drawSensorsForThisAgent = showSensors && isBest;
        agent.draw(ctxSim, activeAgentType, drawSensorsForThisAgent);
    });

    // 5. Perbarui Visualisasi Jaringan Saraf Agen Terbaik di Panel Kanan
    if (bestAgent && bestAgent.brain) {
        Visualizer.drawNetwork(nnCanvas, bestAgent.brain);
    }

    // Gambarkan garis preview jika user sedang menggambar dinding
    if (isDrawing && currentCanvasMode === "draw") {
        ctxSim.save();
        ctxSim.beginPath();
        ctxSim.moveTo(lastMousePos.x, lastMousePos.y);
        ctxSim.lineTo(lastMousePos.x, lastMousePos.y); // (Akan diperbarui sewaktu digeser)
        ctxSim.strokeStyle = "rgba(239, 68, 68, 0.5)";
        ctxSim.lineWidth = 4;
        ctxSim.setLineDash([5, 5]);
        ctxSim.stroke();
        ctxSim.restore();
    }
}

/* --- EVENT LISTENERS & KONTROL INTERAKTIF --- */

// Tombol Play / Pause
btnPlayPause.addEventListener("click", () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
        btnPlayPause.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause`;
        btnPlayPause.classList.remove("btn-primary");
        btnPlayPause.classList.add("btn-secondary");
    } else {
        btnPlayPause.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Play`;
        btnPlayPause.classList.remove("btn-secondary");
        btnPlayPause.classList.add("btn-primary");
    }
});

// Tombol Reset
btnRestart.addEventListener("click", () => {
    generation = 1;
    userWalls = [];
    chartVisualizer.reset();
    initLayout();
    initPopulation();
});

// Slider Kecepatan
speedSlider.addEventListener("input", () => {
    speedMultiplier = parseInt(speedSlider.value);
    speedVal.innerText = `${speedMultiplier}x`;
});

// Slider Jumlah Populasi
popSizeSlider.addEventListener("input", () => {
    popSizeVal.innerText = popSizeSlider.value;
});

// Slider Tingkat Mutasi
mutationSlider.addEventListener("input", () => {
    mutationVal.innerText = `${mutationSlider.value}%`;
});

// Slider Jumlah Sensor
sensorSlider.addEventListener("input", () => {
    sensorVal.innerText = sensorSlider.value;
    // Reset populasi agar struktur otak (input layer) menyesuaikan jumlah sensor baru
    initPopulation();
});

// Slider Rintangan Bergerak
dynamicObsSlider.addEventListener("input", () => {
    dynamicObsVal.innerText = dynamicObsSlider.value;
    updateDynamicObstaclesCount();
});

// Tombol Hapus Semua Dinding Buatan User
btnClearWalls.addEventListener("click", () => {
    userWalls = [];
    initObstacles();
});

// Save Brain ke LocalStorage
btnSaveBrain.addEventListener("click", () => {
    const bestAgent = getBestAgent();
    if (bestAgent && bestAgent.brain) {
        localStorage.setItem("neuro_best_brain", JSON.stringify(bestAgent.brain));
        alert("Sirkuit saraf agen terbaik berhasil disimpan ke memori browser lokal!");
    }
});

// Load Brain dari LocalStorage
btnLoadBrain.addEventListener("click", () => {
    const saved = localStorage.getItem("neuro_best_brain");
    if (saved) {
        try {
            const rawNetwork = JSON.parse(saved);
            
            // Konversi dari JSON mentah kembali menjadi instance NeuralNetwork
            const loadedBrain = new NeuralNetwork([]);
            loadedBrain.levels = rawNetwork.levels.map(lvl => {
                const layer = new Layer(lvl.inputs.length, lvl.outputs.length);
                layer.biases = lvl.biases;
                layer.weights = lvl.weights;
                return layer;
            });

            // Sesuaikan slider sensor agar pas dengan jumlah input saraf yang di-load
            const sensorCount = loadedBrain.levels[0].inputs.length - 3;
            sensorSlider.value = sensorCount;
            sensorVal.innerText = sensorCount;

            initPopulation(loadedBrain);
            alert("Otak agen berhasil dimuat dari memori lokal! Memulai evolusi dengan basis otak ini.");
        } catch (e) {
            alert("Gagal memuat otak: Format data rusak.");
        }
    } else {
        alert("Belum ada sirkuit saraf tersimpan di memori browser lokal.");
    }
});

// Radio Mode Canvas (Draw, Erase, Target)
document.querySelectorAll('input[name="canvas-mode"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
        currentCanvasMode = e.target.value;
    });
});

/* --- LOGIKA DRAWING OBSTACLE PADA CANVAS --- */

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

// Mouse Down
simCanvas.addEventListener("mousedown", (e) => {
    const mousePos = getMousePos(simCanvas, e);
    isDrawing = true;
    lastMousePos = mousePos;

    if (currentCanvasMode === "target") {
        // Pindahkan target
        target.x = mousePos.x;
        target.y = mousePos.y;
        startDistance = Math.hypot(target.x - spawnPos.x, target.y - spawnPos.y);
    } else if (currentCanvasMode === "erase") {
        eraseObstaclesAt(mousePos);
    }
});

// Mouse Move
simCanvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const mousePos = getMousePos(simCanvas, e);

    if (currentCanvasMode === "draw") {
        // Tambahkan garis baru dari posisi mouse terakhir ke sekarang
        // Cegah membuat garis super pendek tak berguna
        const dist = Math.hypot(mousePos.x - lastMousePos.x, mousePos.y - lastMousePos.y);
        if (dist > 8) {
            const newWall = new Wall(lastMousePos.x, lastMousePos.y, mousePos.x, mousePos.y);
            userWalls.push(newWall);
            walls.push(newWall);
            lastMousePos = mousePos; // Geser titik awal
        }
    } else if (currentCanvasMode === "target") {
        target.x = mousePos.x;
        target.y = mousePos.y;
        startDistance = Math.hypot(target.x - spawnPos.x, target.y - spawnPos.y);
    } else if (currentCanvasMode === "erase") {
        eraseObstaclesAt(mousePos);
    }
});

// Mouse Up / Leave
const stopDrawing = () => {
    isDrawing = false;
};
simCanvas.addEventListener("mouseup", stopDrawing);
simCanvas.addEventListener("mouseleave", stopDrawing);

/**
 * Menghapus dinding yang berada di dekat posisi koordinat tertentu (kuas penghapus)
 */
function eraseObstaclesAt(pos) {
    const eraseRadius = 25; // Jangkauan kuas penghapus
    
    // Cari dan hapus dinding gambar buatan user yang bersilangan dengan kuas
    userWalls = userWalls.filter(w => {
        // Cari jarak terdekat dari lingkaran kuas ke garis segment
        const intersect = getLineCircleIntersection(w.p1, w.p2, pos, eraseRadius);
        return intersect === null; // Jika tidak bersilangan, biarkan dinding tetap ada
    });

    // Perbarui daftar walls utama
    initObstacles();
}

/**
 * Menangani penyesuaian ukuran layar (Responsive)
 */
window.addEventListener("resize", () => {
    // Hindari reset total jika ukuran hanya bergeser sedikit, 
    // tapi atur ulang rasio canvas agar tidak pecah/melar
    const rect = simCanvas.parentElement.getBoundingClientRect();
    simCanvas.width = rect.width;
    simCanvas.height = rect.height;

    const nnRect = nnCanvas.parentElement.getBoundingClientRect();
    nnCanvas.width = nnRect.width;

    const chartRect = chartCanvas.parentElement.getBoundingClientRect();
    chartCanvas.width = chartRect.width;

    initObstacles();
});

// Inisialisasi awal saat window dimuat
window.addEventListener("load", () => {
    initLayout();
    
    // Daftarkan chart canvas
    chartVisualizer = new EvolutionChart(chartCanvas);
    chartVisualizer.draw();

    initPopulation();
    loop();
});
