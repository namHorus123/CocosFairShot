import { Vec2, Vec3 } from "cc";

/** Tốc độ conveyor khi có block (đơn vị/giây). Khi = 10 thì mọi config time giữ nguyên; khi đổi (vd. 12) thì các time scale theo để tránh bắn lệch. */
const CONVEYOR_SPEED_BASE = 10;

interface Global {
    endGame: boolean,
    video: boolean,
    endTut: boolean,
    /** Tốc độ conveyor gốc (1x). Khi tăng tốc 1.5x thì conveyorSpeedWhenActive = conveyorSpeedBase * 1.5. */
    conveyorSpeedBase: number,
    /** Tốc độ conveyor khi active (đang dùng). = conveyorSpeedBase khi bình thường; = conveyorSpeedBase * 1.5 khi block cuối đã lên. */
    conveyorSpeedWhenActive: number,
    /** Đặt hệ số tốc độ (1 = bình thường, 1.5 = tăng tốc). Cập nhật conveyorSpeedWhenActive để đồng bộ tween/đạn. */
    setConveyorSpeedMultiplier(mult: number): void,
    /** Thời gian tween block (giây) khi speed = 10. Dùng getBlockTweenDurationSec() để lấy giá trị đã scale. */
    blockTweenDurationSecBase: number,
    /** Thời gian đạn bay (giây) khi speed = 10. Dùng getProjectileFlightDurationSec(). */
    projectileFlightDurationSecBase: number,
    /** Hệ số nhân: timeout reset pixel = getProjectileFlightDurationSec() * shotTimeoutMultiplier (vd. 1.5 = dài hơn 50% so với thời gian đạn bay). */
    shotTimeoutMultiplier: number,
    getBlockTweenDurationSec(): number,
    getProjectileFlightDurationSec(): number,
    getShotTimeoutSec(): number,
}
let Global: Global = {
    video: false,
    endGame: false,
    endTut: false,
    conveyorSpeedBase: 8,
    conveyorSpeedWhenActive: 8,
    setConveyorSpeedMultiplier(mult: number): void {
        this.conveyorSpeedWhenActive = this.conveyorSpeedBase * mult;
    },
    blockTweenDurationSecBase: 0.2,
    projectileFlightDurationSecBase: 0.1,
    shotTimeoutMultiplier: 1.5,
    getBlockTweenDurationSec(): number {
        return this.blockTweenDurationSecBase * (CONVEYOR_SPEED_BASE / this.conveyorSpeedWhenActive);
    },
    getProjectileFlightDurationSec(): number {
        return this.projectileFlightDurationSecBase * (CONVEYOR_SPEED_BASE / this.conveyorSpeedWhenActive);
    },
    getShotTimeoutSec(): number {
        return this.getProjectileFlightDurationSec() * this.shotTimeoutMultiplier;
    },
};
export default Global;
export const eventDispatcher = new EventTarget();