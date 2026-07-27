import { Node, Vec3, Quat, RigidBody } from 'cc';
import { ProjectileMath } from '../spawn/ProjectileMath';

export class TrajectoryCalculator {
    // --- STATIC CACHES (Zero GC) ---
    private static _direction: Vec3 = new Vec3();
    private static _dirXZ: Vec3 = new Vec3();
    private static _rot: Quat = new Quat();
    private static _tempDirection: Vec3 = new Vec3();

    /**
     * Tính toán quỹ đạo và áp dụng lực trực tiếp vào RigidBody của đạn
     */
    public static applyShootImpulse(
        rb: RigidBody,
        bulletNode: Node,
        startPos: Readonly<Vec3>,
        targetPoint: Vec3,
        shootForce: number,
        useFixedTrajectory: boolean,
        fixedAngle: number,
        fixedVelocity: number,
        arcHeightRatio: number,
        gravityScale: number = 1
    ) {
        const firePos = startPos as Vec3;
        const direction = Vec3.subtract(this._direction, targetPoint, firePos);
        const vertical = direction.y;

        // Khoảng cách trên mặt phẳng XZ
        const horizontal = Math.sqrt(direction.x * direction.x + direction.z * direction.z);

        // Tính maxHeight động dựa trên khoảng cách ngang
        const maxHeight = Math.max(0.5, vertical + (horizontal * arcHeightRatio));

        let finalAngle = NaN;
        let finalVelocity = NaN;

        if (useFixedTrajectory) {
            // Chú ý: Góc toán học (hướng lên là dương), nhưng góc xoay Cocos (trục X âm là ngẩng lên)
            // Nên nếu nhập -25 thì ta đảo dấu thành +25 cho tính toán sin/cos
            finalAngle = -fixedAngle;
            finalVelocity = fixedVelocity;
        } else {
            // Tích hợp trực tiếp ProjectileMath (tính tự động) có tính thêm Gravity Scale của đạn
            const result = ProjectileMath.calculateWithMaxHeight(horizontal, vertical, maxHeight, gravityScale);
            finalAngle = result.angle;
            finalVelocity = result.velocity;
        }

        if (isNaN(finalAngle) || isNaN(finalVelocity)) {
            // Fallback bắn thẳng nếu lỗi toán học (ngoài tầm với)
            direction.normalize();
            direction.multiplyScalar(shootForce);
            rb.setLinearVelocity(direction);

            const rot = this._rot;
            Quat.fromViewUp(rot, direction, Vec3.UP);
            bulletNode.setWorldRotation(rot);
            return;
        }

        // Đổi angle từ độ (degree) sang radian
        const thetaRad = finalAngle * (Math.PI / 180);
        const v = finalVelocity;

        // Phân rã vận tốc ra các trục
        const vxz = v * Math.cos(thetaRad);
        const vy = v * Math.sin(thetaRad);

        const dirXZ = this._dirXZ.set(direction.x, 0, direction.z);
        if (horizontal > 0.001) {
            dirXZ.normalize();
            this._tempDirection.x = dirXZ.x * vxz;
            this._tempDirection.z = dirXZ.z * vxz;
        } else {
            this._tempDirection.x = 0;
            this._tempDirection.z = 0;
        }
        this._tempDirection.y = vy;

        // Xoay viên đạn hướng theo quỹ đạo
        const rot = this._rot;
        // Sử dụng _direction (đã tính xong ở trên) làm biến tạm để normalize, triệt tiêu clone()
        Vec3.copy(this._direction, this._tempDirection).normalize();
        Quat.fromViewUp(rot, this._direction, Vec3.UP);
        bulletNode.setWorldRotation(rot);

        // Đặt vận tốc
        rb.setLinearVelocity(this._tempDirection);
    }

    /**
     * Bắn thẳng trực tiếp (không quỹ đạo) và tính toán lực đẩy (Impulse) 
     * theo logic giảm động lượng (momentum) khi tắt nổ của C#.
     */
    public static applyUnityStraightImpulse(
        rb: RigidBody,
        bulletNode: Node,
        startPos: Readonly<Vec3>,
        targetPoint: Vec3,
        shootForce: number,
        entryMass: number,
        entryLinearDamping: number,
        entryAngularDamping: number,
        hasExplosion: boolean,
        levelExplosionForce: number,
        disabledExplosionCollisionMassRatio: number
    ) {
        const firePos = startPos as Vec3;

        // 1. Tính toán Mass
        const launchMass = Math.max(entryMass, 0.0001);
        const explosionDisabledForLevel = hasExplosion && Math.abs(levelExplosionForce) < 1e-6;

        rb.mass = explosionDisabledForLevel
            ? Math.max(launchMass * disabledExplosionCollisionMassRatio, 0.0001)
            : launchMass;

        // 2. Gán Damping
        rb.linearDamping = entryLinearDamping;
        rb.angularDamping = entryAngularDamping;

        // Reset vận tốc
        rb.setLinearVelocity(Vec3.ZERO);
        rb.setAngularVelocity(Vec3.ZERO);

        // 3. Tính hướng bắn thẳng
        const direction = Vec3.subtract(this._direction, targetPoint, firePos);
        direction.normalize();

        // Xoay viên đạn hướng theo quỹ đạo
        const rot = this._rot;
        Quat.fromViewUp(rot, direction, Vec3.UP);
        bulletNode.setWorldRotation(rot);

        // 4. Giữ nguyên tốc độ bay đồng thời giảm động lượng va chạm vật lý
        const launchImpulse = shootForce * (rb.mass / launchMass);

        // 5. Áp dụng Impulse
        const impulseVec = this._tempDirection;
        Vec3.multiplyScalar(impulseVec, direction, launchImpulse);
        rb.applyImpulse(impulseVec);
    }
}
