// '#pdf-canvas': normal html canvas for preview existing pdf only
// p5Canvas: overlay on top of '#pdf-canvas', for handling user interactions
var p5Canvas;
var p5Mode = ''; // 'text', 'freehand', 'image', 'rect'
var p5Flag = {
    mouseOverToolbar: false, // p5Mode *: is user mouse on top toolbar
    enableCreateTextbox: true, // p5Mode 'text': false when user editing textbox
    dragging: false, // p5Mode ['image', 'rect']: is user dragging object
    resizing: false, // p5Mode ['image', 'rect']: is user resizing object
    lockAspectRatio: false, // p5Mode ['image', 'rect']: (image: original aspect ratio, rect: 1:1) when user holding SHIFT key
};

var p5CurrentText = null; // p5Mode 'text'
var p5CurrentStroke = []; // p5Mode 'freehand'
var p5CurrentResizeable = null; // p5Mode ['image', 'rect']

// elements added to a pdf page
var p5Elements = []; // [PdfText, FreehandStroke, ResizeableImage, ResizeableRect, ...]

// key: pdf page number, value: elements added to that page
var p5PdfPages = {}; // {'1': p5Elements, '2': p5Elements, ...}



function p5SwitchPage(pageNum) {
    pageNum = pageNum.toString();

    // hide current page elements
    p5Utils.refreshCanvas();
    p5Elements.forEach(el => el.hide());

    if (Array.isArray(p5PdfPages[pageNum])) {
        // load page elements
        p5Elements = p5PdfPages[pageNum];
        p5Elements.forEach(el => el.show());
    }
    else {
        // new page
        p5PdfPages[pageNum] = [];
        p5Elements = p5PdfPages[pageNum];
    }

    p5Undo.switchPage(pageNum);

    // reset focus elements
    p5CurrentText = null;
    p5CurrentStroke = [];
    p5CurrentResizeable = null;
}
function p5SwitchMode(mode) {
    p5Mode = mode;
    p5Elements.filter(el => el.constructor.name.includes('Resizeable') && el.$isFocus).forEach(el => el.focus(false));
    p5CurrentText = null;
    p5CurrentStroke = [];
    p5CurrentResizeable = null;
}


// ----- p5.js functions -----
function setup() {
    p5Canvas = createCanvas(0, 0);
    p5Utils.refreshCanvas();
}
function draw() {
    if (p5Utils.isMouseInCanvas()) {
        p5Draw[p5Mode]?.call();
    }
}
function mousePressed() {
    if (p5Utils.isMouseInCanvas()) {
        p5MousePressed[p5Mode]?.call();
    }
}
function mouseReleased() {
    p5MouseReleased[p5Mode]?.call();
}
function mouseDragged() {
    if (p5Utils.isMouseInCanvas()) {
        p5MouseDragged[p5Mode]?.call();
    }
}
function keyPressed(e) {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        p5Undo.exec(); // run undo action
    }
    else {
        p5KeyPressed[p5Mode]?.call(this, e);
    }
}
function keyReleased(e) {
    p5KeyReleased[p5Mode]?.call(this, e);
}
function windowResized() {
    p5Utils.refreshCanvas();
}


var p5Undo = {
    $btnUndo: document.querySelector('#btnUndo'),
    pages: {}, // {'1': p5Undo.actions, '2': p5Undo.actions, ...}
    actions: [], // [{data: {}, func()}, ...]

    push(act) {
        p5Undo.actions.push(act);
        p5Undo.$btnUndo.disabled = false;
    },
    exec() {
        p5Undo.actions.pop()?.func();
        if (p5Undo.actions.length === 0)
            p5Undo.$btnUndo.disabled = true;
    },

    switchPage(pageNum) {
        if (Array.isArray(p5Undo.pages[pageNum])) {
            p5Undo.actions = p5Undo.pages[pageNum];
        }
        else {
            p5Undo.pages[pageNum] = [];
            p5Undo.actions = p5Undo.pages[pageNum];
        }
        p5Undo.$btnUndo.disabled = p5Undo.actions.length === 0;
    }
}

// ----- event handlers for each editing mode -----
var p5TextMode = {
    offsetX: 0,

    _findCurrentTextbox() {
        return p5Elements.find(t => t.$elt === p5CurrentText)?.$input;
    },
    mousePressed() {
        if (p5Flag.enableCreateTextbox) {
            p5Elements.push(new PdfText());
        }
        else {
            const txt = p5TextMode._findCurrentTextbox();
            if (txt) {
                p5TextMode.offsetX = p5Utils.htmlMouseX() - txt.x;
                p5TextMode._pushUndoAction();
            }
        }
    },
    mouseDragged() {
        const txt = p5TextMode._findCurrentTextbox();
        if (txt) {
            const moveX = mouseX - pmouseX;
            const moveY = mouseY - pmouseY;
            txt.position(p5Utils.htmlMouseX() - p5TextMode.offsetX, p5Utils.htmlMouseY());
        }
    },
    mouseReleased() {
        p5TextMode.offsetX = 0;
    },

    _pushUndoAction() {
        const txt = p5TextMode._findCurrentTextbox();
        if (txt) {
            p5Undo.push({
                data: {
                    textbox: txt,
                    x: txt.x,
                    y: txt.y
                },
                func() {
                    this.data.textbox.position(this.data.x, this.data.y);
                }
            });
        }
    }
};
var p5FreehandMode = {
    draw() {
        if (mouseIsPressed) {
            line(mouseX, mouseY, pmouseX, pmouseY);
            if (p5CurrentStroke.length == 0) // first point
                p5CurrentStroke.push([pmouseX, pmouseY]);

            p5CurrentStroke.push([mouseX, mouseY]); // coordinates of current stroke
        }
    },
    mousePressed() {
        const props = FreehandMode.getProperties();
        stroke(...props.color); // change line color
        strokeWeight(props.lineWeight); // change line weight

        const newStroke = new FreehandStroke([], props.color, props.lineWeight);
        p5Elements.push(newStroke);
        p5CurrentStroke = newStroke.$points;

        p5FreehandMode._pushUndoAction(newStroke);
    },

    _pushUndoAction(newStroke) {
        p5Undo.push({
            data: {
                prevStrokes: get(),
                newStroke
            },
            func() {
                clear();
                image(this.data.prevStrokes, 0, 0);
                p5Elements.splice(p5Elements.indexOf(this.data.newStroke), 1);
            }
        });
    }
};
var p5ResizeableMode = {
    draw() {
        if (mouseIsPressed && p5CurrentResizeable) {
            const dx = mouseX - pmouseX;
            const dy = mouseY - pmouseY;
            if (p5Flag.resizing) {
                p5CurrentResizeable.resize(dx, dy);
            }
            else if (p5Flag.dragging) {
                p5CurrentResizeable.position(p5CurrentResizeable.$x + dx, p5CurrentResizeable.$y + dy);
            }
        }
    },
    mousePressed() {
        if (p5CurrentResizeable) {
            if (p5CurrentResizeable.isMouseInArea()) {
                p5Flag.dragging = true;
                p5ResizeableMode._pushUndoActionEdit();
            }
            else if (p5CurrentResizeable.isMouseInNode()) {
                p5Flag.resizing = true;
                p5ResizeableMode._pushUndoActionEdit();
            }
            else {
                p5CurrentResizeable.focus(false);
                p5CurrentResizeable = null;
            }
        }
        else {
            p5CurrentResizeable = p5Elements.filter(el => el.constructor.name.includes('Resizeable')).find(r => r.isMouseInArea());
            if (!p5CurrentResizeable) {
                if (p5Mode === 'image' && ImageMode.$image?.url) { // create new image
                    const size = ImageMode.calcMaxSize(150, 150);
                    p5CurrentResizeable = new ResizeableImage(ImageMode.$image.url, mouseX, mouseY, size.w, size.h);
                }
                else if (p5Mode === 'rect') {
                    p5CurrentResizeable = new ResizeableRect(mouseX, mouseY, 50, 50);
                }
                else {
                    return;
                }
                p5Elements.push(p5CurrentResizeable);
            }
            p5CurrentResizeable.focus(true);
        }
    },
    mouseReleased() {
        p5Flag.dragging = p5Flag.resizing = false;
    },
    keyPressed(e) {
        if (p5CurrentResizeable) {
            if (e.keyCode === DELETE) {
                if (p5CurrentResizeable) {
                    p5CurrentResizeable.hide();
                    const itemIdx = p5Elements.indexOf(p5CurrentResizeable);
                    p5Elements.splice(itemIdx, 1);
                    p5ResizeableMode._pushUndoActionDelete(itemIdx);

                    p5CurrentResizeable = null;
                }
            }
            else if (e.keyCode === SHIFT) {
                // lock ratio
                p5Flag.lockAspectRatio = true;
            }
            else if ([UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW].includes(e.keyCode)) {
                const movePx = 10;
                const moveX = (e.keyCode === LEFT_ARROW ? -1 : e.keyCode === RIGHT_ARROW ? 1 : 0) * movePx;
                const moveY = (e.keyCode === UP_ARROW ? -1 : e.keyCode === DOWN_ARROW ? 1 : 0) * movePx;
                p5CurrentResizeable.position(p5CurrentResizeable.$x + moveX, p5CurrentResizeable.$y + moveY);
                e.preventDefault();
            }
        }
    },
    keyReleased(e) {
        if (e.keyCode === SHIFT) {
            p5Flag.lockAspectRatio = false;
        }
    },

    _pushUndoActionEdit() {
        const data = {
            element: p5CurrentResizeable,
            isDragging: p5Flag.dragging,
            isResizing: p5Flag.resizing,

            x: p5CurrentResizeable.$x,
            y: p5CurrentResizeable.$y,
            w: p5CurrentResizeable.$width,
            h: p5CurrentResizeable.$height,
            // style: { backgroundColor, borderColor, borderWidth }
        };
        if (p5Mode === 'rect') {
            const style = data.element.$outerWrap.elt.style;
            data['style'] = {
                backgroundColor: style.backgroundColor,
                borderColor: style.borderColor,
                borderWidth: style.borderWidth
            };
        }
        p5Undo.push({
            data,
            func() {
                const el = this.data.element;
                el.setSize(this.data.w, this.data.h);
                el.position(this.data.x, this.data.y);
                if (this.data.style)
                    Object.keys(this.data.style).forEach(k => el.$outerWrap.elt.style[k] = this.data.style[k]);
            }
        });
    },
    _pushUndoActionDelete(itemIdx) {
        p5Undo.push({
            data: { itemIdx, element: p5CurrentResizeable },
            func() {
                p5Elements.splice(itemIdx, 0, this.data.element);
                this.data.element.show();
            }
        });
    }
};



// ----- Dictionaries for readability -----
var p5Draw = {
    // 'text': p5TextMode.draw,
    'freehand': p5FreehandMode.draw,
    'image': p5ResizeableMode.draw,
    'rect': p5ResizeableMode.draw
};
var p5MousePressed = {
    'text': p5TextMode.mousePressed,
    'freehand': p5FreehandMode.mousePressed,
    'image': p5ResizeableMode.mousePressed,
    'rect': p5ResizeableMode.mousePressed
};
var p5MouseReleased = {
    'text': p5TextMode.mouseReleased,
    'freehand': p5FreehandMode.mouseReleased,
    'image': p5ResizeableMode.mouseReleased,
    'rect': p5ResizeableMode.mouseReleased
};
var p5MouseDragged = {
    'text': p5TextMode.mouseDragged,
    // 'freehand': p5FreehandMode.mouseDragged,
    // 'image': p5ResizeableMode.mouseDragged,
    // 'rect': p5ResizeableMode.mouseDragged
};
var p5KeyPressed = {
    // 'text': p5TextMode.keyPressed,
    // 'freehand': p5FreehandMode.keyPressed,
    'image': p5ResizeableMode.keyPressed,
    'rect': p5ResizeableMode.keyPressed
};
var p5KeyReleased = {
    // 'text': p5TextMode.keyReleased,
    // 'freehand': p5FreehandMode.keyReleased,
    'image': p5ResizeableMode.keyReleased,
    'rect': p5ResizeableMode.keyReleased
};





var p5Utils = {
    refreshCanvas() {
        const pdfCnv = Utils._pdfCanvas;
        resizeCanvas(pdfCnv.width, pdfCnv.height);
        const rect = pdfCnv.getBoundingClientRect();
        const off = {
            left: rect.left + window.scrollX,
            top: rect.top + window.scrollY
        };

        p5Canvas.position(off.left, off.top)
        // background(220, 100);
    },
    isMouseInCanvas() {
        return !p5Flag.mouseOverToolbar && Utils.isInRange(mouseX, 0, p5Canvas.width) && Utils.isInRange(mouseY, 0, p5Canvas.height);
    },
    htmlMouseX() {
        // mouseX: coordinates relative against p5Canvas
        // htmlMouseX: coordinates relative against html doc
        return mouseX + p5Canvas.x;
    },
    htmlMouseY() {
        return mouseY + p5Canvas.y;
    }
}





// ----- Element Objects to add into pdf -----
class PdfText {
    $input; // p5.Element: createInput()
    $elt; // HTMLElement

    constructor() {
        const inp = createInput('');
        inp.position(p5Utils.htmlMouseX() - 5, p5Utils.htmlMouseY() - 10);
        inp.class('pdf-text');
        TextMode.setProperties(inp.elt, { fontWeight: 'normal', fontStyle: 'normal' });
        inp.input(event => TextMode.fitContentWidth(event.target));
        inp.elt.onfocus = this.onInputFocus;
        inp.elt.onblur = this.onInputBlur;
        inp.elt.onmouseenter = () => p5Flag.enableCreateTextbox = false;
        inp.elt.onmouseleave = () => p5Flag.enableCreateTextbox = true;
        setTimeout(() => inp.elt.focus(), 1);

        this.$input = inp;
        this.$elt = inp.elt;
    }

    onInputFocus(event) {
        p5Flag.enableCreateTextbox = false;

        const indicator = ['border', 'border-secondary'];
        p5CurrentText?.classList.remove(...indicator);
        p5CurrentText = event.target;
        p5CurrentText?.classList.add(...indicator);
    }

    onInputBlur(event) {
        p5Flag.enableCreateTextbox = true;

        const txt = event.target;
        if (txt.value.length === 0) { // remove empty textbox
            p5Elements.splice(p5Elements.findIndex(el => el.$elt == txt), 1)[0]?.$input.remove();
        }
    }

    show() { this.$input.show(); }
    hide() { this.$input.hide(); }
}

class FreehandStroke {
    $points; // 2D-Array: [[x1,y1], [x2,y2], ...]
    $color; // Array: [r,g,b]
    $lineWeight; // Number

    constructor(points, color, lineWeight) {
        this.$points = points;
        this.$color = color;
        this.$lineWeight = lineWeight;
    }

    show() {
        stroke(...this.$color);
        strokeWeight(this.$lineWeight);
        for (let i = 1; i < this.$points.length; i++) {
            const x = this.$points[i][0],
                y = this.$points[i][1],
                px = this.$points[i - 1][0],
                py = this.$points[i - 1][1];
            line(x, y, px, py);
        }
    }
    hide() { }
}

class Resizeable {
    $resizeNodeSize; // Number
    $x; // Number
    $y; // Number
    $width; // Number
    $height; // Number
    $isFocus; // Boolean
    $nodes; // [{x: () => Number, y: () => Number, pos: string, div: HTMLElement}]
    $outerWrap; // p5.Element: createDiv()

    constructor(cx, cy, width, height) {
        this.$resizeNodeSize = 15;
        // cx, cy: coordinates relative to p5Canvas
        this.$x = cx + p5Canvas.x;
        this.$y = cy + p5Canvas.y;
        this.$width = width;
        this.$height = height;
        this.$isFocus = false;
        this.$nodes = [
            { x: () => -this.$resizeNodeSize, y: () => -this.$resizeNodeSize, pos: 'top-left' }, // top left
            { x: () => this.$width, y: () => -this.$resizeNodeSize, pos: 'top-right' }, // top right
            { x: () => -this.$resizeNodeSize, y: () => this.$height, pos: 'bottom-left' }, // bottom left
            { x: () => this.$width, y: () => this.$height, pos: 'bottom-right' } // bottom right
        ];

        this.$outerWrap = createDiv();
        this.$outerWrap.elt.classList.add('unselectable', 'resizeable');
        this.$outerWrap.style('width', this.$width + 'px');
        this.$outerWrap.style('height', this.$height + 'px');
        this.position(this.$x, this.$y);

        this.createResizeNodes();
    }

    createResizeNodes() {
        this.$nodes.forEach(node => {
            const div = document.createElement('div');
            div.style.left = node.x() + 'px';
            div.style.top = node.y() + 'px';
            div.style.width = div.style.height = this.$resizeNodeSize + 'px';
            div.classList.add('unselectable', 'resize-node', node.pos);
            div.ondragstart = () => false;
            this.$outerWrap.elt.appendChild(div);
            node.div = div;
        });
    }

    position(x, y) {
        this.$outerWrap.position(x, y)
        this.$x = x
        this.$y = y
    }

    repositionNode() {
        this.$nodes.forEach(node => {
            if (node.div) {
                node.div.style.left = node.x() + 'px';
                node.div.style.top = node.y() + 'px';
            }
        });
    }

    focus(isFocus) {
        this.$isFocus = isFocus;
        if (isFocus) {
            p5Elements.filter(el => el.constructor.name.includes('Resizeable')).forEach(r => {
                if (r != this) r.focus(false);
            });
            this.$outerWrap.elt.classList.add('active');
        }
        else {
            this.$outerWrap.elt.classList.remove('active');
        }
    }

    resize(dx, dy) {
        // dx (+): mouse move right, (-): mouse move left
        // dy (+): mouse move down, (-): mouse move up

        const node = this.$nodes.find(node => node.isSelected);
        if (!node) return;

        // simplified from commented code below
        let x, y, w, h;
        const signX = Math.sign(node.x()); // -1 or 1
        const signY = Math.sign(node.y()); // -1 or 1
        w = this.$width + (dx * signX);
        h = this.$height + (dy * signY);
        if (p5Flag.lockAspectRatio) {
            [w, h] = this.resizeWithAspectRatio(w, h);
        }
        x = this.$x - (signX < 0 ? (w - this.$width) : 0);
        y = this.$y - (signY < 0 ? (h - this.$height) : 0);

        /*
            object position coordinates are based on top left corner point
            resizing on [top-left, top-right, bottom-left] corners should also adjust object position accordingly
        */
        // if (node.pos === 'top-left') {
        //     w = this.$width - dx;
        //     h = this.$height - dy;
        //     if(p5Flag.lockAspectRatio){ ... }
        //     x = this.$x - (w - this.$width);
        //     y = this.$y - (h - this.$height);
        // }
        // else if (node.pos === 'top-right') {
        //     w = this.$width + dx;
        //     h = this.$height - dy;
        //     if(p5Flag.lockAspectRatio){ ... }
        //     x = this.$x;
        //     y = this.$y - (h - this.$height);
        // }
        // else if (node.pos === 'bottom-left') {
        //     w = this.$width - dx;
        //     h = this.$height + dy;
        //     if(p5Flag.lockAspectRatio){ ... }
        //     x = this.$x - (w - this.$width);
        //     y = this.$y;
        // }
        // else {
        //     w = this.$width + dx;
        //     h = this.$height + dy;
        //     if(p5Flag.lockAspectRatio){ ... }
        //     x = this.$x;
        //     y = this.$y;
        // }


        const minSize = 15; // px
        if (w < minSize || h < minSize) {
            // min size: 15x15 px
            w = Math.max(w, minSize);
            h = Math.max(h, minSize);
        }
        else {
            this.position(x, y); // top left corner
        }

        this.setSize(w, h);
    }
    setSize(w, h) {
        this.$width = w;
        this.$height = h;

        this.$outerWrap.style('width', this.$width + 'px');
        this.$outerWrap.style('height', this.$height + 'px');
        this.repositionNode();
    }

    resizeWithAspectRatio(w, h) { }


    isMouseInArea() {
        const mx = p5Utils.htmlMouseX();
        const my = p5Utils.htmlMouseY();
        return Utils.isInRange(mx, this.$x, this.$x + this.$width) && Utils.isInRange(my, this.$y, this.$y + this.$height);
    }
    isMouseInNode() {
        const mx = p5Utils.htmlMouseX();
        const my = p5Utils.htmlMouseY();
        return this.$nodes.filter(node => {
            const minHtmlX = node.x() + this.$x, maxHtmlX = minHtmlX + this.$resizeNodeSize;
            const minHtmlY = node.y() + this.$y, maxHtmlY = minHtmlY + this.$resizeNodeSize;
            if (Utils.isInRange(mx, minHtmlX, maxHtmlX) && Utils.isInRange(my, minHtmlY, maxHtmlY)) {
                node.isSelected = true;
                return true;
            }
            else {
                node.isSelected = undefined;
                return false;
            }
        })[0];
    }

    remove() {
        this.$outerWrap.remove();
    }

    show() { this.$outerWrap.show(); }
    hide() { this.focus(false); this.$outerWrap.hide(); }
}

class ResizeableImage extends Resizeable {
    constructor(src, cx, cy, width, height) {
        super(cx, cy, width, height);
        this.$image = this.createImage(src);
    }

    createImage(src) {
        const img = document.createElement('img');
        img.src = src;
        img.classList.add('unselectable');
        img.ondragstart = () => false;
        this.$outerWrap.elt.appendChild(img);

        return img;
    }

    resizeWithAspectRatio(w, h) {
        // resize image with original aspect ratio
        const size = ImageMode.calcMaxSize(w, h);
        return [size.w, size.h];
    }
}

class ResizeableRect extends Resizeable {
    constructor(cx, cy, width, height) {
        super(cx, cy, width, height);
        this.$borderWidth = Utils.ptToPx(1);

        // this.$rect = createDiv();
        this.$outerWrap.elt.classList.add('resizeable-rect');
        // this.$outerWrap.elt.appendChild(this.$rect.elt);

        this.updateProperties();
    }

    focus(isFocus) {
        super.focus(isFocus);
        if (isFocus) {
            const value = {
                fillColor: Utils.rgbFromString(this.$outerWrap.elt.style.backgroundColor),
                borderColor: Utils.rgbFromString(this.$outerWrap.elt.style.borderColor),
                borderLineWeight: this.$outerWrap.elt.style.borderWidth
            };
            RectMode.setInputValue(value);
        }
    }

    updateProperties() {
        RectMode.setProperties(this.$outerWrap.elt);

        let borderWidth = Number(this.$outerWrap.elt.style.borderWidth.replace('pt', ''));
        this.$borderWidth = Utils.ptToPx(borderWidth);

        this.repositionNode();
    }

    resizeWithAspectRatio(w, h) {
        // resize rectangle as square
        const size = Math.max(w, h);
        return [size, size];
    }

    repositionNode() {
        this.$nodes.forEach(node => {
            if (node.div) {
                node.div.style.left = node.x() - this.$borderWidth + 'px';
                node.div.style.top = node.y() - this.$borderWidth + 'px';
            }
        });
    }
}
