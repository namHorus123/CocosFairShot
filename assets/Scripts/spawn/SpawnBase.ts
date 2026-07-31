import { Component } from 'cc';

/**
 * Lớp cha Generic hỗ trợ cơ chế Singleton tự động.
 * 
 * Lưu ý: Trong Cocos Creator, bạn không nên đặt @ccclass() cho class Generic.
 * Các lớp con kế thừa từ SpawnBase cần tự định nghĩa @ccclass('TênClassCon').
 */
export abstract class SpawnBase<T extends Component> extends Component {
    
    /**
     * Lấy instance Singleton của lớp con hiện tại.
     * Trả về kiểu của lớp con kế thừa (T).
     */
    public static get instance(): any {
        // Ép kiểu this về any để lấy _instance tương ứng với class con đang gọi
        return (this as any)._instance;
    }

    protected onLoad() {
        const ctor = this.constructor as any;
        if (!ctor._instance) {
            ctor._instance = this;
        } else if (ctor._instance !== this) {
            console.warn(`[SpawnBase] Multiple instances of ${ctor.name} detected! Destroying the duplicate.`);
            this.node.destroy();
        }
    }

    protected onDestroy() {
        const ctor = this.constructor as any;
        // Xóa tham chiếu Singleton khi component bị destroy
        if (ctor._instance === this) {
            ctor._instance = null;
        }
    }

    /**
     * Phương thức ảo Spawn, cần được implement ở lớp con.
     * @param gameplayData Dữ liệu cấu hình cho quá trình spawn (MasterGameplayData)
     */
    public abstract spawn(gameplayData: any): void;

    /**
     * Phương thức ảo ClearAll, cần được implement ở lớp con để dọn dẹp các object đã spawn.
     */
    public abstract clearAll(): void;
}
