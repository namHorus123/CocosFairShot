import { PhysicsSystem } from "cc";

/** Dùng để chuyển radian sang độ */
const rad2Deg = 180 / Math.PI;

/** Dùng để chuyển độ sang radian */
const deg2Rad = Math.PI / 180;

/**
 * Thư viện toán học cho chuyển động ném pháo
 */
export class ProjectileMath {

    /**
     * Cache kết quả để triệt tiêu Garbage Collection (Zero GC) cho Playable Ads
     */
    public static readonly outResult = { angle: 0, velocity: 0, time: 0 };
    
    /**
     * Gia tốc trọng trường (hướng thẳng đứng xuống)
     */
    public static getGravity(scale: number = 1) {
        return Math.abs(PhysicsSystem.instance.gravity.y) * scale;
    }

    /**
     * Tính toán thời gian tiêu tốn
     * @param x Độ dịch chuyển ngang
     * @param angle Góc ban đầu
     * @param velocity Vận tốc ban đầu
     */
    public static calculateTotalTime(x: number, angle: number, velocity: number) {
        // Góc ban đầu (radian)
        const θ = angle * deg2Rad;

        // Thời gian
        // t = x / ( v * cos(θ) )
        const t = x / (velocity * Math.cos(θ));

        return t;
    }

    /**
     * Tính góc chuyển động tại thời điểm cụ thể
     * @param angle Góc ban đầu
     * @param velocity Vận tốc ban đầu
     * @param time Thời gian
     * @param returnInRadians Có trả về kết quả dạng radian không
     */
    public static calculateAngleAtMoment(angle: number, velocity: number, time: number, returnInRadians: boolean = false) {
        // Gia tốc trọng trường (hướng thẳng đứng xuống)
        const g = ProjectileMath.getGravity();
        // Góc ban đầu (radian)
        const θ = angle * deg2Rad;

        // Vận tốc ngang tức thời
        // vx = v * cos(θ)
        const vx = velocity * Math.cos(θ);

        // Vận tốc dọc tức thời
        // vy = v * sin(θ) - g * t
        const vy = velocity * Math.sin(θ) - g * time;

        // Góc chuyển động tại thời điểm đó (radian)
        const θt = Math.atan(vy / vx);

        return (returnInRadians ? θt : θt * rad2Deg);
    }

    /**
     * Tính khoảng cách dịch chuyển tại thời điểm cụ thể
     * @param angle Góc ban đầu
     * @param velocity Vận tốc ban đầu
     * @param time Thời điểm
     */
    public static calculateDisplacementAtMoment(angle: number, velocity: number, time: number) {
        // Gia tốc trọng trường (hướng thẳng đứng xuống)
        const g = ProjectileMath.getGravity();
        // Góc ban đầu (radian)
        const θ = angle * deg2Rad;

        // Dịch chuyển ngang
        // x = v * cos(θ) * t
        const x = velocity * Math.cos(θ) * time;

        // Dịch chuyển dọc
        // y = v * sin(θ) * t - 0.5 * g * t^2
        const y = velocity * Math.sin(θ) * time - 0.5 * g * Math.pow(time, 2);

        return { x, y };
    }

    /**
     * Tính vận tốc ban đầu dựa trên góc ban đầu
     * @param x Khoảng cách ngang
     * @param y Khoảng cách dọc
     * @param angle Góc ban đầu (độ)
     */
    public static calculateWithAngle(x: number, y: number, angle: number) {
        // Gia tốc trọng trường (hướng thẳng đứng xuống)
        const g = Math.abs(PhysicsSystem.instance.gravity.y);
        // Góc ban đầu (radian)
        const θ = angle * deg2Rad;

        // Công thức vận tốc
        // v = sqrt( ( x^2 * g ) / ( 2 * x * sin(θ) * cos(θ) - 2 * y * cos(θ)^2 ) )

        // Một phần kết quả tính toán
        const p1 = (2 * x * Math.sin(θ) * Math.cos(θ)) - (2 * y * Math.pow(Math.cos(θ), 2));
        // Số âm không có căn bậc hai
        if (p1 < 0) {
            return NaN;
        }
        // Vận tốc
        const v = Math.sqrt((g * Math.pow(x, 2)) / p1);

        return v;
    }

    /**
     * Tính góc ban đầu dựa trên vận tốc ban đầu
     * @param x Khoảng cách ngang
     * @param y Khoảng cách dọc
     * @param velocity Vận tốc ban đầu
     */
    public static calculateWithVelocity(x: number, y: number, velocity: number, gravityScale: number = 1) {
        // Gia tốc trọng trường (hướng thẳng đứng xuống)
        const g = ProjectileMath.getGravity(gravityScale);
        // Vận tốc ban đầu
        const v = velocity;

        // Công thức góc
        // θ = atan( ( -v^2 ± sqrt( v^4 - g * ( g * x^2 + 2 * y * v^2 ) ) / ( -g * x ) ) )

        // Một phần kết quả tính toán
        const p1 = Math.pow(v, 2);
        const p2 = Math.pow(v, 4) - g * (g * Math.pow(x, 2) + 2 * y * p1);
        // Số âm không có căn bậc hai
        if (p2 < 0) {
            return {
                angle1: NaN,
                angle2: NaN,
            };
        }
        // Một phần kết quả tính toán
        const p3 = Math.sqrt(p2);
        // Góc (hai nghiệm)
        const θ1 = Math.atan((-p1 + p3) / (-g * x));
        const θ2 = Math.atan((-p1 - p3) / (-g * x));

        return {
            angle1: θ1 * rad2Deg,
            angle2: θ2 * rad2Deg,
        };
    }

    /**
     * Tính vận tốc và góc dựa trên chiều cao tối đa
     * @param x Khoảng cách ngang
     * @param y Khoảng cách dọc
     * @param maxHeight Chiều cao tối đa
     */
    public static calculateWithMaxHeight(x: number, y: number, maxHeight: number, gravityScale: number = 1) {
        // Gia tốc trọng trường (hướng thẳng đứng xuống)
        const g = ProjectileMath.getGravity(gravityScale);
        // Chiều cao tối đa
        const h = maxHeight;

        // Chiều cao tối đa không thể nhỏ hơn 0, và cũng không thể nhỏ hơn khoảng cách dọc
        if (h < 0 || (h - y) < 0) {
            ProjectileMath.outResult.angle = NaN;
            ProjectileMath.outResult.velocity = NaN;
            ProjectileMath.outResult.time = NaN;
            return ProjectileMath.outResult;
        }

        // Một phần kết quả tính toán
        const p1 = Math.sqrt(2 * g * h);
        const p2 = Math.sqrt(2 * g * (h - y));

        // Công thức thời gian
        // t = ( -sqrt( 2 * g * h ) ± sqrt( 2 * g * ( h - y ) ) ) / -g
        const t1 = (-p1 + p2) / -g;
        const t2 = (-p1 - p2) / -g;
        // Luôn sử dụng nghiệm lớn hơn
        const t = Math.max(t1, t2);

        // Công thức góc
        // θ = atan( ( sqrt( 2 * g * h ) * t ) / x )
        const θ = Math.atan(p1 * t / x);

        // Công thức vận tốc
        // v = sqrt( 2 * g * h ) / sin(θ)
        const v = p1 / Math.sin(θ);

        ProjectileMath.outResult.angle = θ * rad2Deg;
        ProjectileMath.outResult.velocity = v;
        ProjectileMath.outResult.time = t;
        
        return ProjectileMath.outResult;
    }

}
