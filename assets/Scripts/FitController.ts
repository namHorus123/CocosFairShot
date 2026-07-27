import { Camera, Component, Node, Quat, Vec3, _decorator, log, macro, math, screen, view, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass
export default class FitController extends Component {
    @property
    fitHeight: boolean = false;
    @property
    fitWidth: boolean = false;

    uITransform: UITransform = null;

    onLoad() {

        this.uITransform = this.node.getComponent(UITransform);
        // Register event listeners with the screen object
        screen.on('window-resize', this.onWindowResize, this);
        screen.on('orientation-change', this.onOrientationChange, this);
        screen.on('fullscreen-change', this.onFullScreenChange, this);


        const { width, height } = screen.windowSize;
        this.resize(width / 2, height / 2)
    }

    onDestroy() {
        // Unregister event listeners when the component is destroyed
        screen.off('window-resize', this.onWindowResize, this);
        screen.off('orientation-change', this.onOrientationChange, this);
        screen.off('fullscreen-change', this.onFullScreenChange, this);
    }

    onWindowResize(width: number, height: number) {
        this.resize(width / 2, height / 2);
    }

    onOrientationChange(orientation: number) {
        if (orientation === macro.ORIENTATION_LANDSCAPE_LEFT || orientation === macro.ORIENTATION_LANDSCAPE_RIGHT) {
            //  console.log("Orientation changed to landscape:", orientation);
        } else {
            // console.log("Orientation changed to portrait:", orientation);
        }
    }

    onFullScreenChange(width: number, height: number) {
        //  console.log("Fullscreen change:", width, height);
        this.resize(width / 2, height / 2)
    }


    resize(width: number, height: number) {

        if (this.fitWidth && this.fitHeight) this.adjustFit(width, height);
        else if (this.fitHeight) this.adjustFitHeight(width, height);
        else if (this.fitWidth) this.adjustFitWidth(width, height);
    }
    adjustFit(width: number, height: number) {
        //  console.log("adjustFit");
        // console.log(width);
        //  console.log(height);


        const designResolution = view.getDesignResolutionSize();
        let scaleCanvas = Math.min(width / designResolution.width, height / designResolution.height)
        // let scaleX = width / designResolution.width
        // let scaleY = height / designResolution.height

        let widthUI = this.uITransform.width * scaleCanvas;
        let new_width: number = this.uITransform.width * (width / widthUI);

        let heightUI = this.uITransform.height * scaleCanvas;
        let new_height: number = this.uITransform.height * (height / heightUI);




        this.uITransform.setContentSize(new_width, new_height)
        //console.log(this.uITransform.contentSize);
    }
    adjustFitHeight(width: number, height: number) {

        console.log("adjustFitHeight");
        const designResolution = view.getDesignResolutionSize();
        let scaleCanvas = Math.min(width / designResolution.width, height / designResolution.height)
        let heightUI = this.uITransform.height * scaleCanvas;

        let newScale: number = height / heightUI;
        let new_height: number = this.uITransform.height * newScale;

        // Điều chỉnh để chỉ khớp chiều cao
        const scaleY = new_height / designResolution.height;
        const newWidth = designResolution.width * scaleY;

        this.uITransform.setContentSize(newWidth, new_height)
        //console.log(this.uITransform.contentSize);
    }
    adjustFitWidth(width: number, height: number) {
        // console.log("adjustFitWidth");
        const designResolution = view.getDesignResolutionSize();

        let scaleCanvas = Math.min(width / designResolution.width, height / designResolution.height)
        let widthUI = this.uITransform.width * scaleCanvas;

        let newScale: number = width / widthUI;
        let new_width: number = this.uITransform.width * newScale;

        const scaleX = new_width / designResolution.width;
        const newHeight = designResolution.height * scaleX;

        this.uITransform.setContentSize(new_width, newHeight)
        //console.log(this.uITransform.contentSize);


    }
}
