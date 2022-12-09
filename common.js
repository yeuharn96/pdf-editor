var TextMode = {
    _spnTxt: document.querySelector('#spnTxt'), // hidden <span> help to determine textbox width
    _selFontSize: document.querySelector('#selFontSize'),
    _selFontFamily: document.querySelector('#selFontFamily'),
    _inpTextColor: document.querySelector('#inpTextColor'),

    init() {
        TextMode._selFontSize.value = 16;
        TextMode._selFontFamily.value = 'Helvetica';
    },

    getProperties() {
        return {
            fontSize: TextMode._selFontSize.value + 'pt', // string: '16pt'
            fontFamily: TextMode._selFontFamily.value, // string: 'Helvetica'
            color: TextMode._inpTextColor.value // string: '#FFFFFF'
        };
    },
    setProperties(inpText, textProps = {}) {
        if (inpText == null) return;

        const tp = { ...TextMode.getProperties(), ...textProps };
        Object.keys(tp).forEach(k => {
            TextMode._spnTxt.style[k] = tp[k];
            inpText.style[k] = tp[k];
        });
        TextMode.fitContentWidth(inpText);
    },
    // make textbox fit to content width
    fitContentWidth(inpText) {
        if (inpText == null) return;

        TextMode._spnTxt.innerHTML = inpText.value;
        inpText.style.width = (TextMode._spnTxt.offsetWidth + 3) + 'px';
    },

    toggleBold(inpText) {
        if (inpText == null) return;

        const fontWeight = inpText.style.fontWeight === 'bold' ? 'normal' : 'bold';
        TextMode.setProperties(inpText, { fontWeight });
    },
    toggleItalic(inpText) {
        if (inpText == null) return;

        const fontStyle = inpText.style.fontStyle === 'italic' ? 'normal' : 'italic';
        TextMode.setProperties(inpText, { fontStyle });
    },

    toPdfFont(inpText) {
        let font = inpText.style.fontFamily;
        if (inpText.style.fontWeight === 'bold') font += 'Bold';
        if (inpText.style.fontStyle === 'italic') font += inpText.style.fontFamily === 'TimesRoman' ? 'Italic' : 'Oblique';

        return font;
    }
};

var FreehandMode = {
    _inpFreehandColor: document.querySelector('#inpFreehandColor'),
    _inpFreehandLineWeight: document.querySelector('#inpFreehandLineWeight'),

    getProperties() {
        return {
            color: Utils.hexToRgb(FreehandMode._inpFreehandColor.value), // Array: [255, 255, 255]
            lineWeight: Number(FreehandMode._inpFreehandLineWeight.value) // Number: 3.75
        };
    },
};

var ImageMode = {
    _inpImage: document.querySelector('#inpImage'),
    $image: null, // { url: string, width: Number, height: Number, ratio: Number }

    init() {
        document.querySelector('#inpImage').addEventListener('change', function () {
            const [file] = this.files
            if (file) {
                const imgUrl = URL.createObjectURL(file);

                const img = new Image();
                img.onload = function () {
                    ImageMode.$image = {
                        url: imgUrl,
                        width: this.width, // in px
                        height: this.height, // in px
                        ratio: this.width / this.height // image aspect ratio
                    };
                };
                img.src = imgUrl;
            }
        });
    },

    calcWidth(h) {
        return h * ImageMode.$image.ratio;
    },
    calcHeight(w) {
        return w / ImageMode.$image.ratio;
    },
    calcMaxSize(maxw, maxh) {
        let w, h;
        if (maxw === maxh) {
            if (ImageMode.$image.ratio > 1) { // landscape image
                w = maxw;
                h = ImageMode.calcHeight(maxw);
            }
            else { // portrait
                w = ImageMode.calcWidth(maxh);
                h = maxh;
            }
        }
        // scale with image aspect ratio against longer side
        else if (maxw > maxh) {
            w = maxw;
            h = ImageMode.calcHeight(maxw);
        }
        else {
            w = ImageMode.calcWidth(maxh);
            h = maxh;
        }
        return { w, h };
    },
};

var RectMode = {
    _inpRectFillColor: document.querySelector('#inpRectFillColor'),
    _inpRectFillColorTransparent: document.querySelector('#inpRectFillColorTransparent'),
    _inpRectBorderColor: document.querySelector('#inpRectBorderColor'),
    _inpRectBorderColorTransparent: document.querySelector('#inpRectBorderColorTransparent'),
    _inpRectBorderLineWeight: document.querySelector('#inpRectBorderLineWeight'),

    init() {
        RectMode._inpRectFillColor.value = '#FFFFFF';
        RectMode._inpRectBorderColor.value = '#000000';
        RectMode._inpRectBorderColorTransparent.checked = true;
    },

    getProperties() {
        return {
            fillColor: RectMode._inpRectFillColor.value + (RectMode._inpRectFillColorTransparent.checked ? '00' : 'FF'),
            // noFill: RectMode._inpRectFillColorTransparent.checked,
            borderColor: RectMode._inpRectBorderColor.value + (RectMode._inpRectBorderColorTransparent.checked ? '00' : 'FF'),
            // noBorder: RectMode._inpRectBorderColorTransparent.checked,
            borderLineWeight: Number(RectMode._inpRectBorderLineWeight.value) // Number: 3.75
        };
    },
    setProperties(div, rectProps = {}) {
        if (div == null) return;

        const rp = { ...RectMode.getProperties(), ...rectProps };
        div.style.backgroundColor = rp.fillColor;
        div.style.borderColor = rp.borderColor;
        div.style.borderWidth = rp.borderLineWeight + 'pt';
    },
    setInputValue(value) {
        RectMode._inpRectFillColor.value = Utils.rgbToHex(value.fillColor);
        RectMode._inpRectFillColorTransparent.checked = Boolean(value.fillColor[3]);
        RectMode._inpRectBorderColor.value = Utils.rgbToHex(value.borderColor);
        RectMode._inpRectBorderColorTransparent.checked = Boolean(value.borderColor[3]);
        RectMode._inpRectBorderLineWeight.value = value.borderLineWeight.replace('pt', '');
    }
};

var Utils = {
    _pdfCanvas: document.querySelector('#pdf-canvas'), // <canvas> to show existing pdf content
    _inpPdf: document.querySelector('#inpPdf'), // <input> for user to upload existing pdf file

    isValidNumber(num) {
        // num: String
        return !isNaN(num) && num.length > 0 && Number(num) > 0;
    },
    isInRange(value, min, max, inclusive = true) {
        if (inclusive) return min <= value && value <= max;
        else return min < value && value < max;
    },
    //https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
    hexToRgb(hex) {
        if (!hex.startsWith('#')) return hex;

        hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return [
            parseInt(hex[1], 16),
            parseInt(hex[2], 16),
            parseInt(hex[3], 16)
        ];
    },
    rgbToHex(rgb) {
        const twoDigitHex = (val) => Number(val).toString(16).padStart(2, '0');
        return `#${twoDigitHex(rgb[0])}${twoDigitHex(rgb[1])}${twoDigitHex(rgb[2])}`;
    },
    rgbFromString(rgb) {
        // 'rgb(200, 12, 53)' or 'rgba(225, 20, 20, 0)'
        if (rgb.startsWith('rgba'))
            return rgb.substring(5, rgb.length - 1).split(', ');
        else
            return rgb.substring(4, rgb.length - 1).split(', ');
    },
    toPdfColor(color) {
        if (typeof color === 'string')
            color = Utils.rgbFromString(color);

        // rgb value: 0.0 - 1.0
        return color.map(c => c / 255);
    },
    // https://stackoverflow.com/questions/10855218/conversion-rate-of-pt-em-px-percent-other
    pxToPt(px) {
        return 3 / 4 * px;
    },
    ptToPx(pt) {
        return pt / 3 * 4;
    },

    // https://simon-schraeder.de/posts/filereader-async/
    // read file Blob as byte[]
    fileToBytes(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    // https://alvarotrigo.com/blog/change-css-javascript/
    // modify css rules in <style>
    // changeStyleSheet('.pdf-text', 'font-size', `${fontSize}pt`);
    changeStyleSheet(cssClass, property, value) {
        [...document.styleSheets[1].cssRules].find(r => r.selectorText === cssClass).style.setProperty(property, value);
    }
}


var PdfPageList = {
    _previewCanvas: document.querySelector('#preview-canvas'),
    _divNavPdfPages: document.querySelector('#divNavPdfPages'),
    _divNavPdfPageSpinner: document.querySelector('#divNavPdfPageSpinner'),

    // callback functions
    onInitComplete: null,
    onPageChanged: null, // params: pageNum (Number)

    init(pdfUrl) {
        PdfPageList._toggleSpinner(true);

        PdfReader.toPreviewImages(pdfUrl, PdfPageList._previewCanvas)
            .then(imgList => {
                PdfPageList._divNavPdfPages.querySelectorAll('.div-img-container')
                    .forEach(div => div.remove());

                imgList.forEach(img => {
                    const container = document.createElement('div');
                    container.classList.add('div-img-container');
                    container.innerHTML =
                        `<img src="${img.src}" onclick="PdfPageList.onclickPreviewPage(event)" class="pdf-page-${img.pageNum}"
                            page-num="${img.pageNum}" />
                         <div class="div-page-num">${img.pageNum}</div>`;
                    PdfPageList._divNavPdfPages.appendChild(container);
                });

                PdfPageList._toggleSpinner(false);

                PdfPageList.onInitComplete?.call();
            });
    },

    onclickPreviewPage(event) {
        const img = event.target;
        const changed = !img.classList.contains('active');
        if (changed) {
            const pageNum = Number(img.getAttribute('page-num'));
            PdfPageList.onPageChanged?.call(img, pageNum);
        }
    },

    setCurrentPage(pageNum) {
        PdfPageList._divNavPdfPages.querySelectorAll('.div-img-container img.active')
            .forEach(el => el.classList.remove('active'));

        const pdfPage = PdfPageList._divNavPdfPages.querySelector(`.pdf-page-${pageNum}`);
        if (pdfPage) {
            pdfPage.classList.add('active');
            PdfPageList._divNavPdfPages.scrollTo(0, pdfPage.offsetTop - 40);
        }
    },

    _toggleSpinner(isShow) {
        if (isShow) {
            PdfPageList._divNavPdfPages.classList.remove('overflow-auto');
            PdfPageList._divNavPdfPages.classList.add('overflow-hidden');

            PdfPageList._divNavPdfPageSpinner.classList.remove('d-none');
            PdfPageList._divNavPdfPageSpinner.classList.add('d-flex');
        }
        else {
            PdfPageList._divNavPdfPages.classList.remove('overflow-hidden');
            PdfPageList._divNavPdfPages.classList.add('overflow-auto');

            PdfPageList._divNavPdfPageSpinner.classList.remove('d-flex');
            PdfPageList._divNavPdfPageSpinner.classList.add('d-none');
        }
    }
}



// https://github.com/mozilla/pdf.js
// https://usefulangle.com/post/20/pdfjs-tutorial-1-preview-pdf-during-upload-wih-next-prev-buttons
class PdfReader {
    $url; // string
    $canvas; // HTMLElement
    $doc; // pdfjsLib.getDocument()
    $currentPage; // Number
    $totalPage; // Number

    // --- callback functions ---
    onPdfLoaded; // params: totalPage (Number)
    beforePdfPageRender;
    onPdfPageRendered; // params: page (pdfjsLib.getPage())

    constructor(canvas) {
        this.$canvas = canvas;
    }

    async load(url) {
        this.$url = url;

        const opt = {
            url: this.$url,
            nativeImageDecoderSupport: 'none' // https://github.com/mozilla/pdf.js/issues/9603
        }
        // get handle of pdf document
        this.$doc = await pdfjsLib.getDocument(opt).promise;

        // total pages in pdf
        this.$totalPage = this.$doc.numPages;

        this.onPdfLoaded?.call(this, this.$totalPage);

        // show the first page
        this.$currentPage = 1;
        await this.showPage(this.$currentPage);
    }

    nextPage() {
        if (++this.$currentPage > this.$totalPage) this.$currentPage = this.$totalPage;
        else this.showPage(this.$currentPage);
    }
    prevPage() {
        if (--this.$currentPage < 1) this.$currentPage = 1;
        else this.showPage(this.$currentPage);
    }

    firstPage() {
        if (this.$currentPage !== 1) this.showPage(1);
    }
    lastPage() {
        if (this.$currentPage !== this.$totalPage) this.showPage(this.$totalPage);
    }

    async showPage(pageNum) {
        this.$currentPage = pageNum;

        this.beforePdfPageRender?.call(this);

        // get handle of page
        let page;
        page = await this.$doc.getPage(pageNum);

        // original width of the pdf page at scale 1
        const pdfOriginalWidth = page.getViewport({ scale: 1 }).width;

        // as the canvas is of a fixed width we need to adjust the scale of the viewport where page is rendered
        const scaleRequired = this.$canvas.width / pdfOriginalWidth;

        // get viewport to render the page at required scale
        const viewport = page.getViewport({ scale: scaleRequired });

        // set canvas height same as viewport height
        this.$canvas.height = viewport.height;

        // page is rendered on <canvas> element
        const renderContext = {
            canvasContext: this.$canvas.getContext('2d'),
            viewport
        };

        // render the page contents in the canvas
        await page.render(renderContext).promise;

        this.onPdfPageRendered?.call(this, page);
    }


    // https://stackoverflow.com/questions/62744470/turn-pdf-into-array-of-pngs-using-javascript-with-pdf-js
    static async toPreviewImages(url, canvas) {
        const pdfReader = new PdfReader(canvas);
        const previewImages = [];
        await pdfReader.load(url);

        for (let i = 1; i <= pdfReader.$totalPage; i++) {
            await pdfReader.showPage(i);
            const src = canvas.toDataURL('image/png');
            previewImages.push({ src, pageNum: i });
        }

        return previewImages;
    }
}



// https://pdf-lib.js.org/
class PdfWriter {
    $p5Canvas; // p5.js canvas
    $doc; // PDFLib.PDFDocument
    $pdfFont; // { 'Helvetica': (Object: PDFLib.PDFFont), 'Helvetica-Bold': ... }
    $scaleX = 1; // Number
    $scaleY = 1; // Number
    $pageWidth; // Number
    $pageHeight; // Number

    $pdfImages = []; // [{ src: 'blob_url', img: PDFLib.PDFImage }, ...]

    // dict to process different types of elements
    $draw = {
        'PdfText': this._drawText,
        'FreehandStroke': this._drawSvg,
        'ResizeableImage': this._drawImage,
        'ResizeableRect': this._drawRect
    };

    constructor(canvas) {
        this.$p5Canvas = canvas;
    }

    async outputBytes(pdfBytes, p5PdfElements) {
        this.$doc = await PDFLib.PDFDocument.load(pdfBytes);

        const pages = this.$doc.getPages();
        for (let i = 1; i <= pages.length; i++) {
            if (`${i}` in p5PdfElements)
                await this._processPage(pages[i - 1], p5PdfElements[i]);
        }

        return await this.$doc.save();
    }

    async _processPage(page, elements) {
        console.log('PdfWriter: _processPage', elements);
        const pageSize = page.getSize();
        this.$scaleX = pageSize.width / this.$p5Canvas.width;
        this.$scaleY = pageSize.height / this.$p5Canvas.height;
        this.$pageWidth = pageSize.width;
        this.$pageHeight = pageSize.height;
        page.moveTo(0, pageSize.height); // move to Top-Left corner of the page

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            // if (el instanceof PdfText) this._drawText(page, el);
            // else if (el instanceof FreehandStroke) this._drawSvg(page, el);
            // else if (el instanceof ResizeableImage) this._drawImage(page, el);
            // else if (el instanceof ResizeableRect) this._drawRect(page, el);
            await this.$draw[el.constructor.name]?.call(this, page, el);
        }
    }

    async _initFonts() {
        console.log('PdfWriter: _initFonts');
        const pdfFont = {};
        // only support for ['Helvetica', 'TimesRoman']
        const fonts = Object.keys(PDFLib.StandardFonts).filter(k => ['Helvetica', 'TimesRoman'].some(f => k.includes(f)));
        for (let i = 0; i < fonts.length; i++) {
            pdfFont[fonts[i]] = await this.$doc.embedFont(PDFLib.StandardFonts[fonts[i]]);
        }
        this.$pdfFont = pdfFont;
    }

    /*
     * Calculation:
     * 
     * x: (el.offsetLeft - this.$p5Canvas.x) * this.$scaleX
     *      { el.offsetLeft }: X coord against html doc
     *      { - this.$p5Canvas.x }: make { el.offsetLeft } to X coord against p5Canvas
     * 
     * y: this.$pageHeight - (el.offsetTop - this.$p5Canvas.y + adjustedHeight) * this.$scaleY
     *      { this.$pageHeight }: PDFLib document coordinates (0,0) starts from page Left-Bottom, make it start from page Left-Top
     *      { el.offsetTop }: Y coord against html doc
     *      { - this.$p5Canvas.y }: make { el.offsetTop } to Y coord against p5Canvas
     *      { + adjustedHeight }: make Y coord offset to Left-Bottom corner of element
     */

    async _drawText(page, text) {
        if (!this.$pdfFont) await this._initFonts();

        text.$input.show(); // if not visible (not current page element), offsetLeft & offsetHeight will be 0

        const el = text.$elt; // HTMLElement <input>
        const adjustedHeight = el.offsetHeight * 0.6972; // reduce inner padding of <input> textbox
        const size = Utils.ptToPx(Number(el.style.fontSize.replace('pt', ''))) * Math.max(this.$scaleX, this.$scaleY); // font size in (pt) might be different for pdf pages with different width & height, scale with (px) is more accurate
        const opt = {
            x: (el.offsetLeft - this.$p5Canvas.x) * this.$scaleX,
            y: this.$pageHeight - (el.offsetTop - this.$p5Canvas.y + adjustedHeight) * this.$scaleY,
            size,
            font: this.$pdfFont[TextMode.toPdfFont(el)],
            color: PDFLib.rgb(...Utils.toPdfColor(el.style.color))
        };
        console.log('PdfWriter: _drawText', opt, el.value);
        page.drawText(el.value, opt);

        text.$input.hide();
    }

    /* 
     * svgPath = 'M 0,0 L 100,160 L 130,200 L 150,120'
     * 'M 0,0': MOVE to point (0,0)
     * 'L 100,160': from previous point (0,0) draw a LINE to (100,160)
     * 'L 130,200': from previous point (100,160) draw a LINE to (130,200)
     */
    async _drawSvg(page, stroke) {
        if (stroke.$points.length === 0) return;

        let svgPath = ''; // 'M 0,0' + ' L 100,160' + ' L 130,200' + ' L 150,120' + ...
        stroke.$points.forEach((point, idx) => {
            if (idx === 0) svgPath += `M ${point[0] * this.$scaleX},${point[1] * this.$scaleY}`;
            else svgPath += ` L ${point[0] * this.$scaleX},${point[1] * this.$scaleY}`;
        });

        const opt = {
            borderColor: PDFLib.rgb(...Utils.toPdfColor(stroke.$color)),
            borderWidth: Utils.ptToPx(stroke.$lineWeight) * Math.max(this.$scaleX, this.$scaleY),
            borderLineCap: PDFLib.LineCapStyle.Round // rounded starting & ending point
        }
        console.log('PdfWriter: _drawSvg', opt, svgPath);
        page.drawSvgPath(svgPath, opt);
    }

    // images must embed into pdf document first before drawing on page
    async _drawImage(page, image) {
        const src = image.$image.src;
        let img = this.$pdfImages.find(i => i.src === src);
        if (!img) { // embed if not found
            const bytes = await fetch(src).then(res => res.arrayBuffer()); // convert img data uri to byte array
            const pdfPng = await this.$doc.embedPng(bytes);
            // const img = await this.$doc.embedJpg(bytes);
            img = { src, pdfImg: pdfPng };
            this.$pdfImages.push(img);
        }

        const opt = {
            x: (image.$outerWrap.x - this.$p5Canvas.x) * this.$scaleX,
            y: this.$pageHeight - (image.$outerWrap.y - this.$p5Canvas.y + image.$outerWrap.height) * this.$scaleY,
            width: image.$outerWrap.width * this.$scaleX,
            height: image.$outerWrap.height * this.$scaleY
        };
        console.log('PdfWriter: _drawImage', opt);

        page.drawImage(img.pdfImg, opt);
    }

    async _drawRect(page, rect) {
        const elt = rect.$outerWrap.elt;
        const borderColor = Utils.toPdfColor(elt.style.borderColor);
        const borderOpacity = borderColor[3] == null || borderColor[3] == 1 ? 1 : 0; // check rgb alpha value
        const fillColor = Utils.toPdfColor(elt.style.backgroundColor);
        const opacity = fillColor[3] == null || fillColor[3] == 1 ? 1 : 0; // check rgb alpha value

        const borderWidth = Number(elt.style.borderWidth.replace('pt', ''));
        const borderWidthPx = Utils.ptToPx(borderWidth); // pdf adjustment
        const opt = {
            x: (rect.$outerWrap.x - this.$p5Canvas.x + borderWidthPx / 2) * this.$scaleX,
            y: this.$pageHeight - (rect.$outerWrap.y - this.$p5Canvas.y + rect.$outerWrap.height - borderWidthPx / 2) * this.$scaleY,
            width: (rect.$outerWrap.width - borderWidthPx) * this.$scaleX,
            height: (rect.$outerWrap.height - borderWidthPx) * this.$scaleY,
            borderWidth: borderWidthPx * Math.max(this.$scaleX, this.$scaleY), // border width in (pt) might be different for pdf pages with different width & height, scale with (px) is more accurate
            borderColor: PDFLib.rgb(...borderColor),
            borderOpacity,
            color: PDFLib.rgb(...fillColor),
            opacity,
        };
        console.log('PdfWriter: _drawRect', opt);
        page.drawRectangle(opt);
    }
}
