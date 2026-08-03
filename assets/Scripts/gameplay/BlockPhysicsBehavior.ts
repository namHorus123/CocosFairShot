import { _decorator, Component, RigidBody, Collider, Vec3, PhysicsSystem, PhysicsMaterial } from 'cc';
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

    @property({ tooltip: 'Hệ số ma sát của Kim loại (Metal)' })
    public frictionMetal: number = 0.5; // Kim loại bám hơn, không trơn như băng

    @property({ tooltip: 'Hệ số ma sát lăn của Kim loại (Metal)' })
    public rollingFrictionMetal: number = 0.2;

    @property({ tooltip: 'Hệ số ma sát bề mặt mặc định' })
    public frictionDefault: number = 0.6;

    @property({ tooltip: 'Hệ số ma sát lăn mặc định' })
    public rollingFrictionDefault: number = 0.1;

    @property({ tooltip: 'Độ nảy mặc định' })
    public restitutionDefault: number = 0.15;

    private _rb: RigidBody | null = null;
    private _gravityScale: number = 25;
    private _isRotationUnlocked: boolean = false;

    // Cache biến tối ưu Zero-GC
    private readonly _tempForce: Vec3 = new Vec3();
    private readonly _tempVel: Vec3 = new Vec3();
    private readonly _globalGravityDir: Vec3 = new Vec3(0, -1, 0);

    /**
     * Khởi tạo các thông số vật lý cho Block
     */
    public initPhysics(rb: RigidBody | null, colliders: Collider[], objectId: string, gravityScale: number) {
        this._rb = rb;
        this._gravityScale = gravityScale;
        this._isRotationUnlocked = !SpawnObjectIngame.isRotationLocked(this._rb);

        if (this._rb) {
            this._rb.clearState();

            // Áp dụng khối lượng dựa trên config
            if (objectId === 'Metal' || objectId === 'Stone') {
                this._rb.mass = this.massHeavy;
                // Đối với Metal/Stone: Đặt damping phù hợp để lộn nhào tự nhiên và nhanh dừng trượt
                this._rb.linearDamping = 0.3;
                this._rb.angularDamping = 0.3;
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
        for (let i = 0; i < colliders.length; i++) {
            const collider = colliders[i];
            if (collider) {
                // Tối ưu: Dùng sharedMaterial để tránh tự động clone tạo ra instanced material không có UUID làm crash Editor Inspector
                let mat = collider.sharedMaterial;
                if (!mat) {
                    try {
                        mat = new PhysicsMaterial();
                        mat.name = 'BlockMaterial_' + objectId;

                        // Khởi tạo các thông số vật lý cho material mới tạo
                        if (objectId === 'Ice') {
                            // mat.friction = this.frictionIce;
                            // mat.rollingFriction = this.rollingFrictionIce;
                            // mat.restitution = 0.05; // Băng ít nảy
                        } else if (objectId === 'Metal') {
                            mat.friction = this.frictionMetal;
                            mat.rollingFriction = this.rollingFrictionMetal;
                            mat.restitution = 0.05; // Kim loại ít nảy
                        } else if (objectId === 'Jar') {
                            mat.friction = 0;
                            mat.rollingFriction = 0;
                            mat.restitution = 0;
                        } else {
                            mat.friction = this.frictionDefault;
                            mat.rollingFriction = this.rollingFrictionDefault;
                            mat.restitution = this.restitutionDefault;
                        }

                        collider.sharedMaterial = mat;
                    } catch (err) {
                        console.error(`[BlockPhysicsBehavior] Exception creating material for '${objectId}':`, err);
                    }
                }
            }
        }

        // Cache hướng trọng lực
        this._globalGravityDir.set(PhysicsSystem.instance.gravity);
        this._globalGravityDir.normalize();
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
    public tryUnlockRotationByImpact(): void {
        if (this._isRotationUnlocked || !this._rb) return;

        this._rb.getLinearVelocity(this._tempVel);
        const acceleration = this._tempVel.length();

        if (acceleration >= 0.2 && SpawnObjectIngame.unlockRotation(this._rb)) {
            this._isRotationUnlocked = true;
            console.log(`[BlockPhysicsBehavior] Mo khoa xoay ${this.node.name}, acceleration=${acceleration.toFixed(3)}`);
        }
    }

    private AddGravity() {

        if (!this._rb) return;

        this._rb.getLinearVelocity(this._tempVel);

        // const speed = Math.sqrt(this._tempVel.length());
        // const forcePercent = this.iDController.Seek(20, this._tempVel.length());
        // console.log(this._tempVel.length());

        const acceleration = this._tempVel.length() > 0.2
            ? 70
            : 20;

        // if (this._tempVel.length() >= 0.2) {

        //     console.log(this.node.name);
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
