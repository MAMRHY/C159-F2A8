const db = wx.cloud.database()

Page({
  data: {
    records: [],
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
      const records = res.data.map(item => {
        const createdAtStr = item.createdAt ? this.formatDate(item.createdAt) : ''
        return {
          ...item,
          amount: item.amount?.toFixed ? item.amount.toFixed(2) : (item.amount || 0).toFixed(2),
          createdAtStr,
        }
      })

      const total = records.reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const paid = records.reduce((sum, item) => sum + (item.paid ? Number(item.amount || 0) : 0), 0)
      const unpaid = total - paid

      this.setData({
        records,
        totalAmount: total.toFixed(2),
        paidAmount: paid.toFixed(2),
        unpaidAmount: unpaid.toFixed(2),
      })
    } catch (e) {
      console.error('fetchRecords', e)
      wx.showToast({ title: '获取记录失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
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
