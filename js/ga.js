/**
 * Mengelola siklus hidup populasi agen menggunakan Algoritma Genetika.
 */
class GeneticAlgorithm {
    /**
     * Membuat generasi baru berdasarkan populasi saat ini.
     * @param {Array<Agent>} currentPopulation - Daftar agen dari generasi saat ini.
     * @param {number} popSize - Jumlah total populasi yang diinginkan.
     * @param {number} mutationRate - Peluang mutasi bobot (0 s.d 1).
     * @param {number} sensorCount - Jumlah sensor agen baru.
     * @param {Object} spawnPos - Posisi lahir agen ({x, y}).
     */
    static nextGeneration(currentPopulation, popSize, mutationRate, sensorCount, spawnPos) {
        // 1. Urutkan berdasarkan fitness tertinggi ke terendah
        currentPopulation.sort((a, b) => b.fitness - a.fitness);
        
        const nextPop = [];
        const elitismCount = Math.max(1, Math.round(popSize * 0.05)); // 5% Elitism

        // 2. Terapkan Elitism: Simpan beberapa agen terbaik langsung ke generasi berikutnya
        for (let i = 0; i < elitismCount; i++) {
            const bestParent = currentPopulation[i];
            const eliteAgent = new Agent(spawnPos.x, spawnPos.y, sensorCount);
            // Salin otak agen terbaik secara utuh
            eliteAgent.brain = NeuralNetwork.clone(bestParent.brain);
            eliteAgent.isElite = true; // Penanda visual elite
            nextPop.push(eliteAgent);
        }

        // 3. Hasilkan sisa populasi baru melalui seleksi, crossover, dan mutasi
        while (nextPop.length < popSize) {
            // Seleksi Turnamen untuk mendapatkan dua induk
            const parentA = GeneticAlgorithm.tournamentSelection(currentPopulation, 5);
            const parentB = GeneticAlgorithm.tournamentSelection(currentPopulation, 5);
            
            // Crossover: Campurkan sirkuit saraf keduanya
            let childBrain = NeuralNetwork.crossover(parentA.brain, parentB.brain);
            
            // Mutasi: Tambahkan noise acak pada bobot sirkuit saraf
            // Skala mutasi (amount) kita atur default 0.25
            NeuralNetwork.mutate(childBrain, mutationRate, 0.25);
            
            const childAgent = new Agent(spawnPos.x, spawnPos.y, sensorCount);
            childAgent.brain = childBrain;
            nextPop.push(childAgent);
        }

        return nextPop;
    }

    /**
     * Metode Seleksi Turnamen (Tournament Selection).
     * Mengambil k kandidat secara acak, lalu memilih yang memiliki fitness terbaik.
     */
    static tournamentSelection(population, k = 5) {
        let best = null;
        for (let i = 0; i < k; i++) {
            const ind = population[Math.floor(Math.random() * population.length)];
            if (best === null || ind.fitness > best.fitness) {
                best = ind;
            }
        }
        return best;
    }

    /**
     * Hitung nilai fitness untuk setiap agen.
     * @param {Agent} agent - Agen yang dinilai.
     * @param {Object} target - Koordinat target ({x, y}).
     * @param {number} startDistance - Jarak awal dari posisi spawn ke target.
     * @param {number} maxSteps - Batas waktu maksimal simulasi langkah.
     */
    static calculateFitness(agent, target, startDistance, maxSteps) {
        // Hitung jarak terdekat yang berhasil dicapai oleh agen selama masa hidupnya
        const minDist = agent.minDistanceToTarget;

        if (agent.reachedTarget) {
            // Jika berhasil sampai target:
            // Beri bonus besar, ditambah bonus kecepatan (makin sedikit langkah digunakan, makin besar fitness)
            agent.fitness = 5000 + (maxSteps - agent.stepsTaken) * 10;
        } else {
            // Jika gagal sampai target (crash atau kehabisan waktu):
            // Fitness didasarkan pada seberapa dekat agen berhasil mendekati target dibanding jarak awal
            const progress = startDistance - minDist;
            
            // Berikan nilai dasar, semakin dekat semakin tinggi. 
            // Tambahkan sedikit reward bertahan hidup (survival) agar agen didorong bergerak, tapi tidak berputar-putar saja.
            const survivalBonus = agent.stepsTaken * 0.1;
            
            // Jika progres bernilai negatif (malah menjauh), batasi di 0
            agent.fitness = Math.max(0.1, progress) + survivalBonus;

            // Beri penalti jika crash sangat cepat tanpa bergerak ke target
            if (agent.damaged && agent.stepsTaken < 40) {
                agent.fitness *= 0.5;
            }
        }
    }
}
