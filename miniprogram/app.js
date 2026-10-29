const platform = require('./lib/platform');
App({
  onLaunch() { platform.cleanSceneFiles(); },
  onHide() { platform.suspendMusic(); },
  onShow() { platform.resumeMusic(); },
  onError(error) { console.error('[14亿分之一]', error); }
});
