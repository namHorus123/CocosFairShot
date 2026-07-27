import { Vec3 } from "cc";

/** Dùng để chuyển đổi radian sang độ */
const rad2Deg = 180 / Math.PI;

/** Dùng để chuyển đổi độ sang radian */
const deg2Rad = Math.PI / 180;

/** Biến tạm dùng cho tính toán */
const tempVec3 = new Vec3();

/**
 * Công cụ vector
 * @author 陈皮皮 (ifaswind)
 * @version 20220331
 * @requires cocos-creator-3.x
 */
export class VectorUtil {

    /**
     * Tính toán hình chiếu của vector trên mặt phẳng được chỉ định
     * @param vector Vector được chiếu
     * @param planeNormal Pháp tuyến của mặt phẳng
     */
    public static projectOnPlane(vector: Vec3, planeNormal: Vec3) {
        // Cũng có thể dùng hàm chiếu mặt phẳng có sẵn của Vec3
        // return Vec3.projectOnPlane(new Vec3, targetDir, planeNormal);

        // Sử dụng tích vô hướng (dot product) để tính độ dài hình chiếu của vector hướng trên pháp tuyến mặt phẳng
        const projectionLength = Vec3.dot(vector, planeNormal);
        // Nhân pháp tuyến mặt phẳng với độ dài để lấy vector hình chiếu của vector hướng trên pháp tuyến mặt phẳng
        const vectorOnPlane = tempVec3.set(planeNormal).multiplyScalar(projectionLength);
        // Lấy vector hướng trừ đi vector hình chiếu của nó trên pháp tuyến mặt phẳng để được vector hình chiếu trên mặt phẳng
        return Vec3.subtract(new Vec3, vector, vectorOnPlane);
    }

    /**
     * Tính góc giữa hai vector dựa trên trục chỉ định (hướng ngược chiều kim đồng hồ là hướng dương, phạm vi giá trị -180 ~ 180)
     * @param a Vector a
     * @param b Vector b
     * @param axis Vector trục tham chiếu (đảm bảo đã được chuẩn hóa)
     */
    public static signedAngle(a: Vec3, b: Vec3, axis: Vec3) {
        // Chiếu các vector a và b lên mặt phẳng lấy axis làm pháp tuyến
        const aOnAxisPlane = VectorUtil.projectOnPlane(a, axis);
        const bOnAxisPlane = VectorUtil.projectOnPlane(b, axis);
        // Chuẩn hóa
        const aNormalized = aOnAxisPlane.normalize();
        const bNormalized = bOnAxisPlane.normalize();
        // Tìm vector pháp tuyến vuông góc với cả a và b
        const abNormal = Vec3.cross(new Vec3, aNormalized, bNormalized).normalize();
        // Chiều dài hình chiếu của vector pháp tuyến trên axis
        // Nếu chiều dài hình chiếu là dương (+1), nghĩa là vector pháp tuyến cùng hướng với axis (quy tắc bàn tay phải của tích có hướng)
        const sign = Vec3.dot(abNormal, axis);
        // Tính góc giữa vector a và b
        const radian = Math.acos(Vec3.dot(aNormalized, bNormalized));
        // Trộn tất cả lại!
        return radian * sign * rad2Deg;
    }

    // /**
    //  * Tính góc giữa hai vector dựa trên trục chỉ định (hướng ngược chiều kim đồng hồ là hướng dương, phạm vi giá trị -180 ~ 180)
    //  * @param a Vector a
    //  * @param b Vector b
    //  * @param axis Vector trục tham chiếu (đảm bảo đã được chuẩn hóa)
    //  */
    // public static signedAngle(a: Vec3, b: Vec3, axis: Vec3) {
    //     const n = Vec3.cross(new Vec3, a, b);
    //     const r = Math.atan2(Vec3.dot(n, axis), Vec3.dot(a, b));
    //     return -r * rad2Deg;
    // }

}
