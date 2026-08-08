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
    if (app.globalData.loginPromise) {
      app.globalData.loginPromise.then(res => {
        if (app.globalData.hasWedding) {
          this.fetchBudgetData();
        } else {
          wx.reLaunch({ url: '/pages/splash/index' });
        }
      }).catch(err => {
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
    } else {
      if (app.globalData.hasWedding) {
        this.fetchBudgetData();
      } else {
        wx.reLaunch({ url: '/pages/splash/index' });
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
        app.globalData.weddingId = weddingId;
        
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

      // 获取当前婚礼支出
      const MAX_LIMIT = 100;
      if (!weddingId) {
        throw new Error('当前没有婚礼');
      }
      const expenseQuery = db.collection('expenses').where({ weddingId });
      const countResult = await expenseQuery.count();
      const total = countResult.total;
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      const tasks = [];
      for (let i = 0; i < batchTimes; i++) {
        const promise = db.collection('expenses')
          .where({ weddingId })
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get();
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
      path: `/pages/splash/index?inviterWeddingId=${weddingId}`
    }
  }
})
