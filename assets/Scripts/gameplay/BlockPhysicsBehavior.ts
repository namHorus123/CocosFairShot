import { _decorator, Component, RigidBody, Collider, Vec3, PhysicsSystem, PhysicsMaterial, Node, geometry } from 'cc';

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
    public restitutionDefault: number = 0;

    @property({ tooltip: 'Hệ số gravity khi block đã được kích hoạt và không còn điểm tựa' })
    public airborneGravityMultiplier: number = 7;

    @property({ tooltip: 'Tốc độ va chạm tối thiểu để đánh thức block' })
    public minActivationSpeed: number = 5;

    @property({ tooltip: 'Khoảng dò collider đỡ ngay bên dưới block' })
    public supportCheckDistance: number = 0.2;

    @property({ tooltip: 'Độ nghiêng so với góc đặt ban đầu để tự kích hoạt rơi' })
    public tiltActivationAngle: number = 3;

    @property({ tooltip: 'Linear damping khi đang rơi tự do' })
    public airborneLinearDamping: number = 0.02;

    @property({ tooltip: 'Angular damping khi đang rơi tự do' })
    public airborneAngularDamping: number = 0.08;

    @property({ tooltip: 'Số frame mất support liên tiếp trước khi bắt đầu rơi' })
    public fallConfirmFrames: number = 2;

    @property({ tooltip: 'Số frame có support liên tiếp trước khi cho block ngủ' })
    public landingConfirmFrames: number = 4;

    @property({ tooltip: 'Ngưỡng tốc độ để dập rung và Sleep sau khi tiếp đất' })
    public landingSleepSpeed: number = 1;

    private _rb: RigidBody | null = null;
    private _gravityScale: number = 25;

    // Cache biến tối ưu Zero-GC
    private readonly _tempForce: Vec3 = new Vec3();
    private readonly _tempVel: Vec3 = new Vec3();
    private readonly _tempAngularVel: Vec3 = new Vec3();
    private readonly _otherVel: Vec3 = new Vec3();
    private readonly _globalGravityDir: Vec3 = new Vec3(0, -1, 0);
    private readonly _supportRay: geometry.Ray = new geometry.Ray(0, 0, 0, 0, -1, 0);
    private readonly _initialUp: Vec3 = new Vec3(0, 1, 0);
    private readonly _currentUp: Vec3 = new Vec3(0, 1, 0);

    private _bodyCollider: Collider | null = null;
    private _activated: boolean = false;
    private _baseLinearDamping: number = 0;
    private _baseAngularDamping: number = 0;
    private _unsupportedFrames: number = 0;
    private _supportedFrames: number = 0;
    // A destroyed/deforming block can keep its collider alive for its hit effect.
    // Keep ignoring that old support until it actually leaves the hierarchy;
    // otherwise the next update puts this body back to sleep and it appears to
    // hang in mid-air before suddenly dropping.
    private _ignoredSupportRoot: Node | null = null;

    /**
     * Khởi tạo các thông số vật lý cho Block
     */
    public initPhysics(rb: RigidBody | null, colliders: Collider[], objectId: string, gravityScale: number) {
        this._rb = rb;
        this._gravityScale = gravityScale;
        this._bodyCollider = null;
        this._activated = false;
        this._unsupportedFrames = 0;
        this._supportedFrames = 0;
        this._ignoredSupportRoot = null;

        for (let i = 0; i < colliders.length; i++) {
            const collider = colliders[i];
            if (collider && collider.attachedRigidBody === rb && collider.node === this.node) {
                this._bodyCollider = collider;
                break;
            }
        }
        if (!this._bodyCollider) {
            for (let i = 0; i < colliders.length; i++) {
                if (colliders[i] && colliders[i].attachedRigidBody === rb) {
                    this._bodyCollider = colliders[i];
                    break;
                }
            }
        }

        if (this._rb) {
            this._rb.allowSleep = true;
            this._rb.clearState();

            // Áp dụng khối lượng dựa trên config
            if (objectId === 'Metal' || objectId === 'Stone') {
                this._rb.mass = 3;
                // Đối với Metal/Stone: Đặt damping phù hợp để lộn nhào tự nhiên và nhanh dừng trượt
                this._rb.linearDamping = 0.3;
                this._rb.angularDamping = 0.3;
            } else if (objectId === 'Jar') {
                this._rb.mass = 10;
                this._rb.linearDamping = 0.95;
                this._rb.angularDamping = 0.95;

            } else if (objectId === 'Ice') {
                // this._rb.mass = this.massIce;
                this._rb.linearDamping = 0.95;
                this._rb.angularDamping = 0.95;

            } else if (objectId === 'Wood') {
                //this._rb.mass = this.massLight;
                this._rb.linearDamping = 0.1;
                this._rb.angularDamping = 0.1;
            } else {
                this._rb.mass = this.massDefault;
                this._rb.linearDamping = 0.1;
                this._rb.angularDamping = 0.1;
            }

            this._baseLinearDamping = this._rb.linearDamping;
            this._baseAngularDamping = this._rb.angularDamping;
            this._rb.sleep();
        }

        this._initialUp.set(0, 1, 0);
        Vec3.transformQuat(this._initialUp, this._initialUp, this.node.worldRotation);
        this._initialUp.normalize();

        // Tự động gán PhysicsMaterial để tạo ma sát tự nhiên
        for (let i = 0; i < colliders.length; i++) {
            const collider = colliders[i];
            if (collider) {
                // Tối ưu: Dùng sharedMaterial để tránh tự động clone tạo ra instanced material không có UUID làm crash Editor Inspector
                let mat = collider.sharedMaterial;
                if (mat) {
                    // Block không nảy khi chạm đất/khối khác.
                    mat.restitution = 0;
                } else {
                    try {
                        mat = new PhysicsMaterial();
                        mat.name = 'BlockMaterial_' + objectId;

                        // Khởi tạo các thông số vật lý cho material mới tạo
                        if (objectId === 'Ice') {
                            // mat.friction = this.frictionIce;
                            // mat.rollingFriction = this.rollingFrictionIce;
                            mat.restitution = 0; // Băng ít nảy
                        } else if (objectId === 'Metal') {
                            mat.friction = this.frictionMetal;
                            mat.rollingFriction = this.rollingFrictionMetal;
                            mat.restitution = 0;
                        } else if (objectId === 'Jar') {
                            mat.friction = 1S;
                            mat.rollingFriction = 0;
                            mat.restitution = 0;
                        } else {
                            mat.friction = this.frictionDefault;
                            mat.rollingFriction = this.rollingFrictionDefault;
                            mat.restitution = this.restitutionDefault;
                        }

                        mat.restitution = 0;

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

        // Trường hợp block được đặt sẵn giữa không trung và không có gì đỡ.
        this.unschedule(this.checkInitialSupport);
        this.scheduleOnce(this.checkInitialSupport, 0);
    }

    private checkInitialSupport(): void {
        this.activateIfUnsupported(null);
    }

    public activateFromImpact(otherCollider: Collider): boolean {
        if (!this._rb) return false;

        this._rb.getLinearVelocity(this._tempVel);
        const otherBody = otherCollider.attachedRigidBody;
        if (otherBody) {
            otherBody.getLinearVelocity(this._otherVel);
        } else {
            this._otherVel.set(0, 0, 0);
        }

        const dx = this._tempVel.x - this._otherVel.x;
        const dy = this._tempVel.y - this._otherVel.y;
        const dz = this._tempVel.z - this._otherVel.z;
        const relativeSpeed = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (relativeSpeed < Math.max(0, this.minActivationSpeed)) {
            this._activated = false;
            this._rb.clearState();
            this._rb.sleep();
            return false;
        }

        this._activated = true;
        this._unsupportedFrames = 0;
        this._supportedFrames = 0;
        this._rb.wakeUp();
        return true;
    }

    public activateIfUnsupported(ignoredNode: Node | null = null): void {
        if (!this._rb) return;

        const isUnsupported = this.countSupportPoints(ignoredNode) < 2;
        const isAboveChangedSupport = !!ignoredNode && this.isAboveNode(ignoredNode);
        // A null node is the initial spawn check. Stable blocks should remain
        // asleep then. When the structure changes, wake the affected column so
        // motion reaches its top in the same physics beat.
        if (!isUnsupported && !isAboveChangedSupport) return;

        this._ignoredSupportRoot = isUnsupported ? ignoredNode : null;
        this._activated = true;
        this._unsupportedFrames = isUnsupported
            ? Math.max(1, Math.round(this.fallConfirmFrames))
            : 0;
        this._supportedFrames = 0;
        if (isUnsupported) {
            this.useAirborneDamping();
        }
        this._rb.wakeUp();
    }

    /**
     * Wake blocks above a support that has started moving after an impact.
     * Do not inject velocity here: contact resolution should transfer the
     * actual motion, otherwise stacked bodies can be launched upward.
     */
    public wakeFromSupportMotion(sourceNode: Node): void {
        if (!this._rb || !this.isAboveNode(sourceNode)) return;

        this._activated = true;
        this._unsupportedFrames = 0;
        this._supportedFrames = 0;
        this._rb.wakeUp();
    }

    private isAboveNode(sourceNode: Node): boolean {
        if (!this._bodyCollider) return false;

        const sourceCollider = sourceNode.getComponent(Collider)
            || sourceNode.getComponentInChildren(Collider);
        if (!sourceCollider) return false;

        const targetBounds = this._bodyCollider.worldBounds;
        const sourceBounds = sourceCollider.worldBounds;
        const margin = 1.25;
        const overlapsX = Math.abs(targetBounds.center.x - sourceBounds.center.x)
            <= (targetBounds.halfExtents.x + sourceBounds.halfExtents.x) * margin;
        const overlapsZ = Math.abs(targetBounds.center.z - sourceBounds.center.z)
            <= (targetBounds.halfExtents.z + sourceBounds.halfExtents.z) * margin;

        return targetBounds.center.y > sourceBounds.center.y && overlapsX && overlapsZ;
    }

    private countSupportPoints(ignoredNode: Node | null): number {
        if (!this._bodyCollider) return 0;

        const bounds = this._bodyCollider.worldBounds;
        const bottomY = bounds.center.y - bounds.halfExtents.y - 0.01;
        const offsetX = bounds.halfExtents.x * 0.65;
        const maxDistance = Math.max(0.02, this.supportCheckDistance);
        let supportPoints = 0;

        for (let i = -1; i <= 1; i++) {
            this._supportRay.o.set(bounds.center.x + offsetX * i, bottomY, bounds.center.z);
            this._supportRay.d.set(0, -1, 0);

            if (!PhysicsSystem.instance.raycast(this._supportRay, 0xffffffff, maxDistance, false)) {
                continue;
            }

            const results = PhysicsSystem.instance.raycastResults;
            for (let j = 0; j < results.length; j++) {
                const collider = results[j].collider;
                if (collider === this._bodyCollider) continue;
                if (ignoredNode && this.isNodeInside(collider.node, ignoredNode)) continue;
                if (results[j].hitNormal.y > 0.3) {
                    supportPoints++;
                    break;
                }
            }
        }

        return supportPoints;
    }

    private isTilted(): boolean {
        this._currentUp.set(0, 1, 0);
        Vec3.transformQuat(this._currentUp, this._currentUp, this.node.worldRotation);
        this._currentUp.normalize();
        const dot = Math.max(-1, Math.min(1, Vec3.dot(this._initialUp, this._currentUp)));
        const angle = Math.acos(dot) * 180 / Math.PI;
        return angle >= Math.max(0, this.tiltActivationAngle);
    }

    private useAirborneDamping(): void {
        if (!this._rb) return;
        this._rb.linearDamping = Math.max(0, this.airborneLinearDamping);
        this._rb.angularDamping = Math.max(0, this.airborneAngularDamping);
    }

    private restoreBaseDamping(): void {
        if (!this._rb) return;
        this._rb.linearDamping = this._baseLinearDamping;
        this._rb.angularDamping = this._baseAngularDamping;
    }

    private trySleepAfterLanding(): void {
        if (!this._rb) return;

        this._rb.getLinearVelocity(this._tempVel);
        this._rb.getAngularVelocity(this._tempAngularVel);
        const maxSpeed = Math.max(0.01, this.landingSleepSpeed);
        const linearSpeedSqr = this._tempVel.lengthSqr();
        const angularSpeedSqr = this._tempAngularVel.lengthSqr();

        if (linearSpeedSqr <= maxSpeed * maxSpeed
            && angularSpeedSqr <= maxSpeed * maxSpeed) {
            this._rb.clearState();
            this._rb.sleep();
            this._activated = false;
            this._supportedFrames = 0;
            this._unsupportedFrames = 0;
            this._ignoredSupportRoot = null;
        }
    }

    private isNodeInside(node: Node | null, root: Node): boolean {
        let current = node;
        while (current) {
            if (current === root) return true;
            current = current.parent;
        }
        return false;
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
     * Cập nhật các mô phỏng vật lý liên tục (Trọng lực tùy chỉnh, stabilization, lộn nhào khi rơi)
     */
    update(dt: number) {
        if (!this._rb || this._rb.isKinematic) return;


        //  if (this._rb.isAwake) {
        //         // 1. Áp dụng trọng lực tùy chỉnh nhân với khối lượng vật thể
        //         Vec3.multiplyScalar(this._tempForce, this._globalGravityDir, this._gravityScale * this._rb.mass);
        //         this._rb.applyForce(this._tempForce);

        //         // 2. Tự động lộn vòng (tumble) tự nhiên khi đang rơi tự do
        //         this._rb.getLinearVelocity(this._tempVel);
        //         if (this._tempVel.y < -3) { // Chỉ xoay khi đang rơi đủ nhanh
        //             this._tempForce.set(
        //                 this._tempVel.y * 0.5,
        //                 0,
        //                 this._tempVel.y * 0.5
        //             );
        //             this._rb.applyTorque(this._tempForce);
        //         }
        //     }


        if (this._ignoredSupportRoot
            && (!this._ignoredSupportRoot.isValid || !this._ignoredSupportRoot.activeInHierarchy)) {
            this._ignoredSupportRoot = null;
        }

        const supportPoints = this.countSupportPoints(this._ignoredSupportRoot);
        const tilted = this.isTilted();
        const rawShouldFall = supportPoints === 0 || (tilted && supportPoints < 2);

        if (rawShouldFall) {
            this._unsupportedFrames++;
            this._supportedFrames = 0;
        } else {
            this._supportedFrames++;
            this._unsupportedFrames = 0;
        }

        const shouldFall = this._unsupportedFrames >= Math.max(1, Math.round(this.fallConfirmFrames));

        // Tự kích hoạt khi map nghiêng làm block mất phần lớn điểm tựa.
        if (!this._activated && shouldFall) {
            this._activated = true;
            this._rb.wakeUp();
        }

        // A sleeping rigid body cannot follow a support that is tipping or
        // sliding underneath it. Wake as soon as its orientation changes;
        // waiting until all raycast support disappears is what caused the
        // visible floating followed by a sudden snap.
        if (tilted && !this._activated) {
            this._activated = true;
            this._supportedFrames = 0;
            this._rb.wakeUp();
        }

        if (this._rb.isSleeping) {
            this._activated = false;
            this.restoreBaseDamping();
            return;
        }

        if (!this._activated) {
            this.restoreBaseDamping();
            return;
        }

        // Có support thì ngắt gravity bổ sung ngay. Không ép sleep dựa trên
        // raycast: supportCheckDistance cho phép một khoảng hở, nên sleep ở
        // đây sẽ khóa block lơ lửng trước khi collider thật sự chạm nhau.
        // PhysX tự sleep khi contact và vận tốc đã ổn định.
        if (!rawShouldFall) {
            this.restoreBaseDamping();
            return;
        }

        if (!shouldFall) {
            this.restoreBaseDamping();
            return;
        }

        this.useAirborneDamping();

        // Chỉ cộng phần gravity chênh lệch khi block đã được kích hoạt và đang rơi tự do.
        this._rb.getLinearVelocity(this._tempVel);
        this._tempVel.y += PhysicsSystem.instance.gravity.y
            * (Math.max(1, this.airborneGravityMultiplier) - 1)
            * dt;
        this._rb.setLinearVelocity(this._tempVel);
    }
}
