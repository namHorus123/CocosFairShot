import { _decorator, Component, RigidBody, Collider, BoxCollider, Vec3, PhysicsSystem, PhysicsMaterial, ICollisionEvent, math } from 'cc';
import { SpawnObjectIngame } from '../spawn/SpawnObjectIngame';

const { ccclass, property } = _decorator;

@ccclass('BlockPhysicsBehavior')
export class BlockPhysicsBehavior extends Component {
    @property({ tooltip: 'Khối lượng của vật thể nặng (Metal, Stone)' })
    public massHeavy: number = 6.0;

    // @property({ tooltip: 'Khối lượng của cục băng (Ice)' })
    // public massIce: number = 3.0; // Đã tăng lên 3.0 để hạn chế văng quá xa

    @property({ tooltip: 'Khối lượng của vật thể nhẹ (Wood)' })
    public massLight: number = 0.5;

    @property({ tooltip: 'Khối lượng của Bình (Jar) để khó bị xê dịch bởi vật thể khác' })
    public massJar: number = 3.0;

    @property({ tooltip: 'Khối lượng mặc định' })
    public massDefault: number = 1.0;

    // @property({ tooltip: 'Hệ số ma sát của Băng (Ice)' })
    // public frictionIce: number = 0.3; // Tăng ma sát lên để bớt trơn

    // @property({ tooltip: 'Hệ số ma sát lăn của Băng (Ice)' })
    // public rollingFrictionIce: number = 0.1;

    // @property({ tooltip: 'Hệ số ma sát của Kim loại (Metal)' })
    // public frictionMetal: number = 0.5; // Kim loại bám hơn, không trơn như băng

    // @property({ tooltip: 'Hệ số ma sát lăn của Kim loại (Metal)' })
    // public rollingFrictionMetal: number = 0.2;

    // @property({ tooltip: 'Hệ số ma sát bề mặt mặc định' })
    // public frictionDefault: number = 0.6;

    // @property({ tooltip: 'Hệ số ma sát lăn mặc định' })
    // public rollingFrictionDefault: number = 0.1;

    // @property({ tooltip: 'Độ nảy mặc định' })
    // public restitutionDefault: number = 0.15;

    @property({ tooltip: 'Tỉ lệ tối thiểu giữa tốc độ ngang và tốc độ bay lên của block dài.' })
    public longBlockMinHorizontalRatio: number = 0.65;

    @property({ tooltip: 'Chỉ nắn quỹ đạo khi block dài bay lên nhanh hơn ngưỡng này.' })
    public longBlockJumpVelocityThreshold: number = 0.75;

    @property({ tooltip: 'lực hút của Obj tùy theo Mass setup của người chơi' })
    public gravityScale: number = 2;

    private _rb: RigidBody | null = null;
    private _isRotationUnlocked: boolean = false;
    private _isHorizontalUnlocked: boolean = false;
    private _isLongBlock: boolean = false;
    private _lastVelocityLog: string = '';
    private _fallingFrames: number = 0;

    // Cache biến tối ưu Zero-GC
    private readonly _tempForce: Vec3 = new Vec3();
    private readonly _tempVel: Vec3 = new Vec3();
    private readonly _impactTorque: Vec3 = new Vec3();
    private readonly _longAxisLocal: Vec3 = new Vec3(1, 0, 0);
    private readonly _redirectDirection: Vec3 = new Vec3();
    private readonly _tempFactor: Vec3 = new Vec3();
    private readonly _globalGravityDir: Vec3 = new Vec3(0, -1, 0);

    /**
     * Khởi tạo các thông số vật lý cho Block
     */
    public initPhysics(rb: RigidBody | null, colliders: Collider[], objectId: string, gravityScale: number) {
        this._rb = rb;
        // this._gravityScale = gravityScale;
        this._isRotationUnlocked = !SpawnObjectIngame.isRotationLocked(this._rb);
        this._isHorizontalUnlocked = false;
        this._isLongBlock = this.detectLongBlock(colliders);
        this._lastVelocityLog = '';
        this._fallingFrames = 0;

        if (this._rb) {
            this._rb.clearState();

            // Áp dụng khối lượng dựa trên config
            if (objectId === 'Metal' || objectId === 'Stone') {
                //    this._rb.mass = this.massHeavy;
                // Đối với Metal/Stone: Đặt damping phù hợp để lộn nhào tự nhiên và nhanh dừng trượt
                // this._rb.linearDamping = 0.3;
                // this._rb.angularDamping = 0.3;
            } else if (objectId === 'Jar') {
                this._rb.mass = this.massJar;
                this._rb.linearDamping = 0.95;
                this._rb.angularDamping = 0.95;

            } else if (objectId === 'Ice') {
                // this._rb.mass = this.massIce;
                // this._rb.linearDamping = 0.65; // Ice cản cực nhỏ để trượt mượt
                // this._rb.angularDamping = 0.65;

            } else if (objectId === 'Wood') {
                this._rb.mass = this.massLight;
                this._rb.linearDamping = 0.1;
                this._rb.angularDamping = 0.1;
            } else {
                this._rb.mass = this.massDefault;
                this._rb.linearDamping = 0.1;
                this._rb.angularDamping = 0.1;
            }
        }

        // Tự động gán PhysicsMaterial để tạo ma sát tự nhiên
        // for (let i = 0; i < colliders.length; i++) {
        //     const collider = colliders[i];
        //     if (collider) {
        //         // Tối ưu: Dùng sharedMaterial để tránh tự động clone tạo ra instanced material không có UUID làm crash Editor Inspector
        //         let mat = collider.sharedMaterial;
        //         if (!mat) {
        //             try {
        //                 mat = new PhysicsMaterial();
        //                 mat.name = 'BlockMaterial_' + objectId;

        //                 // Khởi tạo các thông số vật lý cho material mới tạo
        //                 if (objectId === 'Ice') {
        //                     // mat.friction = this.frictionIce;
        //                     // mat.rollingFriction = this.rollingFrictionIce;
        //                     // mat.restitution = 0.05; // Băng ít nảy
        //                 } else if (objectId === 'Metal') {
        //                     // mat.friction = this.frictionMetal;
        //                     // mat.rollingFriction = this.rollingFrictionMetal;
        //                     // mat.restitution = 0.05; // Kim loại ít nảy
        //                 } else if (objectId === 'Jar') {
        //                     // mat.friction = 0;
        //                     // mat.rollingFriction = 0;
        //                     // mat.restitution = 0;
        //                 } else {
        //                     // mat.friction = this.frictionDefault;
        //                     // mat.rollingFriction = this.rollingFrictionDefault;
        //                     // mat.restitution = this.restitutionDefault;
        //                 }

        //                 collider.sharedMaterial = mat;
        //             } catch (err) {
        //                 console.error(`[BlockPhysicsBehavior] Exception creating material for '${objectId}':`, err);
        //             }
        //         }
        //     }
        // }

        // Cache hướng trọng lực
        this._globalGravityDir.set(PhysicsSystem.instance.gravity);
        this._globalGravityDir.normalize();
    }

    private detectLongBlock(colliders: Collider[]): boolean {
        for (let i = 0; i < colliders.length; i++) {
            const collider = colliders[i];
            if (!(collider instanceof BoxCollider)) continue;
            if (this._rb && collider.attachedRigidBody !== this._rb) continue;

            const size = collider.size;
            const scale = collider.node.worldScale;
            const x = Math.abs(size.x * scale.x);
            const y = Math.abs(size.y * scale.y);
            const z = Math.abs(size.z * scale.z);
            const shortestSide = Math.max(0.0001, Math.min(x, y, z));
            const longestSide = Math.max(x, y, z);
            if (longestSide / shortestSide < 1.5) return false;

            if (x >= y && x >= z) this._longAxisLocal.set(1, 0, 0);
            else if (y >= x && y >= z) this._longAxisLocal.set(0, 1, 0);
            else this._longAxisLocal.set(0, 0, 1);
            return true;
        }

        return false;
    }

    public redirectStraightUpJump(otherCollider: Collider): void {
        if (!this._isLongBlock || !this._rb || this._rb.isKinematic) return;

        this._rb.getLinearVelocity(this._tempVel);
        const upwardSpeed = this._tempVel.y;
        if (upwardSpeed < this.longBlockJumpVelocityThreshold) return;

        const horizontalSpeed = Math.sqrt(
            this._tempVel.x * this._tempVel.x + this._tempVel.z * this._tempVel.z
        );
        const ratio = Math.max(0, this.longBlockMinHorizontalRatio);
        if (horizontalSpeed >= upwardSpeed * ratio) return;

        const otherBody = otherCollider.attachedRigidBody;
        if (otherBody) {
            otherBody.getLinearVelocity(this._redirectDirection);
            this._redirectDirection.y = 0;
        } else {
            this._redirectDirection.set(Vec3.ZERO);
        }

        if (this._redirectDirection.lengthSqr() < 0.0001) {
            Vec3.transformQuat(this._redirectDirection, this._longAxisLocal, this._rb.node.worldRotation);
            this._redirectDirection.y = 0;
            if (this._rb.node.worldPosition.x < 0) this._redirectDirection.multiplyScalar(-1);
        }
        if (this._redirectDirection.lengthSqr() < 0.0001) {
            this._redirectDirection.set(this._rb.node.worldPosition.x < 0 ? -1 : 1, 0, 0);
        } else {
            this._redirectDirection.normalize();
        }

        const combinedSpeed = Math.sqrt(upwardSpeed * upwardSpeed + horizontalSpeed * horizontalSpeed);
        const redirectedUpwardSpeed = combinedSpeed / Math.sqrt(1 + ratio * ratio);
        const redirectedHorizontalSpeed = redirectedUpwardSpeed * ratio;

        this._tempVel.x = this._redirectDirection.x * redirectedHorizontalSpeed;
        this._tempVel.y = redirectedUpwardSpeed;
        this._tempVel.z = this._redirectDirection.z * redirectedHorizontalSpeed;

        this._tempFactor.set(this._rb.linearFactor);
        this._tempFactor.x = 1;
        this._tempFactor.z = 1;
        this._rb.linearFactor = this._tempFactor;
        this._rb.setLinearVelocity(this._tempVel);
    }

    /**
     * Áp dụng lực xoay ngẫu nhiên khi bị bóng bắn trúng
     */
    public applyHitSpin() {
        if (this._rb && !this._rb.isKinematic) {
            this._rb.wakeUp();

            // Cho phép xoay tự do hoàn toàn sau khi bị bắn
            this._rb.angularDamping = 0.05;

            // Thiết lập vận tốc xoay ngẫu nhiên vừa phải (1.5 - 3 rad/s)
            this._tempForce.set(
                (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5),
                (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5),
                (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5)
            );
            this._rb.setAngularVelocity(this._tempForce);
        }
    }

    /**
     * Chi goi khi co collision. Neu da mo xoay thi bo qua, neu chua mo thi
     * kiem tra do lon van toc va mo khi du nguong.
     */
    public tryUnlockRotationByImpact(event: ICollisionEvent): void {
        if (!this._rb || this._rb.isKinematic) return;

        const otherBody = event.otherCollider.attachedRigidBody;
        if (!otherBody || event.contacts.length === 0) return;

        otherBody.getLinearVelocity(this._tempForce);
        this._rb.getLinearVelocity(this._tempVel);
        Vec3.subtract(this._tempForce, this._tempForce, this._tempVel);
        if (this._tempForce.length() < 0.2) return;

        if (!this._isRotationUnlocked) {
            if (!SpawnObjectIngame.unlockRotation(this._rb)) return;
            this._isRotationUnlocked = true;
        }

        event.contacts[0].getWorldPointOnA(this._tempVel);
        Vec3.subtract(this._tempVel, this._tempVel, this._rb.node.worldPosition);
        Vec3.cross(this._impactTorque, this._tempVel, this._tempForce);

        const torqueStrength = this._impactTorque.length();
        if (torqueStrength < 0.001) return;

        const angularSpeed = math.clamp(Math.sqrt(torqueStrength) * 1, 1, 8);
        this._impactTorque.normalize().multiplyScalar(angularSpeed);
        //this._rb.angularDamping = 0.5;
        this._rb.setAngularVelocity(this._impactTorque);
    }

    private AddGravity() {

        if (!this._rb) return;

        this._rb.getLinearVelocity(this._tempVel);
        const speed = this._tempVel.length();

        if (!this._isHorizontalUnlocked) {
            this._isHorizontalUnlocked = !SpawnObjectIngame.isHorizontalMovementLocked(this._rb);
        }

        const velo = this._tempVel;
        const hasStrongMovement = speed > 2 && Math.abs(velo.y) > 0.4;

        if (velo.y < -0.4) {
            this._fallingFrames++;
        } else {
            this._fallingFrames = 0;
        }

        const isConfirmedFalling = this._fallingFrames >= 7;
        const useStrongGravity = hasStrongMovement || isConfirmedFalling;

        const normalAcceleration = speed < 0.1 ? 30 : 70 * this.gravityScale * 0.5;

        const acceleration = !this._isHorizontalUnlocked
            ? 30
            : useStrongGravity
                ? 120 * this.gravityScale
                : normalAcceleration;

        // const xLog = velo.x.toFixed(2);
        // const yLog = velo.y.toFixed(2);
        // const zLog = velo.z.toFixed(2);
        // const speedLog = speed.toFixed(2);
        // const currentVelocityLog = `${xLog}|${yLog}|${zLog}|${speedLog}|${this._fallingFrames}|${useStrongGravity}`;

        // if (currentVelocityLog !== this._lastVelocityLog) {
        //     this._lastVelocityLog = currentVelocityLog;
        //     console.log(
        //         `[${this.node.name}]`,
        //         `x=${xLog}`,
        //         `y=${yLog}`,
        //         `z=${zLog}`,
        //         `speed=${speedLog}`,
        //         `fallFrames=${this._fallingFrames}`,
        //         `strong=${useStrongGravity}`,
        //     );
        // }
        // Cocos không có ForceMode.Acceleration, nên nhân với mass để lực tạo ra
        // cùng một gia tốc bất kể khối lượng rigid body.
        Vec3.multiplyScalar(
            this._tempForce,
            this._globalGravityDir,
            acceleration
        );
        this._rb.applyForce(this._tempForce);
    }
    /**
     * Cập nhật các mô phỏng vật lý liên tục (Trọng lực tùy chỉnh, stabilization, lộn nhào khi rơi)
     */
    update(dt: number) {
        if (!this._rb || this._rb.isKinematic) return;

        //  if (this._rb.isAwake) {
        // 1. Áp dụng trọng lực tùy chỉnh nhân với khối lượng vật thể
        // Vec3.multiplyScalar(this._tempForce, this._globalGravityDir, this._gravityScale * this._rb.mass);
        // this._rb.applyForce(this._tempForce);


        this.AddGravity();
        // 2. Tự động lộn vòng (tumble) tự nhiên khi đang rơi tự do
        this._rb.getLinearVelocity(this._tempVel);
        if (this._tempVel.y < -3) { // Chỉ xoay khi đang rơi đủ nhanh
            this._tempForce.set(
                this._tempVel.y * 0.5,
                0,
                this._tempVel.y * 0.5
            );
            this._rb.applyTorque(this._tempForce);
        }
        //   }
    }
}
