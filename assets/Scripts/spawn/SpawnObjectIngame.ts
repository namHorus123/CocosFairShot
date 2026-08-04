import { _decorator, Component, Node, RigidBody, Vec3, director, Director } from 'cc';
import { TableState } from '../gameplay/Table';

const { ccclass, property } = _decorator;

interface RigidbodyAxisState {
    body: RigidBody;
    linearFactor: Vec3;
}

@ccclass('SpawnObjectIngame')
export class SpawnObjectIngame extends Component {

    private static readonly _originalAngularFactors: WeakMap<RigidBody, Vec3> = new WeakMap<RigidBody, Vec3>();
    private static readonly _rotationLockOwners: WeakMap<RigidBody, SpawnObjectIngame> = new WeakMap<RigidBody, SpawnObjectIngame>();
    private static readonly _horizontalLockedBodies: WeakSet<RigidBody> = new WeakSet<RigidBody>();

    public static isHorizontalMovementLocked(body: RigidBody | null): boolean {
        return !!body && SpawnObjectIngame._horizontalLockedBodies.has(body);
    }

    public static isRotationLocked(body: RigidBody | null): boolean {
        return !!body && SpawnObjectIngame._originalAngularFactors.has(body);
    }

    /** Tra lai constraint xoay goc. Return false neu body khong con bi khoa. */
    public static unlockRotation(body: RigidBody | null): boolean {
        if (!body) return false;

        const originalFactor = SpawnObjectIngame._originalAngularFactors.get(body);
        if (!originalFactor) return false;

        const owner = SpawnObjectIngame._rotationLockOwners.get(body);
        if (owner && !owner.allowImpactRotationUnlock) return false;

        // Khi impact du lon thi mo hoan toan ca 3 truc xoay.
        body.angularFactor = Vec3.ONE;
        SpawnObjectIngame._originalAngularFactors.delete(body);
        SpawnObjectIngame._rotationLockOwners.delete(body);
        return true;
    }

    @property({ tooltip: 'Delay cu cua prefab, duoc giu lai de khong lam mat du lieu hien tai.' })
    public stabilizationDelay: number = 0.1;

    @property({ tooltip: 'So game frame cho qua pha physics truoc khi mo lai X/Z.', min: 1, step: 1 })
    public axisLockFrames: number = 10;

    @property({ tooltip: 'Chi cho phep va cham mo khoa xoay khi bien nay = true. Nen de false luc map vua spawn.' })
    public allowImpactRotationUnlock: boolean = false;

    @property({ tooltip: 'Sau bao nhieu giay ke tu luc spawn thi tu cho phep va cham mo khoa xoay.' })
    public impactUnlockEnableDelay: number = 1;

    @property({ tooltip: 'Chieu rong ban muon ap dung cho map nay (<= 0 de dung mac dinh).' })
    public tableWidth: number = 1;

    @property({ tooltip: 'Chieu dai ban muon ap dung cho map nay (<= 0 de dung mac dinh).' })
    public tableLength: number = 1;

    @property({ type: TableState, tooltip: 'Trang thai hoat dong cua ban.' })
    public tableState: TableState = TableState.Stationary;

    @property({
        tooltip: 'Toc do xoay (do/giay). Chi co tac dung khi ban o trang thai xoay.',
        visible: function (this: SpawnObjectIngame) { return this.tableState === TableState.RotateAroundAxis; }
    })
    public rotationSpeed: number = 10;

    @property({
        tooltip: 'Huong xoay: 0 (trai), 1 (phai). Chi co tac dung khi ban o trang thai xoay.',
        visible: function (this: SpawnObjectIngame) { return this.tableState === TableState.RotateAroundAxis; }
    })
    public rotationDirection: number = 0;

    private readonly _bodyStates: RigidbodyAxisState[] = [];
    private readonly _managedObjects: Node[] = [];
    private _isPrepared: boolean = false;
    private _axisLockFramesRemaining: number = 0;

    /**
     * Goi ngay sau instantiate va truoc addChild. Khong tat Rigidbody/Collider,
     * khong sua Kinematic; chi khoa tam chuyen dong ngang X/Z.
     */
    public preparePhysicsActivation(): void {
        if (this._isPrepared) return;
        this._isPrepared = true;
        this.allowImpactRotationUnlock = false;

        const bodies = this.node.getComponentsInChildren(RigidBody);
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];

            this._bodyStates.push({
                body,
                linearFactor: body.linearFactor.clone()
            });
            // Node goc cung phai duoc khoa neu no co Rigidbody, nhung khong dua
            // node goc vao danh sach destroy cua cac object con.
            if (body.node !== this.node) {
                this._managedObjects.push(body.node);
            }

            // Ban dau chi cho phep roi theo Y; khoa xoay X/Y/Z den khi impact du lon.
            body.linearFactor = new Vec3(0, 1, 0);
            SpawnObjectIngame._horizontalLockedBodies.add(body);
            SpawnObjectIngame._originalAngularFactors.set(body, body.angularFactor.clone());
            SpawnObjectIngame._rotationLockOwners.set(body, this);
            body.angularFactor = Vec3.ZERO;
        }

        //    console.log(`[SpawnObjectIngame] Da khoa xoay X/Y/Z cua tat ca ${bodies.length} Rigidbody.`);
    }

    /** Goi ham nay khi map da on dinh va duoc phep mo xoay boi va cham. */
    public setImpactRotationUnlockAllowed(allowed: boolean): void {
        this.allowImpactRotationUnlock = allowed;
    }

    private enableImpactRotationUnlock(): void {
        this.allowImpactRotationUnlock = true;
        //    console.log('[SpawnObjectIngame] Da cho phep impact mo khoa xoay Rigidbody.');
    }

    start(): void {
        // Fallback neu prefab dat truc tiep trong scene, khong qua MapSpawner.
        this.preparePhysicsActivation();

        this._axisLockFramesRemaining = Math.max(1, Math.round(this.axisLockFrames));
        director.off(Director.EVENT_AFTER_PHYSICS, this.waitAxisLockFrames, this);
        director.on(Director.EVENT_AFTER_PHYSICS, this.waitAxisLockFrames, this);

        if (this.impactUnlockEnableDelay > 0) {
            this.scheduleOnce(this.enableImpactRotationUnlock, this.impactUnlockEnableDelay);
        } else {
            this.enableImpactRotationUnlock();
        }
    }

    private waitAxisLockFrames(): void {
        this._axisLockFramesRemaining--;
        if (this._axisLockFramesRemaining > 0) return;

        director.off(Director.EVENT_AFTER_PHYSICS, this.waitAxisLockFrames, this);
        console.log(`[SpawnObjectIngame] Da cho xong ${Math.max(1, Math.round(this.axisLockFrames))} frame, bat dau mo lai chuyen dong X/Z.`);
        this.restoreOriginalAxisFactors();
    }

    private restoreOriginalAxisFactors(): void {
        for (let i = 0; i < this._bodyStates.length; i++) {
            const state = this._bodyStates[i];
            SpawnObjectIngame._horizontalLockedBodies.delete(state.body);
            if (!state.body || !state.body.isValid) continue;

            state.body.linearFactor = Vec3.ONE;
            state.body.angularFactor = Vec3.ONE;

        }

        //  console.log(`[SpawnObjectIngame] Da mo lai chuyen dong goc cho ${this._bodyStates.length} Rigidbody; xoay X/Y/Z van bi khoa.`);
        this._bodyStates.length = 0;
    }

    public clearAll(): void {
        director.off(Director.EVENT_AFTER_PHYSICS, this.waitAxisLockFrames, this);
        this.unscheduleAllCallbacks();
        this.restoreOriginalAxisFactors();

        for (let i = 0; i < this._managedObjects.length; i++) {
            const obj = this._managedObjects[i];
            if (obj && obj.isValid) obj.destroy();
        }

        this._managedObjects.length = 0;
        this._isPrepared = false;
    }
}
