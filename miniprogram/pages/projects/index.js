const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    windowWidth: 375,
    capsuleLeft: 375 // 胶囊左边界
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect()
    const navBarHeight = menuButtonInfo.bottom + menuButtonInfo.top - info.statusBarHeight
    
    this.setData({
      statusBarHeight: info.statusBarHeight,
      navBarHeight: navBarHeight,
      windowWidth: info.windowWidth,
      capsuleLeft: menuButtonInfo.left
    })
  },

  goToAddProject() {
    wx.navigateTo({
      url: '/pages/project-add/index',
    })
  },

  goToEditProject(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/project-add/index?id=${id}`,
    })
  }
})
