Page({
  data: {},

  onLoad(options) {
    // 页面加载
  },

  onAddRecord() {
    wx.navigateTo({
      url: '/pages/record-add/index'
    });
  }
})
