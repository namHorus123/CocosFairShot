import { _decorator, Component, Node, RigidBody, Vec3, director, Director } from 'cc';
import { TableState } from '../gameplay/Table';

const { ccclass, property } = _decorator;

@ccclass('SpawnObjectIngame')
export class SpawnObjectIngame extends Component {

    @property({ tooltip: 'Thời gian chờ (giây) trước khi khóa vật lý (để các component kịp khởi tạo)' })
    public stabilizationDelay: number = 0.1;

    @property({ tooltip: 'Chiều rộng bàn muốn áp dụng cho map này (<= 0 để dùng mặc định)' })
    public tableWidth: number = 1;

    @property({ tooltip: 'Chiều dài bàn muốn áp dụng cho map này (<= 0 để dùng mặc định)' })
    public tableLength: number = 1;

    @property({ type: TableState, tooltip: 'Trạng thái hoạt động của bàn' })
    public tableState: TableState = TableState.Stationary;

    @property({ 
        tooltip: 'Tốc độ xoay (độ/giây). Chỉ có tác dụng khi bàn ở trạng thái xoay.',
        visible: function (this: SpawnObjectIngame) { return this.tableState === TableState.RotateAroundAxis; }
    })
    public rotationSpeed: number = 10;

    @property({ 
        tooltip: 'Hướng xoay: 0 (Ngược chiều kim đồng hồ / Trái), 1 (Cùng chiều kim đồng hồ / Phải). Chỉ có tác dụng khi bàn ở trạng thái xoay.',
        visible: function (this: SpawnObjectIngame) { return this.tableState === TableState.RotateAroundAxis; }
    })
    public rotationDirection: number = 0;

    // KỸ THUẬT ZERO-GC: Thay vì tạo object {body, state} mới liên tục làm rác bộ nhớ,
    // ta dùng 2 mảng song song (Parallel Arrays) để lưu trữ. Rất quan trọng cho Playable Ads.
    private readonly _pendingBodies: RigidBody[] = [];
    private readonly _wasKinematic: boolean[] = [];
    private readonly _managedObjects: Node[] = [];

    start() {
        // Tự động chạy logic ổn định vật lý ngay khi game bắt đầu.
        // Delay một chút để đảm bảo toàn bộ RigidBody của các Node con đã chạy xong onLoad() / onEnable()
        if (this.stabilizationDelay > 0) {
            this.scheduleOnce(() => this.initializePreplacedBlocks(), this.stabilizationDelay);
        } else {
            this.initializePreplacedBlocks();
        }
    }

    private initializePreplacedBlocks() {
        console.log("[SpawnObjectIngame] Bắt đầu xử lý ổn định vật lý cho các block đã xếp sẵn...");

        // Tìm tất cả các RigidBody nằm trong Node này (các block con xếp tay)
        const allRigidBodies = this.node.getComponentsInChildren(RigidBody);
        let successCount = 0;

        for (let i = 0; i < allRigidBodies.length; i++) {
            const rb = allRigidBodies[i];
            const node = rb.node;

            // Bỏ qua chính Node cha và các Node con đang bị ẩn
            // QUAN TRỌNG: Node ẩn chưa gọi onLoad, can thiệp vật lý sẽ lỗi
            if (node === this.node || !node.activeInHierarchy || !rb.enabled) {
                continue;
            }

            const isKinematic = rb.isKinematic;

            // Xóa toàn bộ vận tốc vô tình sinh ra do Engine khởi tạo
            if (!isKinematic) {
                rb.setLinearVelocity(Vec3.ZERO);
                rb.setAngularVelocity(Vec3.ZERO);
            }

            rb.allowSleep = true;

            // Khóa cứng tạm thời để tránh sập tháp do các Collider đè lên nhau ở frame đầu
            rb.isKinematic = true;
            rb.sleep();

            // Lưu trạng thái vào mảng song song
            this._pendingBodies.push(rb);
            this._wasKinematic.push(isKinematic);
            this._managedObjects.push(node);

            successCount++;
        }

        console.log(`[SpawnObjectIngame] Đã tìm thấy và khóa tạm thời ${successCount} khối vật lý.`);

        if (this._pendingBodies.length > 0) {
            // Chờ Physics Engine chạy xong 1 frame rồi mới mở khóa (tránh bị giật)
            director.once(Director.EVENT_AFTER_PHYSICS, this.restorePendingBodies, this);
        }
    }

    private restorePendingBodies() {
        // Khôi phục trạng thái Kinematic gốc của tất cả bodies.
        for (let i = 0; i < this._pendingBodies.length; i++) {
            const body = this._pendingBodies[i];
            if (!body || !body.isValid) continue;

            const wasKinematic = this._wasKinematic[i];
            body.isKinematic = wasKinematic;

            if (!wasKinematic) {
                body.setLinearVelocity(Vec3.ZERO);
                body.setAngularVelocity(Vec3.ZERO);
            }
        }

        // Đưa toàn bộ về trạng thái ngủ cùng một lúc để tạo cấu trúc vững chãi ban đầu.
        // Chỉ khi nào đạn bắn trúng, Engine vật lý mới tự đánh thức khối gỗ đó dậy.
        for (let i = 0; i < this._pendingBodies.length; i++) {
            const body = this._pendingBodies[i];
            if (body && body.isValid && body.node.activeInHierarchy) {
                body.sleep();
            }
        }

        console.log(`[SpawnObjectIngame] Đã mở khóa và đưa ${this._pendingBodies.length} khối vào trạng thái Sleep tĩnh hoàn toàn.`);

        // Clear mảng nhưng giữ nguyên dung lượng đã cấp phát (Tối ưu Zero-GC)
        this._pendingBodies.length = 0;
        this._wasKinematic.length = 0;
    }

    // Hàm gọi khi muốn reset/xóa toàn bộ block
    public clearAll(): void {
        // Hủy bỏ các logic delay nếu map bị destroy sớm
        this.unscheduleAllCallbacks();
        director.off(Director.EVENT_AFTER_PHYSICS, this.restorePendingBodies, this);

        this.restorePendingBodies();

        for (let i = 0; i < this._managedObjects.length; i++) {
            const obj = this._managedObjects[i];
            if (obj && obj.isValid) {
                obj.destroy();
            }
        }

        this._managedObjects.length = 0;
    }
}
