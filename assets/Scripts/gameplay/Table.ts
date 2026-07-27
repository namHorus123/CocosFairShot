import { _decorator, Component, Node, Enum, Quat, Vec3, RigidBody } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Trạng thái của bàn: Tĩnh hoặc Xoay quanh trục
 */
export enum TableState {
    Stationary = 0,
    RotateAroundAxis = 1,
}
Enum(TableState);

@ccclass('Table')
export class Table extends Component {

    // --- CẤU HÌNH CHO PLAYABLE (Thay thế cho TableData/Registry) ---

    @property({ type: TableState, tooltip: 'Trạng thái hoạt động của bàn' })
    public state: TableState = TableState.Stationary;

    @property({ tooltip: 'Chiều rộng của bàn', step: 0.1 })
    public tableWidth: number = 1;

    @property({ tooltip: 'Chiều dài của bàn', step: 0.1 })
    public tableLength: number = 1;

    // --- ROTATION CONFIG ---

    @property({
        tooltip: 'Tốc độ xoay (độ/giây)',
        visible: function (this: Table) { return this.state === TableState.RotateAroundAxis; }
    })
    public rotationSpeed: number = 10;

    @property({
        tooltip: 'Hướng xoay: 0 (Ngược chiều kim đồng hồ / Trái), 1 (Cùng chiều kim đồng hồ / Phải)',
        visible: function (this: Table) { return this.state === TableState.RotateAroundAxis; }
    })
    public rotationDirection: number = 0;

    // --- THAM CHIẾU (REFERENCES) ---

    @property({ type: Node, tooltip: 'Node chứa RigidBody. Nếu trống sẽ tự tìm trên Node này.' })
    public rbNode: Node | null = null;

    @property({ type: Node, tooltip: 'Node chứa bụi cỏ/phụ kiện. Cỏ này sẽ không xoay theo bàn.' })
    public grassNode: Node | null = null;

    @property({ type: Node, tooltip: 'Tâm xoay của bàn. Nếu để trống sẽ lấy chính Node này làm tâm.' })
    public rotationPivot: Node | null = null;

    // --- CACHE VARIABLES (TỐI ƯU GARBAGE COLLECTION) ---
    private _rb: RigidBody | null = null;
    private _targetRotateNode: Node | null = null;
    private _tempQuat: Quat = new Quat();

    onLoad() {
        this._targetRotateNode = this.rotationPivot ? this.rotationPivot : this.node;

        // Xử lý RigidBody giống C#
        if (!this.rbNode) this.rbNode = this.node;
        this._rb = this.rbNode.getComponent(RigidBody);

        if (this._rb) {
            if (this.state === TableState.RotateAroundAxis) {
                // Đảm bảo là Kinematic để di chuyển mượt mà thông qua Transform
                this._rb.isKinematic = true;
                this._rb.useGravity = false;
            } else {
                // Nếu tĩnh, có thể disable RigidBody hoặc set isKinematic để tối ưu vật lý
                this._rb.isKinematic = true;
            }
        }

        this.updateVisual();
    }

    update(deltaTime: number) {
        if (this.state === TableState.RotateAroundAxis) {
            this.rotateTable(deltaTime);
        }

        // Luôn giữ Grass thẳng đứng (không bị xoay theo bàn) - Giống FixedUpdate trong C#
        this.keepGrassUpright();
    }

    /**
     * Xử lý xoay bàn
     */
    private rotateTable(deltaTime: number) {
        if (!this._targetRotateNode) return;

        const directionMultiplier = (this.rotationDirection === 0) ? -1 : 1;
        const deltaAngle = this.rotationSpeed * directionMultiplier * deltaTime;

        // Cộng thêm góc xoay vào trục Y
        const currentEuler = this._targetRotateNode.eulerAngles;
        this._targetRotateNode.setRotationFromEuler(currentEuler.x, currentEuler.y + deltaAngle, currentEuler.z);

        // Lưu ý: Trong Cocos Creator, với RigidBody Kinematic, khi bạn xoay Node (Transform),
        // Collider vật lý bên dưới sẽ tự động được Physics System đồng bộ ở bước vật lý tiếp theo.
        // Do đó không cần gọi rigidbody.MoveRotation như Unity.
    }

    /**
     * Đảm bảo Node "Grass" luôn hướng về 1 phía dù bàn có xoay (Quaternion.identity)
     */
    private keepGrassUpright() {
        if (this.grassNode && this.grassNode.isValid) {
            // Set world rotation về 180 độ trục Y liên tục
            Quat.fromEuler(this._tempQuat, 0, 180, 0);
            this.grassNode.setWorldRotation(this._tempQuat);
        }
    }

    /**
     * Cập nhật hiển thị vật lý hoặc scale (Thay thế UpdateVisual trong C#)
     */
    private updateVisual() {
        // Tìm component VisualTableFake trên node này hoặc các node con
        let visual = this.getComponent('VisualTableFake') as any;
        if (!visual) {
            visual = this.getComponentInChildren('VisualTableFake');
        }

        if (visual && visual.updateVisual) {
            visual.updateVisual(this.tableWidth, this.tableLength);
        }
    }

    /**
     * Cấu hình động các thông số hoạt động của bàn (từ SpawnTable)
     */
    public configureTable(state: TableState, rotationSpeed?: number, rotationDirection?: number): void {
        this.state = state;
        if (rotationSpeed !== undefined) this.rotationSpeed = rotationSpeed;
        if (rotationDirection !== undefined) this.rotationDirection = rotationDirection;

        // Cập nhật lại trạng thái vật lý tương ứng với state mới
        if (!this.rbNode) this.rbNode = this.node;
        if (!this._rb) this._rb = this.rbNode.getComponent(RigidBody);

        if (this._rb) {
            if (this.state === TableState.RotateAroundAxis) {
                this._rb.isKinematic = true;
                this._rb.useGravity = false;
            } else {
                this._rb.isKinematic = true;
            }
        }
    }
}
