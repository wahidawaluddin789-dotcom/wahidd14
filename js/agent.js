/**
 * Kelas Agen yang dikontrol oleh Jaringan Saraf Tiruan.
 * Mampu berubah visual (Drone, Mobil, Semut, Lalat, Pesawat) secara dinamis.
 */
class Agent {
    constructor(x, y, sensorCount = 5) {
        this.x = x;
        this.y = y;
        this.radius = 12; // Ukuran fisik untuk deteksi tabrakan bulat
        
        // Parameter fisik
        this.angle = -Math.PI / 2; // Menghadap ke atas saat spawn
        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = 4;
        this.friction = 0.05;
        
        // Status Agen
        this.damaged = false;
        this.reachedTarget = false;
        this.stepsTaken = 0;
        this.fitness = 0;
        this.minDistanceToTarget = Infinity;

        // Inisialisasi Sensor Sinar
        this.sensorCount = sensorCount;
        this.sensorRange = 160;
        this.sensorSpread = Math.PI / 1.5; // Menyebar sekitar 120 derajat ke depan
        this.sensors = []; // Menyimpan koordinat sinar [{start, end, intersection}]

        // Inisialisasi Otak (Neural Network)
        // Inputs: sensorCount + 3 (sinTargetAngle, cosTargetAngle, normalizedSpeed)
        // Hidden Layer: 8 Neuron
        // Outputs: 2 (Akselerasi, Kemudi)
        this.brain = new NeuralNetwork([this.sensorCount + 3, 8, 2]);
        this.isElite = false;
    }

    /**
     * Memperbarui status fisik agen, membaca sensor, dan memproses otak.
     */
    update(walls, dynamicObstacles, target, maxSteps) {
        if (this.damaged || this.reachedTarget) return;

        this.stepsTaken++;
        
        // 1. Perbarui Sensor Raycasting
        this.#updateSensors(walls, dynamicObstacles);

        // 2. Persiapkan Input Jaringan Saraf
        // Input sensor di-normalisasi (0 jika bersih, 1 jika sangat dekat)
        const inputs = [];
        for (let i = 0; i < this.sensorCount; i++) {
            const intersection = this.sensors[i].intersection;
            inputs.push(intersection ? (1 - intersection.offset) : 0);
        }

        // Input arah target relatif terhadap orientasi agen
        const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
        let relativeAngle = angleToTarget - this.angle;
        // Normalisasi sudut relatif ke rentang [-PI, PI]
        relativeAngle = Math.atan2(Math.sin(relativeAngle), Math.cos(relativeAngle));

        inputs.push(Math.sin(relativeAngle));
        inputs.push(Math.cos(relativeAngle));
        
        // Input kecepatan agen saat ini (di-normalisasi)
        inputs.push(this.speed / this.maxSpeed);

        // 3. Jalankan Feedforward Saraf
        const outputs = NeuralNetwork.feedForward(inputs, this.brain);
        
        // Output 1: Akselerasi (Output berkisar antara -1 dan 1 dari Tanh)
        // Kita petakan: jika > 0 gas maju, jika < 0 rem/mundur
        const thrust = outputs[0];
        // Output 2: Kemudi (Steering)
        const steer = outputs[1];

        // 4. Hitung Fisika Gerak
        if (thrust > 0.1) {
            this.speed += this.acceleration * thrust;
        } else if (thrust < -0.1) {
            this.speed += (this.acceleration * 0.5) * thrust; // Mundur lebih lambat
        }

        // Terapkan gesekan (friction)
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < 0.05) this.speed = 0;

        // Batasi kecepatan maksimal
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        // Terapkan rotasi kemudi (hanya berputar jika agen bergerak)
        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1;
            this.angle += 0.06 * steer * flip;
        }

        // Perbarui posisi
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // 5. Hitung Metrik Sukses/Gagal
        const distToTarget = Math.hypot(target.x - this.x, target.y - this.y);
        if (distToTarget < this.minDistanceToTarget) {
            this.minDistanceToTarget = distToTarget;
        }

        // Deteksi sukses mencapai target (radius target 20px)
        if (distToTarget < 22) {
            this.reachedTarget = true;
        }

        // 6. Deteksi Tabrakan (Collision Detection)
        this.#checkCollisions(walls, dynamicObstacles);
        
        // Jika melebihi batas waktu langkah, tandai selesai secara normal
        if (this.stepsTaken >= maxSteps) {
            this.damaged = true;
        }
    }

    /**
     * Mengatur posisi sinar sensor dan menghitung persilangan dengan rintangan.
     */
    #updateSensors(walls, dynamicObstacles) {
        this.sensors = [];
        
        for (let i = 0; i < this.sensorCount; i++) {
            // Tentukan sudut tiap sensor
            const rayAngle = this.angle + 
                (i - (this.sensorCount - 1) / 2) * (this.sensorSpread / (this.sensorCount - 1 || 1));
            
            const start = { x: this.x, y: this.y };
            const end = {
                x: this.x + Math.cos(rayAngle) * this.sensorRange,
                y: this.y + Math.sin(rayAngle) * this.sensorRange
            };

            // Cari persilangan terdekat dengan dinding
            let closestIntersection = null;
            
            // Periksa persilangan dengan dinding statis
            for (let j = 0; j < walls.length; j++) {
                const intersect = getLineIntersection(start, end, walls[j].p1, walls[j].p2);
                if (intersect) {
                    if (!closestIntersection || intersect.offset < closestIntersection.offset) {
                        closestIntersection = intersect;
                    }
                }
            }

            // Periksa persilangan dengan rintangan dinamis (lingkaran)
            for (let j = 0; j < dynamicObstacles.length; j++) {
                const obs = dynamicObstacles[j];
                const intersect = getLineCircleIntersection(start, end, obs, obs.radius);
                if (intersect) {
                    if (!closestIntersection || intersect.offset < closestIntersection.offset) {
                        closestIntersection = intersect;
                    }
                }
            }

            this.sensors.push({ start, end, intersection: closestIntersection });
        }
    }

    /**
     * Memeriksa apakah agen menabrak dinding atau rintangan dinamis.
     */
    #checkCollisions(walls, dynamicObstacles) {
        // Tabrakan dengan dinding statis (jarak tegak lurus dari pusat agen ke dinding)
        for (let i = 0; i < walls.length; i++) {
            const w = walls[i];
            const intersect = getLineCircleIntersection(w.p1, w.p2, this, this.radius);
            if (intersect) {
                this.damaged = true;
                return;
            }
        }

        // Tabrakan dengan rintangan dinamis (jarak lingkaran ke lingkaran)
        for (let i = 0; i < dynamicObstacles.length; i++) {
            const obs = dynamicObstacles[i];
            const dist = Math.hypot(obs.x - this.x, obs.y - this.y);
            if (dist < this.radius + obs.radius) {
                this.damaged = true;
                return;
            }
        }
    }

    /**
     * Menggambar agen ke Canvas utama simulator.
     */
    draw(ctx, type = "drone", drawSensors = true) {
        // Gambarkan sensor terlebih dahulu agar di bawah badan agen
        if (drawSensors && !this.damaged && !this.reachedTarget) {
            this.#drawSensors(ctx);
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Highlight jika agen terpilih/elite
        if (this.isElite) {
            ctx.shadowColor = "rgba(0, 255, 135, 0.9)";
            ctx.shadowBlur = 12;
        }

        // Render sesuai tipe agen
        switch (type) {
            case "car":
                this.#drawCar(ctx);
                break;
            case "ant":
                this.#drawAnt(ctx);
                break;
            case "fly":
                this.#drawFly(ctx);
                break;
            case "plane":
                this.#drawPlane(ctx);
                break;
            case "drone":
            default:
                this.#drawDrone(ctx);
                break;
        }

        ctx.restore();
    }

    /**
     * Menggambar sensor raycasting
     */
    #drawSensors(ctx) {
        ctx.save();
        for (let i = 0; i < this.sensors.length; i++) {
            const sensor = this.sensors[i];
            let drawEnd = sensor.end;
            if (sensor.intersection) {
                drawEnd = sensor.intersection;
            }

            // Garis sensor hijau neon transparan
            ctx.beginPath();
            ctx.moveTo(sensor.start.x, sensor.start.y);
            ctx.lineTo(drawEnd.x, drawEnd.y);
            ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Jika mentok rintangan, beri titik tabrakan merah menyala
            if (sensor.intersection) {
                ctx.beginPath();
                ctx.arc(sensor.intersection.x, sensor.intersection.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
                ctx.shadowColor = "rgba(239, 68, 68, 0.8)";
                ctx.shadowBlur = 5;
                ctx.fill();
            }
        }
        ctx.restore();
    }

    /* --- GAMBAR PROSEDURAL AGEN --- */

    #drawDrone(ctx) {
        const size = this.radius;
        const color = this.damaged ? "#4a4a4a" : (this.isElite ? "#00ff87" : "#00f2fe");
        const lightColor = this.isElite ? "rgba(0, 255, 135, 0.8)" : "rgba(0, 242, 254, 0.8)";

        // 1. Gambar diagonal arms
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-size, -size);
        ctx.lineTo(size, size);
        ctx.moveTo(-size, size);
        ctx.lineTo(size, -size);
        ctx.stroke();

        // 2. Hub tengah (Center body)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Lampu indikator depan (merah) dan belakang (hijau/cyan)
        ctx.fillStyle = this.damaged ? "#4a4a4a" : "#ff0055"; // Lampu depan
        ctx.beginPath();
        ctx.arc(size * 0.6, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        // 3. Gambarkan 4 Rotor dan Propeller yang berputar
        const propRotation = this.stepsTaken * 0.8; // Kecepatan putar propeller
        const rotors = [
            { x: -size, y: -size },
            { x: size, y: -size },
            { x: -size, y: size },
            { x: size, y: size }
        ];

        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        
        rotors.forEach((rot, index) => {
            // Cincin pelindung rotor
            ctx.beginPath();
            ctx.arc(rot.x, rot.y, size * 0.45, 0, Math.PI * 2);
            ctx.stroke();

            // Propeller
            if (!this.damaged) {
                ctx.save();
                ctx.translate(rot.x, rot.y);
                ctx.rotate(propRotation * (index % 2 === 0 ? 1 : -1)); // Arah putar berlawanan
                ctx.beginPath();
                ctx.moveTo(-size * 0.4, 0);
                ctx.lineTo(size * 0.4, 0);
                ctx.strokeStyle = "#f1f5f9";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        });
    }

    #drawCar(ctx) {
        const w = 24;
        const h = 13;
        const color = this.damaged ? "#4a4a4a" : (this.isElite ? "#00ff87" : "#a855f7");

        // Roda-roda
        ctx.fillStyle = "#020617";
        ctx.fillRect(-w/2 + 2, -h/2 - 2, 6, 2);
        ctx.fillRect(w/2 - 8, -h/2 - 2, 6, 2);
        ctx.fillRect(-w/2 + 2, h/2, 6, 2);
        ctx.fillRect(w/2 - 8, h/2, 6, 2);

        // Body mobil
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-w/2, -h/2, w, h, 3);
        ctx.fill();

        // Garis dekoratif / Strips olahraga
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w/2, -h/4);
        ctx.lineTo(w/2, -h/4);
        ctx.moveTo(-w/2, h/4);
        ctx.lineTo(w/2, h/4);
        ctx.stroke();

        // Kaca depan (windshield)
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, -h/2 + 2, 6, h - 4);

        // Lampu depan menyala (neon yellow)
        if (!this.damaged) {
            ctx.fillStyle = "rgba(253, 224, 71, 0.8)";
            ctx.beginPath();
            ctx.arc(w/2, -h/3, 2, 0, Math.PI * 2);
            ctx.arc(w/2, h/3, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    #drawAnt(ctx) {
        const size = this.radius;
        const color = this.damaged ? "#3f3f46" : (this.isElite ? "#22c55e" : "#ea580c");

        // Kaki semut yang bergerak (wiggling) saat jalan
        if (!this.damaged && this.speed !== 0) {
            const legWiggle = Math.sin(this.stepsTaken * 0.4) * 0.3;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            
            // 3 pasang kaki
            for (let i = -1; i <= 1; i++) {
                const legOffset = i * 4;
                ctx.beginPath();
                // Kiri
                ctx.moveTo(legOffset, 0);
                ctx.lineTo(legOffset - 2, -size - (i * legWiggle * 3));
                // Kanan
                ctx.moveTo(legOffset, 0);
                ctx.lineTo(legOffset - 2, size + (i * legWiggle * 3));
                ctx.stroke();
            }
        }

        // 3 Bagian tubuh semut (Abdomen, Thorax, Head)
        ctx.fillStyle = color;
        // Abdomen (belakang, agak besar)
        ctx.beginPath();
        ctx.arc(-size * 0.6, 0, size * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Thorax (tengah)
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Head (depan)
        ctx.beginPath();
        ctx.arc(size * 0.55, 0, size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Antennae (sungut depan)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(size * 0.8, -size * 0.3, 6, 0, Math.PI / 2, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(size * 0.8, size * 0.3, 6, 0, -Math.PI / 2, false);
        ctx.stroke();
    }

    #drawFly(ctx) {
        const size = this.radius;
        const color = this.damaged ? "#4b5563" : (this.isElite ? "#10b981" : "#0284c7");

        // Sayap yang mengepak sangat cepat menggunakan Sinusoida
        const wingFlap = Math.sin(this.stepsTaken * 1.5) * 0.6;
        
        if (!this.damaged) {
            ctx.fillStyle = "rgba(241, 245, 249, 0.4)";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 1;

            // Sayap kiri
            ctx.save();
            ctx.translate(-2, -2);
            ctx.rotate(-Math.PI/3 + wingFlap);
            ctx.beginPath();
            ctx.ellipse(0, -size * 0.6, size * 0.3, size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Sayap kanan
            ctx.save();
            ctx.translate(-2, 2);
            ctx.rotate(Math.PI/3 - wingFlap);
            ctx.beginPath();
            ctx.ellipse(0, size * 0.6, size * 0.3, size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Badan lalat (oval hitam/biru gelap)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.7, size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mata merah besar
        ctx.fillStyle = this.damaged ? "#374151" : "#ef4444";
        ctx.beginPath();
        ctx.arc(size * 0.4, -size * 0.25, 3, 0, Math.PI * 2);
        ctx.arc(size * 0.4, size * 0.25, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    #drawPlane(ctx) {
        const size = this.radius;
        const color = this.damaged ? "#4b5563" : (this.isElite ? "#00ff87" : "#f97316");

        // Api Jet Belakang (Thruster Flame)
        if (!this.damaged && this.speed > 0.5) {
            const flameSize = (size * 0.6) + Math.random() * 5;
            const gradient = ctx.createLinearGradient(-size, 0, -size - flameSize, 0);
            gradient.addColorStop(0, "yellow");
            gradient.addColorStop(0.4, "orange");
            gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(-size * 0.8, -size * 0.2);
            ctx.lineTo(-size - flameSize, 0);
            ctx.lineTo(-size * 0.8, size * 0.2);
            ctx.closePath();
            ctx.fill();
        }

        // Bentuk Delta Jet Fighter
        ctx.fillStyle = color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Hidung pesawat
        ctx.moveTo(size * 1.1, 0);
        // Sayap kanan belakang
        ctx.lineTo(-size * 0.8, size * 0.9);
        // Lekukan sayap kanan
        ctx.lineTo(-size * 0.5, size * 0.2);
        // Ekor belakang
        ctx.lineTo(-size * 0.9, 0);
        // Lekukan sayap kiri
        ctx.lineTo(-size * 0.5, -size * 0.2);
        // Sayap kiri belakang
        ctx.lineTo(-size * 0.8, -size * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Kaca kokpit (biru cyan)
        ctx.fillStyle = "#06b6d4";
        ctx.beginPath();
        ctx.ellipse(size * 0.2, 0, size * 0.3, size * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}
