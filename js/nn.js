/**
 * Kelas untuk merepresentasikan satu lapisan (Layer) dalam Jaringan Saraf Tiruan.
 */
class Layer {
    constructor(inputCount, outputCount) {
        this.inputs = new Array(inputCount);
        this.outputs = new Array(outputCount);
        this.biases = new Array(outputCount);
        this.weights = [];

        for (let i = 0; i < inputCount; i++) {
            this.weights[i] = new Array(outputCount);
        }

        Layer.#randomize(this);
    }

    /**
     * Inisialisasi bobot dan bias dengan nilai acak antara -1 dan 1.
     */
    static #randomize(layer) {
        for (let i = 0; i < layer.inputs.length; i++) {
            for (let j = 0; j < layer.outputs.length; j++) {
                layer.weights[i][j] = Math.random() * 2 - 1;
            }
        }

        for (let i = 0; i < layer.biases.length; i++) {
            layer.biases[i] = Math.random() * 2 - 1;
        }
    }

    /**
     * Melakukan perhitungan feedforward untuk lapisan ini.
     * Menggunakan fungsi aktivasi Tanh (rentang -1 sampai 1).
     */
    static feedForward(givenInputs, layer) {
        for (let i = 0; i < layer.inputs.length; i++) {
            layer.inputs[i] = givenInputs[i];
        }

        for (let i = 0; i < layer.outputs.length; i++) {
            let sum = 0;
            for (let j = 0; j < layer.inputs.length; j++) {
                sum += layer.inputs[j] * layer.weights[j][i];
            }

            // Tambahkan bias dan hitung aktivasi (menggunakan Tanh)
            layer.outputs[i] = Math.tanh(sum + layer.biases[i]);
        }

        return layer.outputs;
    }
}

/**
 * Kelas utama Jaringan Saraf Tiruan (Feedforward Neural Network).
 */
class NeuralNetwork {
    constructor(neuronCounts) {
        this.levels = [];
        for (let i = 0; i < neuronCounts.length - 1; i++) {
            this.levels.push(new Layer(neuronCounts[i], neuronCounts[i + 1]));
        }
    }

    /**
     * Menghitung output akhir berdasarkan input sensor.
     */
    static feedForward(inputs, network) {
        let outputs = Layer.feedForward(inputs, network.levels[0]);
        for (let i = 1; i < network.levels.length; i++) {
            outputs = Layer.feedForward(outputs, network.levels[i]);
        }
        return outputs;
    }

    /**
     * Mengkloning objek Jaringan Saraf.
     */
    static clone(network) {
        const cloned = new NeuralNetwork([]);
        for (let i = 0; i < network.levels.length; i++) {
            const level = network.levels[i];
            const clonedLevel = new Layer(level.inputs.length, level.outputs.length);
            
            // Salin biases
            for (let j = 0; j < level.biases.length; j++) {
                clonedLevel.biases[j] = level.biases[j];
            }
            
            // Salin bobot
            for (let j = 0; j < level.inputs.length; j++) {
                for (let k = 0; k < level.outputs.length; k++) {
                    clonedLevel.weights[j][k] = level.weights[j][k];
                }
            }
            cloned.levels.push(clonedLevel);
        }
        return cloned;
    }

    /**
     * Melakukan mutasi pada bobot dan bias secara acak menggunakan Gaussian noise.
     * @param {NeuralNetwork} network - Jaringan saraf yang akan dimutasi.
     * @param {number} rate - Tingkat peluang terjadinya mutasi (0 s.d 1).
     * @param {number} amount - Skala variasi mutasi (makin tinggi makin besar perubahan bobot).
     */
    static mutate(network, rate = 0.1, amount = 0.2) {
        network.levels.forEach(level => {
            // Mutasi bias
            for (let i = 0; i < level.biases.length; i++) {
                if (Math.random() < rate) {
                    level.biases[i] += (Math.random() * 2 - 1) * amount;
                    // Batasi dalam rentang [-1, 1]
                    level.biases[i] = Math.max(-1, Math.min(1, level.biases[i]));
                }
            }

            // Mutasi bobot
            for (let i = 0; i < level.inputs.length; i++) {
                for (let j = 0; j < level.outputs.length; j++) {
                    if (Math.random() < rate) {
                        level.weights[i][j] += (Math.random() * 2 - 1) * amount;
                        level.weights[i][j] = Math.max(-1, Math.min(1, level.weights[i][j]));
                    }
                }
            }
        });
    }

    /**
     * Melakukan persilangan (Crossover) antara dua jaringan saraf (induk A dan induk B).
     * Mengembalikan jaringan baru perpaduan keduanya.
     */
    static crossover(networkA, networkB) {
        const child = NeuralNetwork.clone(networkA);
        
        for (let i = 0; i < child.levels.length; i++) {
            const level = child.levels[i];
            const levelB = networkB.levels[i];
            
            // Crossover biases
            for (let j = 0; j < level.biases.length; j++) {
                if (Math.random() > 0.5) {
                    level.biases[j] = levelB.biases[j];
                }
            }
            
            // Crossover weights
            for (let j = 0; j < level.inputs.length; j++) {
                for (let k = 0; k < level.outputs.length; k++) {
                    if (Math.random() > 0.5) {
                        level.weights[j][k] = levelB.weights[j][k];
                    }
                }
            }
        }
        return child;
    }
}
