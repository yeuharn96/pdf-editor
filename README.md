# PDF Editor
A client-side browser PDF editor.<br/>
Setting up a local hosting server is not required, you can directly open <code>index.html</code> with <code>file:///</code> via Chrome.

<h3>The Goal</h3>
To edit pdf files without using any free-trial/paid pdf editor software or free online pdf editor.

<h3>Library used</h3>
A great thanks to people who developed these amazing libraries, this project wouldn't exists without any one of these.
<br/>
<br/>
1. <a href="https://github.com/mozilla/pdf.js">PDF.js</a> for loading and rendering existing pdf on the working canvas.<br/>
2. <a href="https://pdf-lib.js.org/">PDF-LIB</a> for writing new elements into the existing pdf.<br/>
3. <a href="https://p5js.org/">p5.js</a> for handling user interactions while editing pdf.<br/>

<h3>The Flow</h3>
The underlying concept is to use <code>PDF.js</code> library to render existing pdf page on the working canvas, and overlay a <code>p5.js</code> canvas on top of the working canvas.<br/>
User is then able to draw or add new elements (text, image, etc.) on the <code>p5.js</code> canvas.<br/>
While saving the modified pdf, <code>PDF-LIB</code> will receive the position and size of the added elements and output a new pdf file with modified changes from the existing pdf.
