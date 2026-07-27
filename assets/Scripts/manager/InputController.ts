import { _decorator, Component, Node, input, Input, EventTouch, Camera, geometry, PhysicsSystem, EPhysicsDrawFlags } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Interface mô phỏng IClickableObject của dự án gốc.
 * Các Component gắn trên vật thể cần implement các hàm này để InputController gọi.
 */
export interface IClickableObject {
    canBeClicked(): boolean;
    onObjectClicked(): void;
    onClickBlocked(): void;
}

@ccclass('InputController')
export class InputController extends Component {

    // Static state quản lý bật/tắt input toàn cục
    public static isActive: boolean = true;

    // --- CẤU HÌNH TRÊN EDITOR ---

    @property({ type: Camera, tooltip: 'Camera chính dùng để phóng tia Raycast (ScreenPointToRay)' })
    public mainCamera: Camera | null = null;

    @property({ tooltip: 'Thời gian giữ chạm (giây) để kích hoạt tính năng tăng tốc độ game' })
    public holdThreshold: number = 0.5;

    @property({ tooltip: 'Layer vật lý dùng cho Raycast tìm vật thể Clickable' })
    public clickableLayerMask: number = 0xffffffff;

    // --- BIẾN STATE ---

    private _isHolding: boolean = false;
    private _holdTimer: number = 0;
    private _isScaling: boolean = false;

    // Cache Ray để chống xả rác GC
    private _ray: geometry.Ray = new geometry.Ray();

    onLoad() {
        if (!this.mainCamera) {
            console.warn('[InputController] Chưa gán MainCamera. Sẽ cố gắng tự tìm Camera trong Scene...');
            const camComp = this.node.scene.getComponentInChildren(Camera);
            if (camComp) this.mainCamera = camComp;
        }

        // Bật vẽ Box/Khung viền Physics ra Scene để debug trực quan
        // (PhysicsSystem.instance as any).debugMode = 0; 
        if (typeof EPhysicsDrawFlags !== 'undefined') {
            PhysicsSystem.instance.debugDrawFlags = EPhysicsDrawFlags.NONE;
        } else {
            (PhysicsSystem.instance as any).debugDrawFlags = 0;
        }
    }

    // Tối ưu Playable: Đăng ký sự kiện Input thay vì check trong Update mỗi frame
    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.clearHoldState();
    }

    update(deltaTime: number) {
        if (!InputController.isActive) return;

        this.handleHoldToScale(deltaTime);
    }


    // --- XỬ LÝ SỰ KIỆN CHẠM TAY ---

    private onTouchStart(event: EventTouch) {
        if (!InputController.isActive) return;
        console.log("InputController.TouchStart");

        // Đánh dấu bắt đầu đếm giờ Hold
        this._isHolding = true;
        this._holdTimer = 0;

        // Xử lý Click Raycast ngay tại thời điểm chạm xuống (GetMouseButtonDown)
        this.handleRaycastClick(event);
    }

    private onTouchEnd(event: EventTouch) {
        // Nhả tay (GetMouseButtonUp) -> Hủy trạng thái Hold
        this.clearHoldState();
    }

    // --- XỬ LÝ RAYCAST (RAYCAST 3D) ---

    private handleRaycastClick(event: EventTouch) {
        if (!this.mainCamera || this._isScaling) return;

        // Bắn tia từ Camera xuyên qua điểm chạm màn hình
        this.mainCamera.screenPointToRay(event.getLocationX(), event.getLocationY(), this._ray);

        // Quét Physics Raycast
        // Dùng raycastClosest để tối ưu, chỉ lấy đối tượng đầu tiên chạm phải
        if (PhysicsSystem.instance.raycastClosest(this._ray, this.clickableLayerMask, 1000, false)) {
            const hitResult = PhysicsSystem.instance.raycastClosestResult;
            const hitNode = hitResult.collider.node;

            // Tìm component implement IClickableObject trên Node bị click
            const clickable = this.getClickableComponent(hitNode);

            if (clickable) {
                // (Tối giản Booster Logic cho Playable, chạy thẳng vào Normal Click)
                this.tryPerformNormalClick(clickable);
            }
        }
    }

    /**
     * Duck-typing: Quét tất cả Component trên Node xem có hàm thỏa mãn IClickableObject không
     */
    private getClickableComponent(node: Node): IClickableObject | null {
        const components = node.components;
        for (let i = 0; i < components.length; i++) {
            const comp = components[i] as any;
            if (typeof comp.canBeClicked === 'function' && typeof comp.onObjectClicked === 'function') {
                return comp as IClickableObject;
            }
        }
        return null;
    }

    private tryPerformNormalClick(clickable: IClickableObject) {
        if (clickable.canBeClicked()) {
            clickable.onObjectClicked();
            // TODO: Báo event tutorial nếu cần (GameEventBus.OnTutObjectClicked)
        } else if (typeof clickable.onClickBlocked === 'function') {
            clickable.onClickBlocked();
        }
    }

    // --- XỬ LÝ HOLD TO SCALE (TĂNG TỐC ĐỘ GAME) ---

    private handleHoldToScale(deltaTime: number) {
        if (this._isHolding && !this._isScaling) {
            this._holdTimer += deltaTime;

            if (this._holdTimer >= this.holdThreshold) {
                this._isScaling = true;

                // TODO: Gọi logic tăng tốc độ game tại đây
                // VD: GameplaySpeedManager.Instance.SetSpeedBoostActive(true);
                console.log('[InputController] Đã Hold đủ lâu -> Kích hoạt tăng tốc thời gian (Hold To Scale)!');
            }
        }
    }

    private clearHoldState() {
        this._isHolding = false;
        this._holdTimer = 0;

        if (this._isScaling) {
            this._isScaling = false;

            // TODO: Gọi logic hủy tăng tốc độ game tại đây
            // VD: GameplaySpeedManager.Instance.SetSpeedBoostActive(false);
            console.log('[InputController] Nhả tay -> Trả tốc độ game về bình thường.');
        }
    }

    // --- STATIC PUBLIC API ---

    public static disable() {
        InputController.isActive = false;
        // Ở cấp độ Component, việc clearState nên được quản lý tập trung hoặc broadcast event.
    }

    public static enable() {
        InputController.isActive = true;
    }
}
