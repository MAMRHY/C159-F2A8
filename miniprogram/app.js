// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: "cloud1-d1g3j2yfxa7019d32",
      openid: null,
      hasWedding: false,
      loginPromise: null
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
      // 静默调用获取 OpenId 并存入数据库
      this.globalData.loginPromise = this.loginAndCheckWedding();
    }
  },

  loginAndCheckWedding: async function () {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      });
      const openid = res.result.openid;
      this.globalData.openid = openid;

      const db = wx.cloud.database();

      // 更新 users 集合
      const userRes = await db.collection('users').where({ _openid: openid }).get();
      if (userRes.data.length === 0) {
        await db.collection('users').add({
          data: {
            createdAt: db.serverDate(),
            lastLoginTime: db.serverDate()
          }
        });
      } else {
        await db.collection('users').doc(userRes.data[0]._id).update({
          data: {
            lastLoginTime: db.serverDate()
          }
        });
      }

      // 检查 wedding_info
      const weddingRes = await db.collection('wedding_info').where({ _openid: openid }).get();
      this.globalData.hasWedding = weddingRes.data.length > 0;

      return this.globalData;
    } catch (e) {
      console.error("Login failed", e);
      throw e;
    }
  }
});
