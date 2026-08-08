const app = getApp()

Page({
  data: {
    isLoading: true,
    hasWedding: false
  },

  inviterWeddingId: '',

  onLoad(options) {
    if (options && options.inviterWeddingId) {
      this.inviterWeddingId = options.inviterWeddingId
    }
  },

  onShow() {
    this.checkLoginAndWeddingState()
  },

  checkLoginAndWeddingState() {
    if (app.globalData.loginPromise) {
      app.globalData.loginPromise.then(res => {
        const hasWedding = app.globalData.hasWedding;
        this.setData({
          hasWedding: hasWedding
        });

        // 如果用户收到另一个婚礼账本的邀请
        if (this.inviterWeddingId) {
          this.checkAndProcessInvitation(this.inviterWeddingId);
          this.inviterWeddingId = ''; // 消费后清除
        } else if (hasWedding) {
          // 如果已经创建过婚礼，直接进入首页
          wx.switchTab({
            url: '/pages/index/index'
          });
        } else {
          // 没有婚礼且没有收到邀请，停留在启动页，取消加载状态
          this.setData({ isLoading: false });
        }
      }).catch(err => {
        this.setData({ isLoading: false });
        wx.showToast({ title: '加载失败，请检查网络', icon: 'none' });
      });
    } else {
      const hasWedding = app.globalData.hasWedding || false;
      this.setData({
        isLoading: false,
        hasWedding: hasWedding
      });

      if (this.inviterWeddingId) {
        this.checkAndProcessInvitation(this.inviterWeddingId);
        this.inviterWeddingId = ''; // 消费后清除
      } else if (hasWedding) {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    }
  },

  handleStartWedding() {
    if (!app.globalData.openid) {
      wx.showToast({ title: '登录信息获取中，请稍后重试', icon: 'none' });
      // 重新尝试登录
      app.globalData.loginPromise = app.handleStartWedding();
      this.checkLoginAndWeddingState();
      return;
    }
    wx.navigateTo({
      url: '/pages/wedding-create/index'
    });
  },

  // 检测邀请绑定逻辑
  async checkAndProcessInvitation(inviterWeddingId) {
    // 确保已登录获取了 openid
    let openid = app.globalData.openid;
    if (!openid) {
      if (app.globalData.loginPromise) {
        try {
          const res = await app.globalData.loginPromise;
          openid = res.openid;
        } catch (e) {
          this.setData({ isLoading: false });
          return;
        }
      } else {
        this.setData({ isLoading: false });
        return;
      }
    }

    try {
      const db = wx.cloud.database();

      // 1. 如果用户自己已经有婚礼了，检查是否就是该婚礼
      const myWeddingRes = await db.collection('wedding_info').where(
        db.command.or([
          { _openid: openid },
          { partnerOpenid: openid }
        ])
      ).get();

      if (myWeddingRes.data.length > 0) {
        const myWedding = myWeddingRes.data[0];
        if (myWedding._id === inviterWeddingId) {
          wx.showToast({ title: '你已加入该婚礼账本', icon: 'none' });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' });
          }, 1500);
          return;
        } else {
          wx.showModal({
            title: '无法加入',
            content: '你已经关联了其他婚礼财务账本，无法同时加入多个账本。',
            showCancel: false,
            success: () => {
              wx.switchTab({ url: '/pages/index/index' });
            }
          });
          return;
        }
      }

      // 2. 还没有婚礼账本，拉取邀请人姓名（昵称）以做友好提示
      this.setData({ isLoading: true });
      const inviterWedding = await db.collection('wedding_info').doc(inviterWeddingId).get();
      if (!inviterWedding.data) {
        this.setData({ isLoading: false });
        wx.showToast({ title: '邀请链接已失效', icon: 'none' });
        return;
      }

      const inviterOpenid = inviterWedding.data._openid;
      const inviterUserRes = await db.collection('users').where({ _openid: inviterOpenid }).get();
      const inviterName = inviterUserRes.data.length > 0 ? (inviterUserRes.data[0].nickName || '你的伴侣') : '你的伴侣';

      this.setData({ isLoading: false });

      // 3. 弹窗询问是否加入
      wx.showModal({
        title: '协同备婚邀请',
        content: `「${inviterName}」邀请你共同管理婚礼财务账本，是否接受？`,
        confirmText: '接受邀请',
        cancelText: '暂不接受',
        success: async (res) => {
          if (res.confirm) {
            // 4. 检查自己是否完善了头像和昵称
            const userInfo = app.globalData.userInfo;
            if (!userInfo || !userInfo.avatarUrl || !userInfo.nickName) {
              wx.showModal({
                title: '完善个人信息',
                content: '在加入账本前，请先完善你的头像和昵称，方便伴侣识别。',
                showCancel: false,
                confirmText: '去完善',
                success: () => {
                  wx.navigateTo({
                    url: `/pages/profile/index?inviterWeddingId=${inviterWeddingId}`
                  });
                }
              });
            } else {
              // 5. 已完善，直接执行绑定
              await this.handleBindWedding(inviterWeddingId);
            }
          }
        }
      });

    } catch (e) {
      console.error('检查邀请失败', e);
      this.setData({ isLoading: false });
    }
  },

  // 绑定婚礼逻辑
  async handleBindWedding(weddingId) {
    wx.showLoading({ title: '加入备婚账本中...' })
    try {
      const db = wx.cloud.database()
      const openid = app.globalData.openid

      // 更新婚礼信息的 partnerOpenid，实现双人关联
      await db.collection('wedding_info').doc(weddingId).update({
        data: {
          partnerOpenid: openid,
          partnerJoinedAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })

      app.globalData.hasWedding = true
      app.globalData.weddingId = weddingId
      this.setData({ hasWedding: true })

      wx.hideLoading()
      wx.showModal({
        title: '恭喜！',
        content: '已成功加入协同备婚账本，开始共同记账吧！',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })

    } catch (e) {
      console.error('绑定婚礼失败', e)
      wx.hideLoading()
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' })
    }
  }
})
