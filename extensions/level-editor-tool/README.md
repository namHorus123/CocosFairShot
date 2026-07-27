# Level Editor Tool

Editor Extension dành riêng cho Cocos Creator 3.8.4. Tool tạo level trên nhiều grid XY xếp theo trục Z và generate trực tiếp thành `db://assets/Levels/Level_001.prefab`.

## Sử dụng

1. Trong Cocos Creator, reload/enable extension `level-editor-tool`.
2. Mở `assets/Scene/EditorMap.scene`.
3. Mở **Extension → Level Editor Tool**.
4. Kéo 5 Prefab vào các slot `Cube_1`, `Cube_3`, `Cube_4`, `Cube_5`, `Special`.
5. Chọn Piece, Axis, Angle rồi click Cell, hoặc kéo tay cầm **Kéo vào Grid** thả trực tiếp lên Cell. Right-click một Piece để xóa.
6. Nút `G1`, `G2`... bật/tắt riêng từng Grid; Grid ẩn đồng thời bị khóa.
7. Dùng **View: 1 Grid / View: All** để cô lập một layer hoặc xem toàn bộ map 3D.
8. Chọn Grid trong dropdown rồi bấm **Delete Grid** để xóa. Piece chạm vào Grid đó cũng bị xóa; các layer phía sau tự dồn Z xuống.
9. Bấm **Generate Prefab** để ghi `Assets/Levels/Level_001.prefab`.

Khi generate, mỗi Prefab nguồn được instantiate và bake thành hierarchy thật trong `Level_001` (giữ node, component và asset reference). Root Piece dùng tên Prefab nguồn kèm ID, ví dụ `Glass Cube_1`; tool không lưu nested `New Node` rỗng. Trước khi báo thành công, tool kiểm tra lại root PrefabInfo, số Piece, toàn bộ node/component, position/rotation và chính file AssetDB vừa ghi.

Panel mở sẵn một level mẫu 5×5, 3 layer. Có thể bấm **Level mẫu** để khôi phục ví dụ bất cứ lúc nào.

## Kiểm tra

```powershell
node C:\ProgramData\cocos\editors\Creator\3.8.4\resources\app.asar.unpacked\node_modules\typescript\bin\tsc -p .
node test/model.test.js
node test/scene-integration.test.js
node test/main-integration.test.js
```
