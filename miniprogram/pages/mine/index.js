const app = getApp();

Page({
  data: {
    weddingInfo: null,
    userInfo: null
  },

  onShow() {
    this.fetchWeddingInfo();
    this.fetchUserInfo();
  },

  // 获取婚礼账本信息 (支持双人协同)
  async fetchWeddingInfo() {
    try {
      const db = wx.cloud.database();
      const openid = app.globalData.openid || '';
      const _ = db.command;

      const res = await db.collection('wedding_info').where(
        _.or([
          { _openid: openid },
          { partnerOpenid: openid }
        ])
      ).get();
      
      if (res.data.length > 0) {
        const weddingInfo = res.data[0]
        app.globalData.weddingId = weddingInfo._id
        this.setData({ weddingInfo })
      } else {
        app.globalData.weddingId = null
        this.setData({ weddingInfo: null })
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '查询失败', icon: 'none' });
    }
  },

  // 获取用户信息
  async fetchUserInfo() {
    try {
      const db = wx.cloud.database();
      const openid = app.globalData.openid;
      if (!openid) return;
      
      const res = await db.collection('users').where({ _openid: openid }).get();
      if (res.data.length > 0) {
        const user = res.data[0];
        const userInfo = {
          avatarUrl: user.avatarUrl || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
          nickName: user.nickName || '备婚新人'
        };
        app.globalData.userInfo = userInfo;
        this.setData({ userInfo });
      } else {
        this.setData({
          userInfo: {
            avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
            nickName: '备婚新人 (点击完善)'
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  },

  // 跳转完善资料
  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/index'
    });
  },

  onEdit() {
    if (this.data.weddingInfo) {
      const { _id, date, location, budget } = this.data.weddingInfo;
      wx.navigateTo({
        url: `/pages/wedding-create/index?id=${_id}&date=${date}&location=${location}&budget=${budget || ''}`
      });
    } else {
      wx.navigateTo({
        url: '/pages/wedding-create/index'
      });
    }
  }
})
