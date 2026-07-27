import { game } from 'cc';

/** Dùng để chuyển đổi radian sang độ */
const rad2Deg = 180 / Math.PI;

/** Dùng để chuyển đổi độ sang radian */
const deg2Rad = Math.PI / 180;

/**
 * Công cụ Toán học
 * @author 陈皮皮 (ifaswind)
 * @version 20220322
 * @requires cocos-creator-3.x
 */
export class MathUtil {

    /**
     * Dùng để chuyển đổi radian sang độ
     */
    public static get rad2Deg() {
        return rad2Deg;
    }

    /**
     * Dùng để chuyển đổi độ sang radian
     */
    public static get deg2Rad() {
        return deg2Rad;
    }

    /**
     * Radian sang độ
     * @param radians 
     */
    public static radiansToDegrees(radians: number) {
        return radians * rad2Deg;
    }

    /**
     * Độ sang radian
     * @param degree 
     */
    public static degreesToRadians(degree: number) {
        return degree * deg2Rad;
    }

    /**
     * Giới hạn giá trị (Clamp)
     * @param value Giá trị
     * @param min Giá trị nhỏ nhất
     * @param max Giá trị lớn nhất
     */
    public static clamp(value: number, min: number, max: number) {
        if (value < min) {
            return min;
        } else if (value > max) {
            return max;
        }
        return value;
    }

    /**
     * Giới hạn giá trị (Clamp)
     * @param value Giá trị
     */
    public static clamp01(value: number) {
        return MathUtil.clamp(value, 0, 1);
    }

    /**
     * Nội suy tuyến tính (Lerp)
     * @param from 
     * @param to 
     * @param t 
     */
    public static lerp(from: number, to: number, t: number) {
        return from + (to - from) * MathUtil.clamp01(t);
    }

    /**
     * 0 hoặc 1
     * @param a 
     * @param t 
     */
    public static step(a: number, t: number) {
        return t < a ? 0 : 1;
    }

    /**
     * Nội suy giữa giá trị nhỏ nhất và lớn nhất, có xử lý làm mượt ở các điểm giới hạn
     * @param from 
     * @param to 
     * @param t 
     */
    public static smoothStep(from: number, to: number, t: number) {
        t = MathUtil.clamp01(t);
        t = (-2.0 * t * t * t + 3.0 * t * t);
        return (to * t + from * (1.0 - t));
    }

    /**
     * Điều khiển mượt mà (Smooth damp)
     * @param current Giá trị hiện tại
     * @param target Giá trị mục tiêu
     * @param currentVelocity Vận tốc hiện tại
     * @param smoothTime Thời gian làm mượt
     * @param maxSpeed Vận tốc tối đa
     * @param deltaTime Delta time
     */
    public static smoothDamp(current: number, target: number, currentVelocity: number, smoothTime: number, maxSpeed?: number, deltaTime?: number) {
        maxSpeed = maxSpeed != undefined ? maxSpeed : Number.POSITIVE_INFINITY;
        deltaTime = deltaTime != undefined ? deltaTime : game.deltaTime;
        smoothTime = Math.max(0.0001, smoothTime);
        const num1 = 2 / smoothTime;
        const num2 = num1 * deltaTime;
        const num3 = (1 / (1 + num2 + 0.47999998927116394 * num2 * num2 + 0.23499999940395355 * num2 * num2 * num2));
        const num4 = current - target;
        const num5 = target;
        const max = maxSpeed * smoothTime;
        const num6 = MathUtil.clamp(num4, -max, max);
        target = current - num6;
        const num7 = (currentVelocity + num1 * num6) * deltaTime;
        let velocity = (currentVelocity - num1 * num7) * num3;
        let num8 = target + (num6 + num7) * num3;
        if ((num5 - current > 0) === (num8 > num5)) {
            num8 = num5;
            velocity = (num8 - num5) / deltaTime;
        }
        return {
            value: num8,
            velocity: velocity,
        };
    }

}
