import { _decorator, Component, Node, RigidBody, Collider, Vec3, tween, ICollisionEvent, Enum } from 'cc';
const { ccclass, property } = _decorator;

export enum BulletImpactForceType {
    Forward = 0,
    Explosion = 1
}

// Đăng ký Enum cho Editor
Enum(BulletImpactForceType);

@ccclass('Projectile')
export class Projectile extends Component {
    @property({ tooltip: 'Thời gian sống tối đa của đạn (giây)' })
    public lifetime: number = 5;

    @property({ tooltip: 'Phá hủy ngay khi chạm vật thể?' })
    public destroyOnCollision: boolean = true;

    @property({ tooltip: 'Đạn có tạo lực nổ khi chạm không?' })
    public hasExplosion: boolean = false;

    @property({ tooltip: 'Lực đẩy tác động lên vật thể khi va chạm' })
    public explosionForce: number = 5;

    @property({ type: BulletImpactForceType, tooltip: 'Loại lực: Đẩy tới trước hay Nổ tung' })
    public impactForceType: BulletImpactForceType = BulletImpactForceType.Forward;

    private _rb: RigidBody | null = null;
    private _collider: Collider | null = null;

    private _hasExploded: boolean = false;
    private _isDespawning: boolean = false;

    // Cache object để tối ưu Garbage Collection (rất quan trọng trong Playable Ads)
    private _preCollisionVelocityDir: Vec3 = new Vec3(0, 0, 1);
    private _tempVel: Vec3 = new Vec3();
    private _tempForce: Vec3 = new Vec3();

    onLoad() {
        this._rb = this.getComponent(RigidBody);
        this._collider = this.getComponent(Collider);

        if (this._collider) {
            // Lắng nghe sự kiện va chạm vật lý
            this._collider.on('onCollisionEnter', this.onCollisionEnter, this);
        }
    }

    onEnable() {
        this._hasExploded = false;
        this._isDespawning = false;
        this.node.scale = Vec3.ONE;

        if (this._rb) {
            this._rb.isKinematic = false;
        }

        if (this._collider) {
            this._collider.enabled = true;
        }

        // Dùng scheduleOnce có sẵn của Cocos thay cho UniTask (cực nhẹ và ko rác bộ nhớ)
        this.scheduleOnce(this.despawnOrDestroy, this.lifetime);
    }

    onDisable() {
        this.unschedule(this.despawnOrDestroy);
    }

    update(dt: number) {
        // Lưu hướng bay trước khi va chạm
        if (this._rb && !this._rb.isKinematic) {
            this._rb.getLinearVelocity(this._tempVel);
            if (this._tempVel.lengthSqr() > 0.01) {
                Vec3.normalize(this._preCollisionVelocityDir, this._tempVel);
            }
        }
    }

    private onCollisionEnter(event: ICollisionEvent) {
        if (this._isDespawning) return;

        const otherNode = event.otherCollider.node;

        // Gửi event hoặc xử lý trực tiếp thay vì GetComponent quá sâu
        // Giả sử TargetReceiver là script gắn trên mục tiêu
        let target = otherNode.getComponent('TargetReceiver') as any;
        if (target && target.onProjectileHit) {
            target.onProjectileHit(this, event);
        }

        if (this.hasExplosion && this.explosionForce > 0 && !this._hasExploded) {
            this._hasExploded = true;

            let hitPoint = this.node.worldPosition;
            if (event.contacts.length > 0) {
                event.contacts[0].getWorldPointOnA(hitPoint);
            }
            // Truyền RigidBody của vật bị chạm vào để tính lực
            this.explode(hitPoint, this._preCollisionVelocityDir, event.otherCollider.attachedRigidBody);
        }

        if (this.destroyOnCollision) {
            this.despawnOrDestroy();
        } else {
            // Nếu không phá hủy, chỉ giảm 50% vận tốc thay vì logic loop layer phức tạp
            if (this._rb) {
                this._rb.getLinearVelocity(this._tempVel);
                this._tempVel.multiplyScalar(0.5);
                this._rb.setLinearVelocity(this._tempVel);
            }
        }
    }

    private explode(explosionPoint: Vec3, forwardDir: Vec3, directHitRb: RigidBody | null) {
        // Cocos ko có Physics.OverlapSphere dễ dùng như Unity. 
        // Trong Playable Ads, check OverlapSphere rất tốn CPU trên mobile web.
        // Cách tối ưu nhất là chỉ apply lực trực tiếp lên vật thể bị chạm.

        if (!directHitRb || directHitRb.isKinematic) return;

        if (this.impactForceType === BulletImpactForceType.Explosion) {
            // Fake explosion force (Đẩy văng vật thể ra xa khỏi điểm chạm)
            Vec3.subtract(this._tempForce, directHitRb.node.worldPosition, explosionPoint);
            this._tempForce.normalize();
            this._tempForce.multiplyScalar(this.explosionForce);
        } else {
            // Forward force (Đẩy vật thể theo hướng đạn bay)
            Vec3.multiplyScalar(this._tempForce, forwardDir, this.explosionForce);
        }

        directHitRb.applyImpulse(this._tempForce);
    }

    private despawnOrDestroy() {
        if (this._isDespawning) return;
        this._isDespawning = true;
        this.unschedule(this.despawnOrDestroy);

        // Ngắt tương tác vật lý
        if (this._rb) {
            this._rb.setLinearVelocity(Vec3.ZERO);
            this._rb.setAngularVelocity(Vec3.ZERO);
            this._rb.isKinematic = true;
        }

        if (this._collider) {
            this._collider.enabled = false;
        }

        // Thay LMotion bằng cc.tween (API native của Cocos cực nhẹ)
        tween(this.node)
            .to(0.2, { scale: Vec3.ZERO }, { easing: 'backIn' })
            .call(() => {
                // Nếu dự án có NodePool thì đổi thành NodePool.put(this.node)
                this.node.destroy();
            })
            .start();
    }
}
