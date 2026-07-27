import { _decorator, Node, Prefab, instantiate, Vec3, Quat, RigidBody, NodePool, PhysicsMaterial, Collider } from 'cc';
import { TrajectoryCalculator } from '../mechanics/TrajectoryCalculator';
import { Projectile } from '../gameplay/Projectile';
import { SpawnBase } from './SpawnBase';

const { ccclass, property } = _decorator;

@ccclass('SpawnBullet')
export class SpawnBullet extends SpawnBase<SpawnBullet> {

    // --- TỐI ƯU CHO PLAYABLE ---
    // Các thông số vật lý (Mass, Damping, Bounciness...) được cấu hình sẵn thẳng trên Component Projectile của đạn.
    @property({ type: Prefab, tooltip: 'Prefab đạn mặc định' })
    public bulletPrefab: Prefab | null = null;

    @property({ type: PhysicsMaterial, tooltip: 'Physics Material áp dụng cho đạn KHI RỜI NÒNG (bắn đi). Bỏ trống nếu muốn giữ nguyên Material cũ.' })
    public firedPhysicsMaterial: PhysicsMaterial | null = null;

    @property({ tooltip: 'Bật để sử dụng góc và lực bắn cố định từ Inspector thay vì tính toán tự động' })
    public useFixedTrajectory: boolean = true;

    @property({ tooltip: 'Góc ngẩng của đạn (Độ). Ví dụ: -25 (âm) là ngẩng lên, dương là cắm xuống', visible: function (this: SpawnBullet) { return this.useFixedTrajectory; } })
    public fixedAngle: number = -25;

    @property({ tooltip: 'Vận tốc bay cố định của đạn', visible: function (this: SpawnBullet) { return this.useFixedTrajectory; } })
    public fixedVelocity: number = 20;

    @property({ tooltip: 'Tỷ lệ chiều cao vòng cung. Tránh lỗi đạn bay quá nhanh gây xuyên block khi mục tiêu ở xa.', visible: function (this: SpawnBullet) { return !this.useFixedTrajectory && !this.useUnityStraightShoot; } })
    public arcHeightRatio: number = 0.3;

    @property({ tooltip: 'Bật để sử dụng lại logic tính toán lực (shootForce) nguyên gốc từ C# Unity (bắn thẳng không có vòng cung)', group: { name: 'Legacy Unity Mode' } })
    public useUnityStraightShoot: boolean = true;

    // --- LEVEL SETTINGS ---
    @property({ tooltip: 'Lực nổ của Level (levelExplosionForce). Nếu = 0 và có nổ thì giảm mass đạn.', group: { name: 'Level Settings' } })
    public levelExplosionForce: number = 0;

    @property({ tooltip: 'Tỉ lệ giảm Mass nếu vô hiệu hóa nổ (DisabledExplosionCollisionMassRatio)', group: { name: 'Level Settings' } })
    public disabledExplosionCollisionMassRatio: number = 0.5;

    // Sử dụng NodePool của Cocos để tái sử dụng đạn (Vì đạn sinh ra liên tục)
    private _bulletPool: NodePool = new NodePool();
    private _spawnedBullets: Node[] = [];

    /**
     * Hàm mặc định từ SpawnBase, không dùng cho Bullet (ta dùng hàm spawnBullet bên dưới)
     */
    public spawn(gameplayData?: any): void {
        // Do nothing for static spawn
    }

    /**
     * Spawn đạn và bắn về phía mục tiêu
     */
    public spawnBullet(position: Vec3, rotation: Quat, targetPoint: Vec3, shootForce: number): Node | null {
        if (!this.bulletPrefab) {
            console.error('[SpawnBullet] bulletPrefab bị trống! Vui lòng kéo Prefab đạn vào Inspector.');
            return null;
        }

        // Lấy đạn từ Pool (nếu có sẵn) hoặc tạo mới (instantiate)
        let bulletNode = this._bulletPool.size() > 0 ? this._bulletPool.get() : instantiate(this.bulletPrefab);
        if (!bulletNode) return null;

        // Gắn vào node hiện tại
        this.node.addChild(bulletNode);

        // Đặt vị trí, góc và hiển thị
        bulletNode.active = true;
        bulletNode.setWorldPosition(position);
        bulletNode.setWorldRotation(rotation);

        this._prepareBulletPhysics(bulletNode, position, targetPoint, shootForce);

        this._spawnedBullets.push(bulletNode);
        return bulletNode;
    }

    /**
     * Bắn một quả bóng CÓ SẴN (Ví dụ: bóng đang lăn trên máng) thay vì spawn bóng mới
     */
    public fireExistingBullet(bulletNode: Node, targetPoint: Vec3, shootForce: number): Node | null {
        if (!bulletNode || !bulletNode.isValid) return null;

        // Đổi parent về SpawnBullet để quản lý chung và GIỮ NGUYÊN tọa độ thế giới (keepWorldTransform = true)
        bulletNode.setParent(this.node, true);

        this._prepareBulletPhysics(bulletNode, bulletNode.worldPosition, targetPoint, shootForce);

        this._spawnedBullets.push(bulletNode);
        return bulletNode;
    }

    /**
     * Hàm dùng chung chuẩn hóa vật lý và setup đạn để đảm bảo DRY (Don't Repeat Yourself)
     */
    private _prepareBulletPhysics(bulletNode: Node, startPos: Readonly<Vec3>, targetPoint: Vec3, shootForce: number): void {
        const proj = bulletNode.getComponent(Projectile);
        if (!proj) return;

        // Xử lý Physics (RigidBody)
        const rb = bulletNode.getComponent(RigidBody);
        if (rb) {
            // Tính toán Unity Mass Scaling để giảm lực va chạm (sát thương) khi level vô hiệu hóa nổ
            const launchMass = Math.max(proj.mass, 0.0001);
            const explosionDisabledForLevel = proj.hasExplosion && Math.abs(this.levelExplosionForce) < 1e-6;
            rb.mass = explosionDisabledForLevel
                ? Math.max(launchMass * this.disabledExplosionCollisionMassRatio, 0.0001)
                : launchMass;

            // Xóa rác vật lý cũ
            rb.group = 1 << 11;
            rb.useCCD = true;
            rb.clearState();
            rb.setLinearVelocity(Vec3.ZERO);
            rb.setAngularVelocity(Vec3.ZERO);

            const colliders = bulletNode.getComponentsInChildren(Collider);
            for (let i = 0; i < colliders.length; i++) {
                colliders[i].setGroup(1 << 11);
                // Đổi sang Material mới nếu có cấu hình trên Inspector
                if (this.firedPhysicsMaterial) {
                    colliders[i].sharedMaterial = this.firedPhysicsMaterial;
                }
            }
            rb.linearFactor = new Vec3(1, 1, 1);
            rb.angularFactor = new Vec3(1, 1, 1);

            if (this.useUnityStraightShoot) {
                // Bắn đạn thẳng trực tiếp bằng logic Impulse từ Unity (dùng shootForce)
                TrajectoryCalculator.applyUnityStraightImpulse(
                    rb, bulletNode, startPos, targetPoint, shootForce,
                    proj.mass, rb.linearDamping, rb.angularDamping,
                    proj.hasExplosion, this.levelExplosionForce, this.disabledExplosionCollisionMassRatio
                );
            } else {
                // Bắn đạn theo quỹ đạo parabol (Zero GC setup bên trong TrajectoryCalculator)
                TrajectoryCalculator.applyShootImpulse(
                    rb, bulletNode, startPos, targetPoint, shootForce,
                    this.useFixedTrajectory, this.fixedAngle, this.fixedVelocity, this.arcHeightRatio,
                    proj.gravityScale
                );
            }
        }

        // Báo cho Projectile script biết để hoạt động
        proj.enabled = true; // Bật script lên để nó chạy bắt va chạm
        if (proj.startLifetime) proj.startLifetime(); // Chỉ bắt đầu đếm giờ tự hủy khi thực sự bắn ra
        if (proj.trailNode) proj.trailNode.active = true; // Bật hiệu ứng trail khi thực sự bắn
    }

    /**
     * Thu hồi đạn về Pool (gọi từ script Projectile khi đạn chạm mục tiêu hoặc hết giờ)
     */
    public despawnBullet(bulletNode: Node): void {
        if (!bulletNode || !bulletNode.isValid) return;

        const idx = this._spawnedBullets.indexOf(bulletNode);
        if (idx !== -1) {
            this._spawnedBullets.splice(idx, 1);
        }

        // Tắt hiển thị
        bulletNode.active = false;

        // Xóa sạch trạng thái vật lý cũ trước khi cất
        const rb = bulletNode.getComponent(RigidBody);
        if (rb) {
            rb.clearState();
        }

        // Bỏ lại vào Pool
        this._bulletPool.put(bulletNode);
    }

    /**
     * Thu hồi toàn bộ đạn đang bay (Dùng khi Reset Game)
     */
    public clearAll(): void {
        for (let i = 0; i < this._spawnedBullets.length; i++) {
            const b = this._spawnedBullets[i];
            if (b && b.isValid) {
                b.active = false;
                const rb = b.getComponent(RigidBody);
                if (rb) rb.clearState();

                this._bulletPool.put(b);
            }
        }
        this._spawnedBullets = [];
    }
}
