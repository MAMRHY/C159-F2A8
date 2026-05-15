const app = getApp();

Page({
  data: {
    date: '',
    location: '',
    budget: '',
    amountText: '', // 中文金额
    isEdit: false,
    recordId: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        isEdit: true,
        recordId: options.id,
        date: options.date || '',
        location: options.location || '',
        budget: options.budget && options.budget !== 'undefined' ? options.budget : '',
        amountText: options.budget && options.budget !== 'undefined' ? this.formatNumber(options.budget) : ''
      });
      wx.setNavigationBarTitle({ title: '编辑婚礼' });
    } else {
      wx.setNavigationBarTitle({ title: '创建婚礼' });
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onLocationInput(e) {
    this.setData({ location: e.detail.value });
  },

  onBudgetInput(e) {
    const val = e.detail.value;
    const amountText = this.formatNumber(val);
    this.setData({ budget: val, amountText });
  },

  async submitCreate() {
    const { date, location, budget } = this.data;
    if (!date) {
      wx.showToast({ title: '请选择婚礼日期', icon: 'none' });
      return;
    }
    if (!location) {
      wx.showToast({ title: '请输入婚礼地点', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中' });
    try {
      const db = wx.cloud.database();
      
      if (this.data.isEdit) {
        // 编辑模式：更新数据
        await db.collection('wedding_info').doc(this.data.recordId).update({
          data: {
            date,
            location,
            budget: budget ? Number(budget) : 0,
            updatedAt: db.serverDate()
          }
        });
        wx.hideLoading();
        wx.showToast({ title: '修改成功', icon: 'success' });
      } else {
        // 创建模式：新增数据，小程序端插入数据会自动带上当前用户的 _openid，不能手动指定
        await db.collection('wedding_info').add({
          data: {
            date,
            location,
            budget: budget ? Number(budget) : 0,
            createdAt: db.serverDate()
          }
        });
        wx.hideLoading();
        wx.showToast({ title: '创建成功', icon: 'success' });
        // 更新全局状态
        app.globalData.hasWedding = true;
      }

      setTimeout(() => {
        wx.navigateBack({ delta: 1 }).catch(() => {
          wx.reLaunch({ url: '/pages/index/index' });
        });
      }, 1500);

    } catch (e) {
      console.error(e);
      wx.hideLoading();
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  // 数字格式化：（千分位）
  formatNumber(num) {
    // 清空非数字字符
    const value = String(num).replace(/\D/g, '') || '';
    if (!value) return '';

    return Number(value).toLocaleString('zh-CN');
  }
})
