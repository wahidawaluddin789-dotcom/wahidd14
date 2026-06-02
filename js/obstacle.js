/**
 * Utilitas untuk deteksi tabrakan garis dengan garis (Line-Line Intersection).
 * Mengembalikan koordinat x, y, dan offset jika terjadi persilangan.
 */
function getLineIntersection(A, B, C, D) {
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

    if (bottom !== 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: A.x + t * (B.x - A.x),
                y: A.y + t * (B.y - A.y),
                offset: t
            };
        }
    }
    return null;
}

/**
 * Utilitas untuk deteksi tabrakan garis dengan lingkaran (Line-Circle Intersection).
 * Berguna untuk mendeteksi rintangan dinamis (lingkaran) dengan sensor sinar agen.
 */
function getLineCircleIntersection(A, B, center, radius) {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return null;

    // Proyeksikan pusat lingkaran ke garis segment
    let t = ((center.x - A.x) * dx + (center.y - A.y) * dy) / lenSq;
    
    // Batasi t pada rentang [0, 1] agar berada di dalam segment garis
    t = Math.max(0, Math.min(1, t));

    // Titik terdekat pada garis segment
    const closestX = A.x + t * dx;
    const closestY = A.y + t * dy;

    // Hitung jarak dari pusat lingkaran ke titik terdekat
    const distSq = (center.x - closestX) ** 2 + (center.y - closestY) ** 2;

    if (distSq <= radius * radius) {
        // Ada perpotongan, cari titik perpotongan pertama sepanjang arah A -> B
        // Dari A ke closest, dikurangi jarak aman di dalam lingkaran
        const dist = Math.sqrt(distSq);
        const insideDist = Math.sqrt(radius * radius - dist * dist);
        const segmentLen = Math.sqrt(lenSq);
        
        // Vektor satuan arah
        const ux = dx / segmentLen;
        const uy = dy / segmentLen;

        // Titik perpotongan masuk (intersection entry)
        // tProj adalah jarak terproyeksi dari A ke closest
        const projLen = t * segmentLen;
        const entryLen = projLen - insideDist;

        if (entryLen >= 0 && entryLen <= segmentLen) {
            const ix = A.x + ux * entryLen;
            const iy = A.y + uy * entryLen;
            return {
                x: ix,
                y: iy,
                offset: entryLen / segmentLen
            };
        } else if (projLen + insideDist >= 0 && projLen + insideDist <= segmentLen) {
            // Jika A ada di dalam lingkaran, gunakan titik keluar
            const ix = A.x + ux * (projLen + insideDist);
            const iy = A.y + uy * (projLen + insideDist);
            return {
                x: ix,
                y: iy,
                offset: (projLen + insideDist) / segmentLen
            };
        }
    }
    return null;
}

/**
 * Kelas Dinding Rintangan Statis (Garis lurus).
 */
class Wall {
    constructor(x1, y1, x2, y2, isBorder = false) {
        this.p1 = { x: x1, y: y1 };
        this.p2 = { x: x2, y: y2 };
        this.isBorder = isBorder; // Penanda jika ini dinding pembatas luar
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        
        if (this.isBorder) {
            ctx.strokeStyle = "rgba(79, 172, 254, 0.4)";
            ctx.lineWidth = 6;
            ctx.shadowColor = "rgba(79, 172, 254, 0.2)";
            ctx.shadowBlur = 10;
        } else {
            ctx.strokeStyle = "rgba(239, 68, 68, 0.7)"; // Merah neon
            ctx.lineWidth = 4;
            ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
            ctx.shadowBlur = 6;
        }
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * Kelas Rintangan Bergerak (Dynamic Obstacle).
 * Berupa lingkaran neon yang memantul di dalam kanvas simulasi.
 */
class DynamicObstacle {
    constructor(x, y, radius, speedX, speedY, minX, maxX, minY, maxY) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speedX = speedX;
        this.speedY = speedY;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
        this.color = `hsl(${(15 + Math.random() * 20)}, 95%, 55%)`; // Orange kemerahan neon
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Pantulan pada batas area
        if (this.x - this.radius <= this.minX) {
            this.x = this.minX + this.radius;
            this.speedX *= -1;
        } else if (this.x + this.radius >= this.maxX) {
            this.x = this.maxX - this.radius;
            this.speedX *= -1;
        }

        if (this.y - this.radius <= this.minY) {
            this.y = this.minY + this.radius;
            this.speedY *= -1;
        } else if (this.y + this.radius >= this.maxY) {
            this.y = this.maxY - this.radius;
            this.speedY *= -1;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(249, 115, 22, 0.15)";
        ctx.fill();
        
        // Border bersinar
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
    }
}
