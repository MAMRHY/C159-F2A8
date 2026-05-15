const app = getApp();

Page({
  data: {
    weddingInfo: null
  },

  onShow() {
    this.fetchWeddingInfo();
  },

  async fetchWeddingInfo() {
    try {
      const db = wx.cloud.database();
      // 小程序端直接查 wedding_info 会自动带上当前用户的 openid 进行鉴权
      const res = await db.collection('wedding_info').get();
      
      if (res.data.length > 0) {
        this.setData({ weddingInfo: res.data[0] });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '查询失败', icon: 'none' });
    }
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
