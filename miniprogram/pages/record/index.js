const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    activeTab: 0,      // 0=全部 1=已付 2=未付
    allRecords: [],    // 全量数据
    records: [],       // 当前 tab 展示
    groupedRecords: [], // 按项目分组后的数据
    totalAmount: '0.00',
    paidAmount: '0.00',
    unpaidAmount: '0.00',
    slideViewWidth: 750,  // l-slide-view 宽度(rpx)
    slideWidth: 160, // 删除按钮宽度(rpx)
    // 删除确认弹窗控制
    showDeleteDialog: false,
    deleteRecordId: '',
    deleteRecordInfo: ''
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    // project-list 内部可用宽度：750 - padding(35*2=70rpx)
    const slideViewWidth = 750 - 200
    const slideWidth = 260 // 与右侧删除按钮宽度保持一致
    this.setData({ slideViewWidth, slideWidth })
  },

  onShow() {
    this.fetchRecords()
  },

  async fetchRecords() {
    wx.showLoading({ title: '加载中' })
    try {
      const res = await db.collection('expenses')
        .where({ _openid: app.globalData.openid })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
      // 规定大于0的数字是有效金额，小于0的数字为待定金额，保存的时候不允许输入小于0的金额，用于区分状态
      const allRecords = res.data.map(item => {
        const createdAtStr = item.createdAt ? this.formatDate(item.createdAt) : ''
        return {
          ...item,
          amount: item.amount >= 0 ? item.amount : -1,
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

    // 汇总数据基于全量计算，排除非数值金额（如 "待定"）
    const total = allRecords.reduce((sum, item) => {
      const amt = item.amount >= 0 ? item.amount : 0;
      return sum + amt
    }, 0)
    const paid = allRecords.reduce((sum, item) => {
      const amt = item.paid ? item.amount : 0;
      return sum + (item.paid ? amt : 0)
    }, 0)
    const unpaid = total - paid

    // 按项目分组
    const groupedMap = {}
    records.forEach(item => {
      const projName = item.projectName || '未知项目'
      if (!groupedMap[projName]) {
        groupedMap[projName] = {
          projectName: projName,
          records: [],
          totalAmount: 0,
          hasPendingAmount: false,
          count: 0
        }
      }
      groupedMap[projName].records.push(item)
      groupedMap[projName].count++
      if (item.amount >= 0 && item.amount !== null) {
        groupedMap[projName].totalAmount += item.amount
      } else {
        groupedMap[projName].hasPendingAmount = true
      }
    })

    const groupedRecords = Object.values(groupedMap).map(group => {
      return {
        ...group,
        totalAmount: group.hasPendingAmount ? '待定' : group.totalAmount.toFixed(2)
      }
    })

    this.setData({
      records,
      groupedRecords,
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
  },

  // 长按触发删除，弹出确认弹窗
  onDeleteRecord(e) {
    const id = e.currentTarget.dataset.id
    const project = e.currentTarget.dataset.project || ''
    const type = e.currentTarget.dataset.type || ''
    const info = `${project} - ${type}`
    this.setData({
      deleteRecordId: id,
      deleteRecordInfo: info,
      showDeleteDialog: true,
    })
  },

  // 确认删除费用记录
  async onConfirmDeleteRecord() {
    const { deleteRecordId } = this.data
    if (!deleteRecordId) return
    this.setData({ showDeleteDialog: false })
    wx.showLoading({ title: '删除中' })
    try {
      await db.collection('expenses').doc(deleteRecordId).remove()
      wx.showToast({ title: '删除成功', icon: 'success' })
      this.fetchRecords()
    } catch (err) {
      console.error('onConfirmDeleteRecord', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 取消删除
  onCancelDeleteRecord() {
    this.setData({
      showDeleteDialog: false,
      deleteRecordId: '',
      deleteRecordInfo: ''
    })
  },
})
