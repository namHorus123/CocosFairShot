import { _decorator, Component, Node, Prefab, instantiate, Vec3, Quat, RigidBody, Collider, input, Input, EventTouch, Camera, PhysicsSystem, geometry } from 'cc';
import { SpawnBullet } from '../spawn/SpawnBullet';
import { GameManager } from '../manager/GameManager';
import { SoundManager } from '../Utility/SoundManager';
import { InputController } from '../manager/InputController';
const { ccclass, property } = _decorator;

// Tối ưu hóa bộ nhớ: Dùng class thay vì tạo object nặc danh liên tục
class TrackedBall {
    public node: Node | null = null;
    public spawnTime: number = 0;
    public spawnPos: Vec3 = new Vec3();
}

@ccclass('Dual_Gun')
export class Dual_Gun extends Component {
    @property({ type: Node, tooltip: 'Điểm spawn bên trái' })
    public spawnPointLeft: Node = null;

    @property({ type: Node, tooltip: 'Điểm spawn bên phải' })
    public spawnPointRight: Node = null;

    @property({ type: Node, tooltip: 'Điểm bắn đạn thực tế (đầu nòng súng)' })
    public firePoint: Node = null;

    @property({ type: Prefab, tooltip: 'Prefab bóng lăn trên máng' })
    public templateBall: Prefab = null;

    @property({ tooltip: 'Số lượng bóng tối đa trên máng' })
    public maxVisualBallsOnSlope: number = 6;

    @property({ tooltip: 'Thời gian giữa các lần spawn bóng' })
    public spawnInterval: number = 0.3;

    @property({ type: Node, tooltip: 'Node xoay súng theo hướng nhắm' })
    public rotator: Node = null;

    @property({ type: Node, tooltip: 'Mục tiêu để bóng lăn tới (tạo lực đẩy ban đầu)' })
    public rollTarget: Node = null;

    @property({ tooltip: 'Thời gian bóng lăn tối thiểu trước khi sẵn sàng bắn' })
    public rollDurationToReady: number = 2.0;

    @property({ tooltip: 'Lực đẩy ban đầu khi bóng xuất hiện' })
    public initialPushForceMagnitude: number = 2.0;

    @property({ type: Camera, tooltip: 'Camera dùng để Raycast nhắm bắn' })
    public shootCamera: Camera = null;

    @property({ type: [PhysicsSystem.PhysicsGroup], tooltip: 'Mảng các Layer (Group) dùng cho Raycast. Bấm + để thêm nhiều layer' })
    public targetLayers: number[] = [PhysicsSystem.PhysicsGroup.DEFAULT];

    // --- Cấu hình Vật lý cho Visual Ball ---
    @property({ tooltip: 'Khối lượng (Mass) của bóng lăn' })
    public ballMass: number = 2;

    @property({ tooltip: 'Linear Damping của bóng lăn' })
    public ballLinearDamping: number = 0.1;

    @property({ tooltip: 'Angular Damping của bóng lăn' })
    public ballAngularDamping: number = 0.1;

    @property({ tooltip: 'Sử dụng trọng lực cho bóng lăn' })
    public ballUseGravity: boolean = true;

    @property({ tooltip: 'Cho phép Physics Engine đóng băng bóng khi nó đi quá chậm' })
    public ballAllowSleep: boolean = false;

    @property({ type: Vec3, tooltip: 'Linear Factor (Freeze Position)' })
    public ballLinearFactor: Vec3 = new Vec3(1, 1, 0);

    @property({ type: Vec3, tooltip: 'Angular Factor (Freeze Rotation)' })
    public ballAngularFactor: Vec3 = new Vec3(0, 0, 1);

    @property({ type: PhysicsSystem.PhysicsGroup, tooltip: 'Physics Group của bóng lăn' })
    public ballGroup: number = PhysicsSystem.PhysicsGroup.DEFAULT;

    @property({ tooltip: 'Lực bắn đạn (Impulse)' })
    public shootForce: number = 15;


    // --- State Variables ---
    private _activeBalls: TrackedBall[] = [];
    private _ballDataPool: TrackedBall[] = []; // Tối ưu GC
    private _ballPool: Node[] = [];

    private _spawnFromLeft: boolean = true;
    private _isAiming: boolean = false;
    private _canShoot: boolean = true;
    private _isSpawningInitial: boolean = false;
    private _spawnTimer: number = 0;

    // Thay thế cho GameManager trong Playable
    private _bulletLimit: number = 999;
    private _bulletsFired: number = 0;

    // --- Cache Variables (Tối ưu rác GC cho Playable) ---
    private _aimTargetPoint: Vec3 = new Vec3();
    private _customSpawnPosition: Vec3 = new Vec3();
    private _tempVec3: Vec3 = new Vec3();
    private _tempVec3_2: Vec3 = new Vec3();
    private _tempQuat: Quat = new Quat();
    private _ray: geometry.Ray = new geometry.Ray();
    private _cachedFinalMask: number = 0xffffffff;

    onEnable() {
        this.registerEvents();
        this.startSpawnLoop();
    }

    onDisable() {
        this.unregisterEvents();
        this.stopSpawnLoop();
        this.clearVisualBalls();
    }

    private registerEvents() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private unregisterEvents() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    start() {
        if (!this.shootCamera) {
            console.warn('[Dual_Gun] Chưa gán shootCamera! Sẽ tự động tìm Camera trong Scene...');
            this.shootCamera = this.node.scene.getComponentInChildren(Camera);
        }

        // Tối ưu Cache Bitmask (Tránh tính toán lại liên tục khi người chơi rê chuột/chạm)
        let combinedMask = 0;
        if (this.targetLayers && this.targetLayers.length > 0) {
            for (let i = 0; i < this.targetLayers.length; i++) {
                combinedMask |= this.targetLayers[i];
            }
        } else {
            combinedMask = 0xffffffff;
        }
        this._cachedFinalMask = combinedMask & (~this.ballGroup);
    }

    private onTouchStart(event: EventTouch) {
        if (!InputController.isActive) return;
        if (this._canShoot) {
            this.updateAiming(event);
        }
    }

    private onTouchMove(event: EventTouch) {
        if (!InputController.isActive) return;
        if (this._canShoot && this._isAiming) {
            this.updateAiming(event);
        }
    }

    private onTouchEnd(event: EventTouch) {
        if (!InputController.isActive) return;
        if (this._isAiming) {
            this._isAiming = false;
            this.handleShooting();
        }
    }

    private updateAiming(event: EventTouch) {
        if (!this.shootCamera) return;

        this.shootCamera.screenPointToRay(event.getLocationX(), event.getLocationY(), this._ray);

        // Raycast dùng mask đã cache
        if (PhysicsSystem.instance.raycastClosest(this._ray, this._cachedFinalMask, 1000, true)) {
            const hit = PhysicsSystem.instance.raycastClosestResult;
            this._isAiming = true;
            this._aimTargetPoint.set(hit.hitPoint);
            SoundManager.Instance(SoundManager).playSound("SFX_Ball_Shoot");
        } else {
            this._isAiming = false;
            this._aimTargetPoint.set(this._ray.o);
            Vec3.scaleAndAdd(this._aimTargetPoint, this._aimTargetPoint, this._ray.d, 100); 
        }

        if (this._isAiming && this.rotator) {
            Vec3.subtract(this._tempVec3, this._aimTargetPoint, this.rotator.worldPosition);
            this._tempVec3.y = 0; // Xoay trên mặt phẳng ngang XZ
            if (this._tempVec3.lengthSqr() > 0.001) {
                this._tempVec3.normalize();
                Quat.fromViewUp(this._tempQuat, this._tempVec3, Vec3.UP);
                this.rotator.worldRotation = this._tempQuat;
            }
        }
    }

    private getTrackedBall(): TrackedBall {
        return this._ballDataPool.length > 0 ? this._ballDataPool.pop() : new TrackedBall();
    }

    private releaseTrackedBall(b: TrackedBall) {
        b.node = null;
        this._ballDataPool.push(b);
    }

    private handleShooting() {
        // Tối ưu Zero-GC: Dùng lặp ngược thay vì .filter()
        for (let i = this._activeBalls.length - 1; i >= 0; i--) {
            const b = this._activeBalls[i];
            if (!b.node || !b.node.isValid) {
                this.releaseTrackedBall(b);
                this._activeBalls.splice(i, 1);
            }
        }

        if (this._activeBalls.length === 0) return;

        // Tối ưu Zero-GC: Tìm bóng đi xa nhất bằng lặp thay vì .sort()
        let bestIdx = 0;
        let maxDistSq = -1;
        
        for (let i = 0; i < this._activeBalls.length; i++) {
            const b = this._activeBalls[i];
            const distSq = Vec3.squaredDistance(b.node.worldPosition, b.spawnPos);
            if (distSq > maxDistSq) {
                maxDistSq = distSq;
                bestIdx = i;
            }
        }

        const leadingBall = this._activeBalls[bestIdx];
        const currentTime = performance.now() / 1000;

        if (currentTime < leadingBall.spawnTime + this.rollDurationToReady) {
            return; // Chưa đủ thời gian lăn trên máng
        }

        const ballToShoot = leadingBall.node;

        if (ballToShoot && ballToShoot.isValid) {
            const ballPos = ballToShoot.worldPosition;
            this._customSpawnPosition.set(ballPos);
            ballToShoot.setWorldPosition(ballPos);
        } else {
            this._customSpawnPosition.set(this.firePoint ? this.firePoint.worldPosition : this.node.worldPosition);
        }

        this.shoot(this._aimTargetPoint, ballToShoot);

        // Loại bỏ quả vừa bắn
        this.releaseTrackedBall(leadingBall);
        this._activeBalls.splice(bestIdx, 1);
    }

    private shoot(targetPoint: Vec3, existingBall: Node = null) {
        if (!this.firePoint) return;

        if (SpawnBullet.instance) {
            let bulletNode: Node = null;

            if (existingBall) {
                bulletNode = (SpawnBullet.instance as any).fireExistingBullet(
                    existingBall,
                    targetPoint,
                    this.shootForce
                );
            } else {
                const spawnPos = this._customSpawnPosition;
                const spawnRot = this.firePoint.worldRotation;

                bulletNode = (SpawnBullet.instance as SpawnBullet).spawnBullet(
                    spawnPos,
                    spawnRot,
                    targetPoint,
                    this.shootForce
                );
            }

            if (bulletNode) {
                this._bulletsFired++;
                if (GameManager.instance) {
                    GameManager.instance.registerBulletFired();
                }
            }
        }
    }

    private startSpawnLoop() {
        this._isSpawningInitial = true;
        this._spawnTimer = 0.2; 
    }

    private stopSpawnLoop() {
        this._isSpawningInitial = false;
    }

    update(dt: number) {
        // Đồng bộ số lượng đạn với GameManager để sinh đúng số lượng bóng
        if (GameManager.instance) {
            this._bulletLimit = GameManager.instance.bulletLimit;
            this._bulletsFired = GameManager.instance.bulletLimit - GameManager.instance.remainingBullets;
        }

        if (!this._isSpawningInitial) return;

        if (this._bulletsFired >= this._bulletLimit) {
            this.stopSpawnLoop();
            return;
        }

        this._spawnTimer -= dt;
        if (this._spawnTimer <= 0) {
            this._spawnTimer = this.spawnInterval;

            if (this._activeBalls.length < this.maxVisualBallsOnSlope &&
                (this._bulletsFired + this._activeBalls.length) < this._bulletLimit) {
                this.spawnVisualBall();
            }
        }
    }

    private spawnVisualBall() {
        const activeSpawnPoint = this._spawnFromLeft ? this.spawnPointLeft : this.spawnPointRight;
        if (!activeSpawnPoint) return;

        this._spawnFromLeft = !this._spawnFromLeft;

        let pushForce = this._tempVec3_2;
        pushForce.set(Vec3.ZERO);

        const targetNode = this.rollTarget || this.firePoint || this.node;
        if (targetNode) {
            Vec3.subtract(pushForce, targetNode.worldPosition, activeSpawnPoint.worldPosition);
            pushForce.normalize();
            pushForce.multiplyScalar(this.initialPushForceMagnitude);
        }

        let ballObj: Node = null;

        if (this._ballPool.length > 0) {
            ballObj = this._ballPool.pop();
        }

        if (!ballObj && this.templateBall) {
            ballObj = instantiate(this.templateBall);
            this.node.addChild(ballObj);
        }

        if (ballObj) {
            ballObj.active = true;
            ballObj.setWorldPosition(activeSpawnPoint.worldPosition);
            ballObj.setWorldRotation(activeSpawnPoint.worldRotation);

            const proj = ballObj.getComponent('Projectile');
            if (proj) {
                proj.enabled = false; 
            }

            const rb = ballObj.getComponent(RigidBody);
            if (rb) {
                rb.clearState(); 
                rb.mass = this.ballMass;
                rb.useGravity = this.ballUseGravity;
                rb.group = this.ballGroup;
                rb.isKinematic = false;

                rb.allowSleep = this.ballAllowSleep;
                rb.linearDamping = this.ballLinearDamping;
                rb.angularDamping = this.ballAngularDamping;
                rb.linearFactor = this.ballLinearFactor; 
                rb.angularFactor = this.ballAngularFactor; 

                rb.applyImpulse(pushForce);
            }

            const colliders = ballObj.getComponents(Collider);
            for (let i = 0; i < colliders.length; i++) {
                colliders[i].setGroup(this.ballGroup);
            }

            // Tối ưu Zero-GC: dùng giá trị reference, không clone() object
            const targetScale = this.templateBall ? this.templateBall.data.scale : Vec3.ONE;
            ballObj.setScale(targetScale);

            const trackedData = this.getTrackedBall();
            trackedData.node = ballObj;
            trackedData.spawnTime = performance.now() / 1000;
            trackedData.spawnPos.set(activeSpawnPoint.worldPosition);
            this._activeBalls.push(trackedData);
        }
    }

    private despawnVisualBall(ballObj: Node) {
        if (!ballObj || !ballObj.isValid) return;

        ballObj.active = false;
        const rb = ballObj.getComponent(RigidBody);
        if (rb) {
            rb.clearState();
        }

        if (this._ballPool.indexOf(ballObj) === -1) {
            this._ballPool.push(ballObj);
        }
    }

    private clearVisualBalls() {
        this.stopSpawnLoop();

        for (const ball of this._activeBalls) {
            if (ball.node && ball.node.isValid) {
                ball.node.destroy();
            }
        }
        this._activeBalls = [];

        for (const ball of this._ballPool) {
            if (ball && ball.isValid) {
                ball.destroy();
            }
        }
        this._ballPool = [];
    }
}
