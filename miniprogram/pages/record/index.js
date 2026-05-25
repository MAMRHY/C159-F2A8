const db = wx.cloud.database()

Page({
  data: {
    activeTab: 0,      // 0=全部 1=已付 2=未付
    allRecords: [],    // 全量数据
    records: [],       // 当前 tab 显示的过滤后数据
    totalAmount: '0.00',
    paidAmount: '0.00',
    unpaidAmount: '0.00',
  },

  onShow() {
    this.fetchRecords()
  },

  async fetchRecords() {
    wx.showLoading({ title: '加载中' })
    try {
      const res = await db.collection('expenses').orderBy('createdAt', 'desc').limit(100).get()
      const allRecords = res.data.map(item => {
        const createdAtStr = item.createdAt ? this.formatDate(item.createdAt) : ''
        return {
          ...item,
          amount: item.amount?.toFixed ? item.amount.toFixed(2) : (item.amount || 0).toFixed(2),
          createdAtStr,
        }
      })
      this.setData({ allRecords })
      this.filterRecords()
    } catch (e) {
      console.error('fetchRecords', e)
      wx.showToast({ title: '获取记录失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 根据当前 activeTab 过滤并重算汇总
  filterRecords() {
    const { activeTab, allRecords } = this.data

    let records
    if (activeTab === 0) {
      records = allRecords
    } else if (activeTab === 1) {
      records = allRecords.filter(item => item.paid)
    } else {
      records = allRecords.filter(item => !item.paid)
    }

    // 汇总数据始终基于全量计算
    const total = allRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const paid = allRecords.reduce((sum, item) => sum + (item.paid ? Number(item.amount || 0) : 0), 0)
    const unpaid = total - paid

    this.setData({
      records,
      totalAmount: total.toFixed(2),
      paidAmount: paid.toFixed(2),
      unpaidAmount: unpaid.toFixed(2),
    })
  },

  // 切换 tab
  onTabChange(e) {
    const tab = Number(e.currentTarget.dataset.tab)
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    this.filterRecords()
  },

  formatDate(date) {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  onAddRecord() {
    wx.navigateTo({
      url: '/pages/record-add/index'
    })
  },

  onEditRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/record-add/index?id=${id}`
    })
  }
})
