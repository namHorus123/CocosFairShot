import { _decorator, Component, Vec3, ICollisionEvent } from 'cc';
import { Projectile } from '../gameplay/Projectile'; // Đảm bảo đường dẫn này khớp với vị trí Projectile.ts của bạn

const { ccclass } = _decorator;

@ccclass('TargetReceiver')
export class TargetReceiver extends Component {

    /**
     * Được gọi khi mục tiêu này bị click hoặc bị ngắm bắn trúng (Raycast)
     */
    public onHit(hitPoint: Vec3) {
        console.log(`[TargetReceiver] Target clicked and hit at coordinate: (${hitPoint.x.toFixed(2)}, ${hitPoint.y.toFixed(2)}, ${hitPoint.z.toFixed(2)}) | Node: ${this.node.name}`);
    }

    /**
     * Được gọi khi một viên đạn (Projectile) va chạm vật lý với mục tiêu này
     * @param projectile Component Projectile của viên đạn
     * @param event Dữ liệu va chạm từ Physics Engine
     */
    public onProjectileHit(projectile: Projectile | null, event: ICollisionEvent | null) {
        if (event && event.contacts && event.contacts.length > 0) {
            // Cocos Creator 3D Physics trả về mảng contacts. 
            // Lưu ý: Việc lấy chính xác tọa độ điểm va chạm (hit point) có thể khác nhau 
            // tùy thuộc vào Physics Backend (Cannon.js / Ammo.js / PhysX).
            // Ta log chung để tránh lỗi undefined method ở một số backend.
            console.log(`[TargetReceiver] Target collided with bullet. Has ${event.contacts.length} contact(s) | Node: ${this.node.name}`);
        }
        else {
            console.log(`[TargetReceiver] Target collided with bullet | Node: ${this.node.name}`);
        }
    }
}
