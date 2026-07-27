import { _decorator, Component, Node, RigidBody, Vec3, Collider } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DeformHitBehavior')
export class DeformHitBehavior extends Component {
    @property({ type: Node, tooltip: 'Object con chứa Mesh méo mó' })
    public deformedVisual: Node | null = null;

    /**
     * Kích hoạt hiệu ứng méo mó (deform).
     * Kiểm tra trạng thái active trước khi gán để tối ưu performance (tránh việc gán thừa thãi trong Playable Ads).
     */
    public playEffect(): void {
        console.log(`[DeformHitBehavior] playEffect on node: ${this.node.name}`);

        if (this.deformedVisual && !this.deformedVisual.active) {
            // Tắt collider của node con nếu có (sử dụng trực tiếp collider gốc của cha để tránh lỗi lọt lưới / lệch vị trí)
            const childCollider = this.deformedVisual.getComponent(Collider);
            if (childCollider) {
                childCollider.enabled = false;
                console.log(`[DeformHitBehavior] Disabled child collider to use parent's stable collider.`);
            }

            // Kích hoạt hiển thị mesh móp méo
            this.deformedVisual.active = true;
            console.log(`[DeformHitBehavior] Activated deformedVisual mesh: ${this.deformedVisual.name}`);

            // Tìm RigidBody ở node hiện tại hoặc các node cha
            let parentNode: Node | null = this.node;
            let rb: RigidBody | null = null;
            while (parentNode) {
                rb = parentNode.getComponent(RigidBody);
                if (rb) break;
                parentNode = parentNode.parent;
            }

            if (rb) {
                rb.wakeUp();

                // Áp dụng lực văng nhẹ lên trên (giảm lực để văng vừa phải, chân thực)
                const impulseX = (Math.random() - 0.5) * 0.2;
                const impulseY = 0.4 + Math.random() * 0.4;
                const impulseZ = (Math.random() - 0.5) * 0.4;
                const impulseVec = new Vec3(impulseX, impulseY, impulseZ);
                rb.applyImpulse(impulseVec);
                console.log(`[DeformHitBehavior] Applied Impulse: ${impulseVec.toString()}`);

                // Áp dụng xoay tự do (tumble) - Xoay mạnh hơn (tăng hệ số từ 8 lên 20)
                const spinX = (Math.random() - 0.5) * 20;
                const spinY = (Math.random() - 0.5) * 20;
                const spinZ = (Math.random() - 0.5) * 20;
                const spinVec = new Vec3(spinX, spinY, spinZ);
                rb.setAngularVelocity(spinVec);
                console.log(`[DeformHitBehavior] Applied Angular Velocity: ${spinVec.toString()}`);
            }
        }
    }

    /**
     * Khôi phục trạng thái ban đầu.
     */
    public resetBehavior(): void {
        if (this.deformedVisual && this.deformedVisual.active) {
            this.deformedVisual.active = false;
            const childCollider = this.deformedVisual.getComponent(Collider);
            if (childCollider) {
                childCollider.enabled = true;
            }
        }
    }
}
