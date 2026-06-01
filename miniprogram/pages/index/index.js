const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    headerBg: 'rgba(255, 255, 255, 0)',
    isLoading: true,
    hasWedding: false,
    totalBudget: 0,
    totalSpent: 0,
    totalPaid: 0,
    spentPercent: 0,
    paidPercent: 0,
    formattedTotalBudget: '0',
    formattedTotalSpent: '0',
    formattedTotalPaid: '0',
    showLabels: false,
    countdownDays: '-',
    countdownLabel: '距离婚礼还有',
    
    // 邀请与协同数据
    weddingId: '',
    memberAvatars: [],
    showInviteModal: false
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
    let opacity = 0
    if (scrollTop > 0) {
      opacity = Math.min(scrollTop / 100, 1)
    }
    this.setData({
      headerBg: `rgba(255, 255, 255, ${opacity})`
    })
  },

  onLoad(options) {
    if (options && options.inviterWeddingId) {
      this.inviterWeddingId = options.inviterWeddingId
    }
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
        
        // 处理邀请绑定逻辑
        if (this.inviterWeddingId) {
          this.checkAndProcessInvitation(this.inviterWeddingId);
          this.inviterWeddingId = ''; // 消费后清除
        } else if (app.globalData.hasWedding) {
          this.fetchBudgetData();
        }
      }).catch(err => {
        this.setData({ isLoading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
    } else {
      this.setData({ isLoading: false, hasWedding: app.globalData.hasWedding || false });
      
      // 处理邀请绑定逻辑
      if (this.inviterWeddingId) {
        this.checkAndProcessInvitation(this.inviterWeddingId);
        this.inviterWeddingId = ''; // 消费后清除
      } else if (app.globalData.hasWedding) {
        this.fetchBudgetData();
      }
    }
  },

  async fetchBudgetData() {
    try {
      const db = wx.cloud.database();

      let openid = app.globalData.openid;
      if (!openid) {
        const res = await wx.cloud.callFunction({ name: 'quickstartFunctions', data: { type: 'getOpenId' } });
        openid = res.result.openid;
        app.globalData.openid = openid;
      }

      // 获取总预算和婚期 (支持双人协同)
      const _ = db.command;
      const weddingRes = await db.collection('wedding_info').where(
        _.or([
          { _openid: openid },
          { partnerOpenid: openid }
        ])
      ).get();

      let totalBudget = 0;
      let weddingDate = '';
      let weddingId = '';
      let membersOpenids = [];

      if (weddingRes.data.length > 0) {
        const wedding = weddingRes.data[0];
        totalBudget = wedding.budget || 0;
        weddingDate = wedding.date || '';
        weddingId = wedding._id;
        
        membersOpenids.push(wedding._openid);
        if (wedding.partnerOpenid) {
          membersOpenids.push(wedding.partnerOpenid);
        }
      }

      // 查询婚礼成员的用户头像和昵称
      let memberAvatars = [];
      if (membersOpenids.length > 0) {
        const usersRes = await db.collection('users').where({
          _openid: _.in(membersOpenids)
        }).get();
        
        membersOpenids.forEach(mOpenid => {
          const user = usersRes.data.find(u => u._openid === mOpenid);
          if (user) {
            memberAvatars.push({
              openid: mOpenid,
              avatarUrl: user.avatarUrl || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
              nickName: user.nickName || '备婚协作者'
            });
          } else {
            memberAvatars.push({
              openid: mOpenid,
              avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
              nickName: mOpenid === openid ? '我' : '伴侣'
            });
          }
        });
      }

      let countdownDays = '';
      let countdownLabel = '距离婚礼还有';

      if (weddingDate) {
        // 兼容 iOS
        const safeDateStr = weddingDate.replace(/-/g, '/');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(safeDateStr);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          countdownDays = diffDays;
          countdownLabel = '距离婚礼还有';
        } else {
          countdownDays = Math.abs(diffDays);
          countdownLabel = '新婚快乐';
        }
      } else {
        countdownLabel = '未设置婚期';
      }

      // 获取所有支出
      const MAX_LIMIT = 100;
      const countResult = await db.collection('expenses').count();
      const total = countResult.total;
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      const tasks = [];
      for (let i = 0; i < batchTimes; i++) {
        const promise = db.collection('expenses').skip(i * MAX_LIMIT).limit(MAX_LIMIT).get();
        tasks.push(promise);
      }

      let totalSpent = 0;
      let totalPaid = 0;

      if (tasks.length > 0) {
        const results = await Promise.all(tasks);
        results.forEach(res => {
          res.data.forEach(item => {
            const amount = item.amount || 0;
            totalSpent += amount;
            if (item.paid) {
              totalPaid += amount;
            }
          });
        });
      }

      let spentPercent = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
      let paidPercent = totalBudget > 0 ? Math.min(Math.round((totalPaid / totalBudget) * 100), 100) : 0;

      if (totalBudget === 0 && totalSpent > 0) {
        spentPercent = 100;
        paidPercent = totalPaid > 0 ? Math.round((totalPaid / totalSpent) * 100) : 0;
      }

      this.setData({
        weddingId,
        memberAvatars,
        totalBudget,
        totalSpent,
        totalPaid,
        spentPercent,
        paidPercent,
        formattedTotalBudget: this.formatNumber(totalBudget),
        formattedTotalSpent: this.formatNumber(totalSpent),
        formattedTotalPaid: this.formatNumber(totalPaid),
        countdownDays,
        countdownLabel,
        showLabels: false
      }, () => {
        setTimeout(() => {
          this.setData({ showLabels: true });
        }, 500);
      });

    } catch (e) {
      console.error('获取预算失败', e);
    }
  },

  handleHelpTap() {
    console.log('handleHelpTap');
    wx.showModal({
      title: '预算进度说明',
      content: '反映当前支出对总预算的消耗。\r\n已支：包括已支付和待支付的款项\r\n已付：实际已经付出去的金额',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  formatNumber(num) {
    return Number(num).toLocaleString('zh-CN');
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
    wx.navigateTo({
      url: '/pages/record-add/index',
    })
  },

  goToAllExpenses() {
    wx.switchTab({
      url: '/pages/record/index',
    })
  },

  goToAddProject() {
    wx.navigateTo({
      url: '/pages/project-add/index',
    })
  },

  // 检测邀请绑定逻辑
  async checkAndProcessInvitation(inviterWeddingId) {
    const openid = app.globalData.openid;
    if (!openid) return;

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
          this.fetchBudgetData();
          return;
        } else {
          wx.showModal({
            title: '无法加入',
            content: '你已经关联了其他婚礼财务账本，无法同时加入多个账本。',
            showCancel: false
          });
          this.fetchBudgetData();
          return;
        }
      }

      // 2. 还没有婚礼账本，拉取邀请人姓名（昵称）以做友好提示
      const inviterWedding = await db.collection('wedding_info').doc(inviterWeddingId).get();
      if (!inviterWedding.data) {
        wx.showToast({ title: '邀请链接已失效', icon: 'none' });
        return;
      }

      const inviterOpenid = inviterWedding.data._openid;
      const inviterUserRes = await db.collection('users').where({ _openid: inviterOpenid }).get();
      const inviterName = inviterUserRes.data.length > 0 ? (inviterUserRes.data[0].nickName || '你的伴侣') : '你的伴侣';

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
      this.setData({ hasWedding: true })

      wx.hideLoading()
      wx.showModal({
        title: '恭喜！',
        content: '已成功加入协同备婚账本，开始共同记账吧！',
        showCancel: false,
        success: () => {
          this.fetchBudgetData()
        }
      })

    } catch (e) {
      console.error('绑定婚礼失败', e)
      wx.hideLoading()
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' })
    }
  },

  // 头像点击
  onAvatarTap(e) {
    const { type } = e.currentTarget.dataset;
    if (type === 'self') {
      wx.navigateTo({
        url: '/pages/profile/index'
      });
    } else if (type === 'invite') {
      this.showInviteModal();
    }
  },

  showInviteModal() {
    this.setData({ showInviteModal: true });
  },

  hideInviteModal() {
    this.setData({ showInviteModal: false });
  },

  // 开启页面分享
  onShareAppMessage() {
    const { weddingId, memberAvatars } = this.data;
    const inviterName = memberAvatars.length > 0 ? memberAvatars[0].nickName : '我';
    
    // 分享后隐藏弹窗
    this.hideInviteModal();

    return {
      title: `「${inviterName}」邀请你共同管理我们的婚礼财务账本！`,
      path: `/pages/index/index?inviterWeddingId=${weddingId}`
    }
  }
})
