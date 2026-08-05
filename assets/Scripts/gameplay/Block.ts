import {
    _decorator, Component, Node, RigidBody, Collider, Vec3, ICollisionEvent,
    Enum, PhysicsSystem, ITriggerEvent, MeshRenderer,
    log
} from 'cc';
import { ShatterHitBehavior } from '../mechanics/ShatterHitBehavior';
import { DeformHitBehavior } from '../mechanics/DeformHitBehavior';
import { GameManager } from '../manager/GameManager';
import { SoundManager } from '../Utility/SoundManager';
import { BlockSoundConfig } from '../Utility/BlockSoundConfig';
import { BlockPhysicsBehavior } from './BlockPhysicsBehavior';
const { ccclass, property } = _decorator;



export enum HitTriggerType {
    OnlyGround = 0,
    BallOrGround = 1
}
Enum(HitTriggerType);

export enum EffectType {
    ImpactBulletDefault = 0,
    Break = 1
}
Enum(EffectType);

@ccclass('Block')
export class Block extends Component {
    // --- STATIC REGISTRY (Zero-GC Optimization) ---
    private static readonly _activeBlocks: Block[] = [];

    // --- CONFIG ---

    @property
    public objectId: string = 'Block_Default';

    @property({ tooltip: 'Trọng lực tùy chỉnh (tự apply thay engine)' })
    public gravityScale: number = 25;

    @property({ tooltip: 'Giới hạn Y, rớt dưới mức này sẽ bị ẩn' })
    public outOfBoundsY: number = -10;

    @property({ type: HitTriggerType })
    public hitTriggerType: HitTriggerType = HitTriggerType.OnlyGround;

    @property({ tooltip: 'Cho phép bóng xuyên qua (không làm giảm tốc lực bóng)' })
    public isPenetrable: boolean = false;

    @property({ tooltip: 'Cho phep Block mo khoa xoay sau khi SpawnObjectIngame cho xong.' })
    public allowRotationAfterSpawn: boolean = false;

    // --- PRIVATE STATE ---

    private _initialized: boolean = false;
    private _isDestroyed: boolean = false;
    public get isDestroyed(): boolean { return this._isDestroyed; }

    private _rb: RigidBody | null = null;
    private _meshRenderer: MeshRenderer | null = null;
    private _hitBehavior: ShatterHitBehavior | DeformHitBehavior | null = null;

    // Tối ưu: Cache mảng Collider 1 lần để tránh getComponent liên tục
    private _colliders: Collider[] = [];

    // Ground effect
    private _effectType: EffectType = EffectType.ImpactBulletDefault;
    private _groundGroup: number = -1;
    private _hasGroundEffect: boolean = true;

    // Component quản lý vật lý riêng biệt
    private _physicsBehavior: BlockPhysicsBehavior | null = null;

    // --- LIFECYCLE ---

    onLoad() {
        this._rb = this.getComponent(RigidBody);
        this._meshRenderer = this.getComponent(MeshRenderer);
        this._hitBehavior = this.getComponent(ShatterHitBehavior) || this.getComponent(DeformHitBehavior);
        this._colliders = this.getComponentsInChildren(Collider);

        // Cảnh báo nếu Prefab bị thiếu component quan trọng
        if (!this._rb) {
            console.warn(`[Block] Node "${this.node.name}" thiếu RigidBody! Kiểm tra lại Prefab.`);
        }
        if (this._colliders.length === 0) {
            console.warn(`[Block] Node "${this.node.name}" không có Collider nào! Kiểm tra lại Prefab.`);
        }

        // Tự động gán hoặc tạo BlockPhysicsBehavior để quản lý vật lý
        this._physicsBehavior = this.getComponent(BlockPhysicsBehavior);
        if (!this._physicsBehavior) {
            this._physicsBehavior = this.addComponent(BlockPhysicsBehavior);
        }
    }

    start() {
        this._initialized = true;

        if (this._rb) {
            this._rb.useGravity = false;
        }

        // Lắng nghe va chạm trên tất cả các collider
        for (let i = 0; i < this._colliders.length; i++) {
            if (this._colliders[i]) {
                this._colliders[i].on('onCollisionEnter', this.onCollisionEnter, this);
                this._colliders[i].on('onTriggerEnter', this.onTriggerEnter, this);
            }
        }

        this.initPhysicsState();
    }

    onEnable() {
        Block._activeBlocks.push(this);
        if (!this._initialized) return;
        this.initPhysicsState();
    }

    onDisable() {
        const idx = Block._activeBlocks.indexOf(this);
        if (idx >= 0) Block._activeBlocks.splice(idx, 1);

        this.unscheduleAllCallbacks();

        if (this.isPenetrable) {
            this.setCollidersTrigger(false);
        }
    }

    onDestroy() {
        // Tối ưu OOP: Dọn dẹp listener sự kiện để chống tràn RAM
        for (let i = 0; i < this._colliders.length; i++) {
            if (this._colliders[i] && this._colliders[i].isValid) {
                this._colliders[i].off('onCollisionEnter', this.onCollisionEnter, this);
                this._colliders[i].off('onTriggerEnter', this.onTriggerEnter, this);
            }
        }
    }

    private initPhysicsState() {
        this._isDestroyed = false;

        if (this._rb) {
            this._rb.clearState();
        }

        // Gọi sang component chuyên trách vật lý để khởi tạo
        if (this._physicsBehavior) {
            this._physicsBehavior.initPhysics(this._rb, this._colliders, this.objectId, this.gravityScale);
        }

        if (this.isPenetrable) {
            this.setCollidersTrigger(false);
            this.unschedule(this.enableTriggerAfterDelay);
            this.scheduleOnce(this.enableTriggerAfterDelay, 0.2);
        }

        if (this._hitBehavior) {
            if (this._meshRenderer) this._meshRenderer.enabled = true;

            if (this._rb) this._rb.enabled = true;

            // Bật lại tất cả colliders
            for (let i = 0; i < this._colliders.length; i++) {
                if (this._colliders[i]) this._colliders[i].enabled = true;
            }

            this._hitBehavior.resetBehavior();
        }
    }

    // --- COLLIDER TRIGGER HELPERS ---

    private setCollidersTrigger(isTrigger: boolean) {
        for (let i = 0; i < this._colliders.length; i++) {
            const col = this._colliders[i];
            if (col && col.node !== this.node) {
                col.isTrigger = isTrigger;
            }
        }
    }

    private enableTriggerAfterDelay() {
        this.setCollidersTrigger(true);
    }

    // --- COLLISION HANDLERS ---

    private onTriggerEnter(event: ITriggerEvent) {
        if (this._isDestroyed) return;
        this.handleCollision(event.otherCollider, true);
    }

    private onCollisionEnter(event: ICollisionEvent) {
        if (this._isDestroyed) return;
        if (this._physicsBehavior) {
            this._physicsBehavior.tryUnlockRotationByImpact(event);
            this._physicsBehavior.redirectStraightUpJump(event.otherCollider);
        }
        this.handleCollision(event.otherCollider, false);
    }

    private handleCollision(otherCollider: Collider, isTrigger: boolean) {
        const otherNode = otherCollider.node;

        // LOẠI TRỪ TARGET: Không tương tác/vỡ khi chạm vào các vùng đích (VD: Planeeeeee)
        if (otherNode.getComponent('TargetReceiver')) {
            return;
        }

        let shouldDestroy = false;
        let hitByBall = false;

        // FIX TẬN GỐC LỖI KHÔNG NHẬN DIỆN ĐƯỢC BÓNG: 
        // 1. Quét ngược lên tận root để tìm Projectile (phòng trường hợp Collider nằm tuốt sâu bên trong file model 3D)
        // 2. Dự phòng bằng Group Physics 2048 (1 << 11) được cấp cứng trong SpawnBullet.ts
        let isBall = false;
        let currNode = otherNode;
        while (currNode) {
            if (currNode.getComponent('Projectile')) {
                isBall = true;
                break;
            }
            currNode = currNode.parent;
        }
        if (!isBall && otherCollider.getGroup() === 2048) {
            isBall = true;
        }

        // THÊM XỬ LÝ ROTATION KHI BỊ BÓNG BẮN
        // if (isBall && this._physicsBehavior) {
        //     this._physicsBehavior.applyHitSpin();

        //     // Đánh thức toàn bộ khối khác ngay lập tức khi va chạm xảy ra để triệt tiêu hiện tượng lơ lửng (floating bug)
        //     for (let i = 0; i < Block._activeBlocks.length; i++) {
        //         const activeBlock = Block._activeBlocks[i];
        //         if (activeBlock !== this && activeBlock._rb && activeBlock._rb.isValid) {
        //             activeBlock._rb.wakeUp();
        //         }
        //     }
        // }

        let isGround = false;
        if (!isBall) {
            // NHẬN DIỆN CHUẨN XÁC THEO LOG: Group Physics = 32 hoặc Node Layer = 1073741824
            isGround = (otherCollider.getGroup() === 32) || (otherNode.layer === 1073741824);

            // Dự phòng bằng tên (tùy chọn)
            if (!isGround) {
                const nodeName = otherNode.name.toLowerCase();
                isGround = nodeName.indexOf('wall') >= 0 || nodeName.indexOf('ground') >= 0;
            }
        }

        // Cứng hóa riêng cho Jar: Bị bóng bắn vào (va chạm vật lý) là vỡ luôn
        if (this.objectId === 'Jar') {
            if (isBall && (this.isPenetrable || !isTrigger)) {
                shouldDestroy = true;
                hitByBall = true;
            } else if (isGround) {
                SoundManager.Instance(SoundManager).playSound(BlockSoundConfig.getBreakSound(this.objectId));
                shouldDestroy = true;
            }
        } else {
            // Các vật thể khác (Ice, Stone, Metal...) để bình thường theo logic gốc
            if (isGround) {
                SoundManager.Instance(SoundManager).playSound(BlockSoundConfig.getBreakSound(this.objectId));
                shouldDestroy = true;
            } else if (this.hitTriggerType === HitTriggerType.BallOrGround && isBall) {
                // Thêm !isTrigger để fix lỗi "bóng bay gần tới (quẹt trúng viền trigger ảo) đã vỡ"
                if (!isTrigger) {
                    shouldDestroy = true;
                    hitByBall = true;
                }
            }
        }

        if (shouldDestroy) {
            this.destroyEntity(true, hitByBall);
        }
    }

    // --- GROUND EFFECT API ---

    public setGroundEffect(effectType: EffectType, groundGroup: number) {
        this._effectType = effectType;
        this._groundGroup = groundGroup;
        this._hasGroundEffect = true;
    }

    // --- UPDATE: GRAVITY & STABILIZATION ---

    update(dt: number) {
        // Safety net: nếu object xuyên qua ground, ẩn nó đi
        if (!this._isDestroyed && this.node.worldPosition.y < this.outOfBoundsY) {
            this.destroyEntity(false, false);
            return;
        }
    }

    // --- DESTROY ENTITY ---

    private destroyEntity(playHitEffect: boolean, hitByBall: boolean) {
        if (this._isDestroyed) return;
        this._isDestroyed = true;

        // TỐI ƯU ZERO-GC: Giải quyết Floating Bug mà không cần quét director.getScene
        for (let i = 0; i < Block._activeBlocks.length; i++) {
            const block = Block._activeBlocks[i];
            if (block !== this && block._rb && block._rb.isValid) {
                block._rb.wakeUp();
            }
        }

        if (GameManager.instance) {
            GameManager.instance.onObjectDestroyed();
        }

        if (playHitEffect) {
            if (this._hitBehavior) {
                if (this._meshRenderer) this._meshRenderer.enabled = false;

                // Tắt vật lý (CHỈ tắt collider của Block gốc, KHÔNG tắt collider của các mảnh vỡ Shards)
                for (let i = 0; i < this._colliders.length; i++) {
                    if (this._colliders[i] && this._colliders[i].node === this.node) {
                        if (this.objectId !== 'Metal') {
                            this._colliders[i].enabled = false;
                        }
                    }
                }

                if (this._rb && this.objectId !== 'Metal') {
                    this._rb.enabled = false;
                }

                // Chạy hiệu ứng vỡ
                if (!hitByBall && this._hitBehavior instanceof ShatterHitBehavior) {
                    this._hitBehavior.flingShards = true;
                }

                if (this._hitBehavior instanceof ShatterHitBehavior) {
                    const allowShardRotation = this.objectId === 'Jar';
                    this._hitBehavior.playEffect(allowShardRotation);
                } else {
                    this._hitBehavior.playEffect();
                }

                let destroyDelay = 1.0;
                if (this.objectId === 'Ice') {
                    if (!hitByBall) {
                        destroyDelay = 1;
                    } else {
                        const waitBeforeMelt = 0.75;
                        const meltDuration = 0.25;
                        destroyDelay = waitBeforeMelt + meltDuration + 0.1;
                    }
                }
                if (this.objectId === 'Jar') {
                    destroyDelay = 0.5;
                }

                this.unschedule(this.deactivateDelay);
                this.scheduleOnce(this.deactivateDelay, destroyDelay);
            } else {
                this.node.active = false;
            }
        } else {
            this.node.active = false;
        }
    }

    private deactivateDelay() {
        this.node.active = false;
    }
}
