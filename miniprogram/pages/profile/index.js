const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    avatarUrl: '', // 预览头像地址（可能是云文件ID，也可能是本地临时路径）
    nickName: '',
    hasChanges: false,
    inviterWeddingId: '', // 如果是从邀请流程跳转过来的，会有此ID
    isInvitedFlow: false
  },

  async onLoad(options) {
    if (options.inviterWeddingId) {
      this.setData({
        inviterWeddingId: options.inviterWeddingId,
        isInvitedFlow: true
      })
    }
    
    // 拉取当前用户信息
    await this.fetchUserProfile()
  },

  async fetchUserProfile() {
    wx.showLoading({ title: '加载资料中' })
    try {
      let openid = app.globalData.openid
      if (!openid) {
        // 如果没有，等待或重新获取
        if (app.globalData.loginPromise) {
          const res = await app.globalData.loginPromise
          openid = res.openid
        } else {
          const res = await wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: { type: 'getOpenId' }
          })
          openid = res.result.openid
          app.globalData.openid = openid
        }
      }

      const res = await db.collection('users').where({ _openid: openid }).get()
      if (res.data.length > 0) {
        const user = res.data[0]
        this.setData({
          avatarUrl: user.avatarUrl || '',
          nickName: user.nickName || ''
        })
        
        // 存入全局
        app.globalData.userInfo = {
          avatarUrl: user.avatarUrl || '',
          nickName: user.nickName || ''
        }
      }
    } catch (e) {
      console.error('获取个人资料失败', e)
    } finally {
      wx.hideLoading()
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      avatarUrl,
      hasChanges: true
    })
  },

  onNicknameInput(e) {
    this.setData({
      nickName: e.detail.value,
      hasChanges: true
    })
  },

  onNicknameBlur(e) {
    this.setData({
      nickName: e.detail.value,
      hasChanges: true
    })
  },

  async onSave() {
    const { avatarUrl, nickName, inviterWeddingId, isInvitedFlow } = this.data
    
    if (!avatarUrl) {
      return wx.showToast({ title: '请上传头像', icon: 'none' })
    }
    if (!nickName || !nickName.trim()) {
      return wx.showToast({ title: '请输入或选择昵称', icon: 'none' })
    }

    wx.showLoading({ title: '保存中...' })

    try {
      let finalAvatarUrl = avatarUrl

      // 1. 如果头像地址是本地临时路径（以 wxfile:// 或 http 开头且不含有 cloud://），需要上传到云存储
      if (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp/') || avatarUrl.startsWith('http://usr/') || avatarUrl.startsWith('tmp/')) {
        const openid = app.globalData.openid || 'unknown'
        const suffix = avatarUrl.match(/\.\w+$/)?.[0] || '.jpg'
        const cloudPath = `avatars/${openid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}`
        
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: avatarUrl
        })
        finalAvatarUrl = uploadRes.fileID
      }

      // 2. 更新数据库中 users 对应记录
      const openid = app.globalData.openid
      const userRes = await db.collection('users').where({ _openid: openid }).get()
      
      const userData = {
        avatarUrl: finalAvatarUrl,
        nickName: nickName.trim(),
        lastLoginTime: db.serverDate(),
        updatedAt: db.serverDate()
      }

      if (userRes.data.length > 0) {
        await db.collection('users').doc(userRes.data[0]._id).update({
          data: userData
        })
      } else {
        userData.createdAt = db.serverDate()
        userData._openid = openid
        await db.collection('users').add({
          data: userData
        })
      }

      // 3. 更新全局变量
      app.globalData.userInfo = {
        avatarUrl: finalAvatarUrl,
        nickName: nickName.trim()
      }

      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })

      // 4. 判断是否处于邀请流程，如果是，则执行绑定婚礼逻辑
      if (isInvitedFlow && inviterWeddingId) {
        await this.bindInvitedWedding(inviterWeddingId)
      } else {
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }

    } catch (e) {
      console.error('保存名片失败', e)
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  // 绑定受邀婚礼
  async bindInvitedWedding(weddingId) {
    wx.showLoading({ title: '关联婚礼账本中...' })
    try {
      const openid = app.globalData.openid
      
      // A. 先检查该婚礼是否存在
      const weddingRes = await db.collection('wedding_info').doc(weddingId).get()
      if (!weddingRes.data) {
        wx.hideLoading()
        wx.showModal({
          title: '绑定失败',
          content: '该婚礼账本不存在或已被删除。',
          showCancel: false,
          success: () => wx.reLaunch({ url: '/pages/index/index' })
        })
        return
      }

      const wedding = weddingRes.data
      
      // B. 判断是否已经是当前婚礼的所有者
      if (wedding._openid === openid) {
        wx.hideLoading()
        wx.showToast({ title: '你已是该婚礼的创建者', icon: 'none' })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index/index' })
        }, 1500)
        return
      }

      // C. 更新婚礼信息的 partnerOpenid，实现双人关联
      await db.collection('wedding_info').doc(weddingId).update({
        data: {
          partnerOpenid: openid,
          partnerJoinedAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })

      // D. 修改全局 hasWedding
      app.globalData.hasWedding = true

      wx.hideLoading()
      wx.showModal({
        title: '恭喜！',
        content: '已成功加入协同备婚账本，开始共同记账吧！',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/index/index' })
        }
      })

    } catch (e) {
      console.error('绑定婚礼失败', e)
      wx.hideLoading()
      wx.showModal({
        title: '绑定失败',
        content: '网络错误，请重新从邀请链接进入绑定。',
        showCancel: false,
        success: () => wx.reLaunch({ url: '/pages/index/index' })
      })
    }
  }
})