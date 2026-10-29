// 14亿分之一 · native WeChat Mini Game entry. No Page, WXML, WXSS or DOM.
const definition = require('./runtime/controller');
const CanvasUI = require('./runtime/canvas-ui');

const canvas = wx.createCanvas();
const page = Object.assign({}, definition, { data: Object.assign({}, definition.data) });
let ui;
page.setData = function (patch, done) {
  Object.assign(this.data, patch);
  ui?.onData(patch);
  if (done) done();
};
ui = new CanvasUI(canvas, page);
page.onLoad();
page.onShow();

wx.onTouchStart?.(event => ui.touchStart(event));
wx.onTouchMove?.(event => ui.touchMove(event));
wx.onTouchEnd?.(event => ui.touchEnd(event));
wx.onTouchCancel?.(() => ui.touchCancel());
wx.onWindowResize?.(() => ui.resize());
wx.onHide?.(() => { page.onHide(); require('./lib/platform').suspendMusic(); });
wx.onShow?.(() => { page.onShow(); require('./lib/platform').resumeMusic(); ui.invalidate(); });
wx.onKeyboardInput?.(event => ui.keyboardValue(event.value));
wx.onKeyboardConfirm?.(event => { ui.keyboardValue(event.value); wx.hideKeyboard?.(); });
wx.showShareMenu?.({ withShareTicket: false });
wx.onShareAppMessage?.(() => {
  const { path, ...share } = page.onShareAppMessage();
  return share;
});

// Export the live game for developer-tool smoke tests and scripted interactions.
module.exports = { page, ui, canvas };
