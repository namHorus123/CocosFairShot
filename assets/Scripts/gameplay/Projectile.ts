import { _decorator, Component, Node, RigidBody, Collider, Vec3, tween, ICollisionEvent, PhysicsSystem } from 'cc';
import { SpawnBullet } from '../spawn/SpawnBullet';
import { BulletImpactForceType, LayerVelocityRetention, LayerSoundMapping } from '../mechanics/ProjectileConfig';
import { TargetReceiver } from '../mechanics/TargetReceiver';
import { SoundManager } from '../Utility/SoundManager';
import { Block } from './Block';
import { BlockSoundConfig } from '../Utility/BlockSoundConfig';

const { ccclass, property } = _decorator;

@ccclass('Projectile')
export class Projectile extends Component {
    // --- Lifetime & Collision ---
    @property({ group: { name: 'Lifetime & Collision', id: '1' }, displayName: 'Lifetime' })
    public lifetime: number = 1.75;

    @property({ group: { name: 'Lifetime & Collision', id: '1' }, displayName: 'Destroy On Collision' })
    public destroyOnCollision: boolean = false;

    @property({ type: Vec3, group: { name: 'Lifetime & Collision', id: '1' }, displayName: 'Default Scale', tooltip: 'Kích thước mặc định của đạn' })
    public defaultScale: Vec3 = new Vec3(1, 1, 1);

    // --- Physics ---
    @property({ group: { name: 'Physics', id: '2' }, displayName: 'Mass' })
    public mass: number = 2.5;

    @property({ group: { name: 'Physics', id: '2' }, displayName: 'Linear Damping' })
    public linearDamping: number = 0.2;

    @property({ group: { name: 'Physics', id: '2' }, displayName: 'Angular Damping' })
    public angularDamping: number = 0.5;

    @property({ group: { name: 'Physics', id: '2' }, displayName: 'Max Angular Velocity' })
    public maxAngularVelocity: number = 100;

    @property({ group: { name: 'Physics', id: '2' }, displayName: 'Gravity Scale' })
    public gravityScale: number = 30;

    // --- Layer Velocity Retentions ---
    @property({ type: [LayerVelocityRetention], group: { name: 'Layer Velocity Retentions', id: '3' }, displayName: 'Layer Velocity Retentions' })
    public layerVelocityRetentions: LayerVelocityRetention[] = [];

    // --- Layer Sound Mappings ---
    @property({ type: [LayerSoundMapping], group: { name: 'Layer Sound Mappings', id: '4' }, displayName: 'Layer Sound Mappings' })
    public layerSoundMappings: LayerSoundMapping[] = [];

    // --- Explosion Configs ---
    @property({ group: { name: 'Explosion Configs', id: '5' }, displayName: 'Has Explosion' })
    public hasExplosion: boolean = false;

    @property({ type: BulletImpactForceType, group: { name: 'Explosion Configs', id: '5' }, displayName: 'Impact Force Type' })
    public impactForceType: BulletImpactForceType = BulletImpactForceType.Forward;

    @property({ group: { name: 'Explosion Configs', id: '5' }, displayName: 'Explosion Force' })
    public explosionForce: number = 100;

    @property({ group: { name: 'Explosion Configs', id: '5' }, displayName: 'Explosion Radius' })
    public explosionRadius: number = 0.8;

    @property({ group: { name: 'Explosion Configs', id: '5' }, displayName: 'Explosion Upwards Modifier' })
    public explosionUpwardsModifier: number = 0;

    @property({ group: { name: 'Explosion Configs', id: '5' }, displayName: 'Block Layer' })
    public blockLayer: number = 0xffffffff;

    @property({ type: Node, displayName: 'Trail Node', tooltip: 'Kéo thả Trail vào đây' })
    public trailNode: Node | null = null;

    private _rb: RigidBody | null = null;
    private _collider: Collider | null = null;

    private _hasPlayedCollisionSound: boolean = false;
    private _hasExploded: boolean = false;
    private _isDespawning: boolean = false;

    // Cache để tối ưu GC (Garbage Collection cực kỳ quan trọng cho Playable Ads)
    private _preCollisionVelocityDir: Vec3 = new Vec3(0, 0, 1);
    private _tempVel: Vec3 = new Vec3();
    private _tempForce: Vec3 = new Vec3();
    private static _hitPointCache: Vec3 = new Vec3();

    onLoad() {
        this._rb = this.getComponent(RigidBody);
        this._collider = this.getComponent(Collider);

        if (this._collider) {
            this._collider.on('onCollisionEnter', this.onCollisionEnter, this);
        }
    }

    onEnable() {
        if (this.trailNode) {
            // Tắt trail ban đầu, chỉ bật lên khi thực sự bắn (bên trong SpawnBullet)
            this.trailNode.active = false;
        }

        this._hasPlayedCollisionSound = false;
        this._hasExploded = false;
        this._isDespawning = false;

        // Reset scale lúc vừa lấy lại từ Pool bằng thông số bạn cấu hình ở Inspector
        this.node.scale = this.defaultScale;

        if (this._rb) {
            this._rb.isKinematic = false;
            this._rb.mass = this.mass;
            this._rb.linearDamping = this.linearDamping;
            this._rb.angularDamping = this.angularDamping;
        }

        if (this._collider) {
            this._collider.enabled = true;
        }
    }

    // Được gọi khi đạn được SpawnBullet bắn ra
    public startLifetime() {
        this.unschedule(this.despawnOrDestroy);
        this.scheduleOnce(this.despawnOrDestroy, this.lifetime);
    }

    onDisable() {
        this.unschedule(this.despawnOrDestroy);
    }

    update(dt: number) {
        if (this._rb && !this._rb.isKinematic) {
            // Tối ưu: Để nguyên useGravity mặc định của engine (1g) cho bóng lăn trên máng.
            // Khi viên đạn được bắn (script được enable), ta chỉ cộng thêm phần lực trọng trường bị thiếu.
            if (this.gravityScale !== 1) {
                const gravityVec = PhysicsSystem.instance.gravity;
                this._tempForce.set(gravityVec);
                this._tempForce.multiplyScalar((this.gravityScale - 1) * this._rb.mass);
                this._rb.applyForce(this._tempForce);
            }

            // Lưu hướng bay trước khi va chạm
            this._rb.getLinearVelocity(this._tempVel);
            if (this._tempVel.lengthSqr() > 0.01) {
                Vec3.normalize(this._preCollisionVelocityDir, this._tempVel);
            }
        }
    }

    private onCollisionEnter(event: ICollisionEvent) {
        if (!this.enabled || this._isDespawning) return;

        const otherNode = event.otherCollider.node;
        // console.log(`[Projectile] Bắt đầu va chạm - Node: ${otherNode.name}, Layer: ${otherNode.layer}`);

        // Tắt TrailRenderer ngay khi chạm
        if (this.trailNode) {
            this.trailNode.active = false;
        }

        // --- OOP Pipeline: Tách nhỏ các logic để dễ bảo trì ---
        this._handleTargetHit(otherNode, event);
        this._handleSoundAndEffect(otherNode);
        this._handleExplosion(event);

        if (this.destroyOnCollision) {
            this.despawnOrDestroy();
        } else {
            this._handleVelocityRetention(otherNode);
        }
    }

    private _handleTargetHit(otherNode: Node, event: ICollisionEvent) {
        const target = otherNode.getComponent(TargetReceiver);
        if (target && target.onProjectileHit) {
            target.onProjectileHit(this, event);
        }
    }

    private _handleSoundAndEffect(otherNode: Node) {
        if (this._hasPlayedCollisionSound) return;

        const colLayer = otherNode.layer;

        // TỐI ƯU ZERO-GC: Dùng class reference thay vì truyền chuỗi (string) vào getComponent
        const block = otherNode.getComponent(Block) || (otherNode.parent && otherNode.parent.getComponent(Block));
        const hasEntity = !!block;

        // TODO: Bật EffectManager.SpawnEffect(effect, hitPoint, colorType) ở đây nếu có GameManager

        if (!hasEntity && this.layerSoundMappings.length > 0) {
            for (let i = 0; i < this.layerSoundMappings.length; i++) {
                const item = this.layerSoundMappings[i];
                if (((1 << colLayer) & item.layerValue) !== 0) {
                    // TODO: Gọi SoundManager.Instance.PlayOneShot(item.soundId)
                    this._hasPlayedCollisionSound = true;
                    break;
                }
            }
        } else if (hasEntity) {
            const soundName = block ? BlockSoundConfig.getImpactSound(block.objectId) : 'SFX_impact_Default';
            SoundManager.Instance(SoundManager).playSound(soundName);
            this._hasPlayedCollisionSound = true;
        }
    }

    private _handleExplosion(event: ICollisionEvent) {
        if (!this.hasExplosion || this.explosionForce <= 0 || this._hasExploded) return;

        this._hasExploded = true;

        // Zero GC: Sử dụng biến static để tránh cấp phát Vec3 mới mỗi lần nổ
        Vec3.copy(Projectile._hitPointCache, this.node.worldPosition);
        if (event.contacts.length > 0) {
            event.contacts[0].getWorldPointOnA(Projectile._hitPointCache);
        }

        this.explode(Projectile._hitPointCache, this._preCollisionVelocityDir, event.otherCollider.attachedRigidBody);
    }

    private _handleVelocityRetention(otherNode: Node) {
        if (!this._rb) return;

        let retention = 1.0;
        const colLayer = otherNode.layer;

        // TỐI ƯU ZERO-GC: Tìm component Block trực tiếp, tránh rác RAM từ string matching
        const entity = otherNode.getComponent(Block) || (otherNode.parent ? otherNode.parent.getComponent(Block) : null);

        if (entity && entity.isPenetrable) {
            retention = 1.0;
        } else if (this.layerVelocityRetentions.length > 0) {
            for (let i = 0; i < this.layerVelocityRetentions.length; i++) {
                const item = this.layerVelocityRetentions[i];
                if (((1 << colLayer) & item.layerValue) !== 0) {
                    retention = item.velocityRetention;
                    break;
                }
            }
        }

        this._rb.getLinearVelocity(this._tempVel);
        this._tempVel.multiplyScalar(retention);
        this._rb.setLinearVelocity(this._tempVel);

        this._rb.getAngularVelocity(this._tempVel);
        this._tempVel.multiplyScalar(retention);
        this._rb.setAngularVelocity(this._tempVel);
    }

    private explode(explosionPoint: Vec3, forwardDir: Vec3, directHitRb: RigidBody | null) {
        // Tối ưu cho Playable: Chỉ apply lực lên đúng cái RigidBody bị chạm thay vì dùng OverlapSphere tốn kém CPU trên mobile web.
        if (!directHitRb || directHitRb.isKinematic) return;

        if (this.impactForceType === BulletImpactForceType.Explosion) {
            Vec3.subtract(this._tempForce, directHitRb.node.worldPosition, explosionPoint);
            this._tempForce.normalize();
            this._tempForce.y += this.explosionUpwardsModifier * 0.1;
            this._tempForce.normalize();
            this._tempForce.multiplyScalar(this.explosionForce);
        } else {
            Vec3.multiplyScalar(this._tempForce, forwardDir, this.explosionForce);
        }

        // FIX VẬT LÝ FAKE: Apply lực tại ĐIỂM VA CHẠM (không phải tâm) để tạo xoay tự nhiên
        // relativePoint = explosionPoint - node.worldPosition (tọa độ tương đối so với tâm block)
        Vec3.subtract(this._tempVel, explosionPoint, directHitRb.node.worldPosition);
        directHitRb.applyImpulse(this._tempForce, this._tempVel);
    }

    private despawnOrDestroy() {
        if (this._isDespawning) return;
        this._isDespawning = true;

        this.unschedule(this.despawnOrDestroy);

        // Ngắt tương tác vật lý ngay lập tức
        if (this._rb) {
            this._rb.setLinearVelocity(Vec3.ZERO);
            this._rb.setAngularVelocity(Vec3.ZERO);
            this._rb.isKinematic = true;
        }

        if (this._collider) {
            this._collider.enabled = false;
        }

        tween(this.node)
            .to(0.2, { scale: Vec3.ZERO }, { easing: 'backIn' })
            .call(() => {
                // Khôi phục trạng thái chuẩn từ defaultScale, triệt tiêu lệnh .clone() sinh GC
                this.node.scale = this.defaultScale;
                if (this._collider) this._collider.enabled = true;
                if (this._rb) this._rb.isKinematic = false;

                this._isDespawning = false;

                const spawnBulletAny = SpawnBullet.instance as any;
                if (spawnBulletAny && typeof spawnBulletAny.despawnBullet === 'function') {
                    spawnBulletAny.despawnBullet(this.node);
                } else {
                    this.node.destroy();
                }
            })
            .start();
    }
}
