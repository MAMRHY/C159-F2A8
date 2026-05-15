const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    headerBg: 'rgba(255, 255, 255, 0)',
    isLoading: true,
    hasWedding: false
  },

  onPageScroll(e) {
    // 依然保留，防止部分机型触发原生滚动
    this.updateHeaderOpacity(e.scrollTop)
  },

  onScroll(e) {
    // 处理 scroll-view 的滚动
    this.updateHeaderOpacity(e.detail.scrollTop)
  },

  updateHeaderOpacity(scrollTop) {
    console.log('scrollTop', scrollTop)
    let opacity = 0
    if (scrollTop > 0) {
      opacity = Math.min(scrollTop / 100, 1)
    }
    this.setData({
      headerBg: `rgba(255, 255, 255, ${opacity})`
    })
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect()
    // 导航栏高度 = 胶囊下边界 + 胶囊上边界 - 状态栏高度
    const navBarHeight = menuButtonInfo.bottom + menuButtonInfo.top - info.statusBarHeight
    this.setData({
      statusBarHeight: info.statusBarHeight,
      navBarHeight: navBarHeight
    })
  },

  onShow() {
    // 每次显示页面时，重新检查状态
    if (app.globalData.loginPromise) {
      app.globalData.loginPromise.then(res => {
        this.setData({
          isLoading: false,
          hasWedding: app.globalData.hasWedding
        });
      }).catch(err => {
        this.setData({ isLoading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
    } else {
      this.setData({ isLoading: false, hasWedding: app.globalData.hasWedding || false });
    }
  },

  handleStartWedding() {
    // 已经静默登录过获取了 openid，直接跳转即可
    if (!app.globalData.openid) {
      wx.showToast({ title: '登录信息获取失败，请重试', icon: 'none' });
      // 可以考虑重试获取 openid
      app.globalData.loginPromise = app.loginAndCheckWedding();
      return;
    }
    wx.navigateTo({
      url: '/pages/wedding-create/index'
    });
  },

  goToAddExpense() {
    // 暂未实现
    wx.showToast({
      title: '记一笔',
      icon: 'none'
    })
  },

  goToAddProject() {
    wx.navigateTo({
      url: '/pages/project-add/index',
    })
  }
})
