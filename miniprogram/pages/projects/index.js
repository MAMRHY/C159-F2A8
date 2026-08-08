const app = getApp()
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    windowWidth: 375,
    capsuleLeft: 375,
    activeTab: 0,       // 0=全部 1=全部付清 2=部分付清 3=未开始付款
    allProjects: [],    // 全量（含计算字段）
    projects: [],       // 当前 tab 展示
    slideViewWidth: 750,  // l-slide-view 宽度(rpx)
    showDeleteDialog: false,  // 删除确认弹窗
    deleteProjectId: '',      // 待删除的项目ID
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect()
    const navBarHeight = menuButtonInfo.bottom + menuButtonInfo.top - info.statusBarHeight
    // project-list 内部可用宽度：750 - padding(32*2=64rpx)
    const slideViewWidth = 750 - 64
    this.setData({
      statusBarHeight: info.statusBarHeight,
      navBarHeight: navBarHeight,
      windowWidth: info.windowWidth,
      capsuleLeft: menuButtonInfo.left,
      slideViewWidth,
    })
  },

  onShow() {
    this.fetchProjects()
  },

  async fetchProjects() {
    wx.showLoading({ title: '加载中' })
    try {
      const weddingId = app.globalData.weddingId
      console.log('weddingId', weddingId)
      if (!weddingId) {
        this.setData({ allProjects: [], projects: [] })
        return
      }

      // 1. 查询当前婚礼的项目
      const projectRes = await db.collection('projects')
        .where({ weddingId })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
      const rawProjects = projectRes.data

      if (rawProjects.length === 0) {
        this.setData({ allProjects: [], projects: [] })
        return
      }

      // 2. 一次性查出所有项目下的 expenses（固定 2 次请求，不再是 N+1）
      const projectIds = rawProjects.map(p => p._id)
      const expenseRes = await db.collection('expenses')
        .where({
          projectId: _.in(projectIds),
          weddingId
        })
        .get()

      // 3. 按 projectId 在 JS 端分组
      const expenseMap = {}
      expenseRes.data.forEach(expense => {
        if (!expenseMap[expense.projectId]) {
          expenseMap[expense.projectId] = []
        }
        expenseMap[expense.projectId].push(expense)
      })

      // 4. 为每个项目计算统计字段
      const allProjects = rawProjects.map(p => ({
        ...p,
        ...this.computeStats(expenseMap[p._id] || []),
      }))

      this.setData({ allProjects })
      this.filterProjects()
    } catch (e) {
      console.error('fetchProjects', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 根据项目下的 expenses 计算总金额和付款状态
   * @param {Array} expenses - 项目下的所有交易记录
   */
  computeStats(expenses) {
    // 无交易记录
    if (!expenses || expenses.length === 0) {
      return {
        totalAmount: '待定',
        statusText: '无需付款',
        statusClass: 'status-none',
      }
    }

    // 计算总金额：任意一条 amount 为 null/undefined 则为「待定」
    const hasInvalidAmount = expenses.some(
      item => item.amount === null || item.amount === undefined
    )
    let totalAmount
    if (hasInvalidAmount) {
      totalAmount = '待定'
    } else {
      const sum = expenses.reduce((acc, item) => acc + Number(item.amount), 0)
      totalAmount = sum.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    // 计算付款状态
    const paidCount = expenses.filter(item => item.paid).length
    const unpaidCount = expenses.length - paidCount
    let statusText, statusClass
    if (paidCount === expenses.length) {
      statusText = '全部付清'
      statusClass = 'status-paid'
    } else if (unpaidCount === expenses.length) {
      statusText = '未开始付款'
      statusClass = 'status-unpaid'
    } else {
      statusText = '部分付清'
      statusClass = 'status-partial'
    }

    return { totalAmount, statusText, statusClass }
  },

  /**
   * 根据 activeTab 过滤项目列表
   */
  filterProjects() {
    const { activeTab, allProjects } = this.data
    // tab 与 statusText 的映射
    const tabStatusMap = {
      1: '全部付清',
      2: '部分付清',
      3: '未开始付款',
    }
    const projects = activeTab === 0
      ? allProjects
      : allProjects.filter(p => p.statusText === tabStatusMap[activeTab])
    this.setData({ projects })
  },

  onTabChange(e) {
    const tab = Number(e.currentTarget.dataset.tab)
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    this.filterProjects()
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
  },

  // 点击删除按钮，弹出确认弹窗
  onDeleteProject(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      deleteProjectId: id,
      showDeleteDialog: true,
    })
  },

  // 确认删除项目
  async onConfirmDelete() {
    const { deleteProjectId } = this.data
    if (!deleteProjectId) return

    this.setData({ showDeleteDialog: false })
    wx.showLoading({ title: '删除中' })

    try {
      const weddingId = app.globalData.weddingId
      if (!weddingId) {
        throw new Error('当前没有婚礼')
      }

      const projectRes = await db.collection('projects').doc(deleteProjectId).get()
      if (!projectRes.data || projectRes.data.weddingId !== weddingId) {
        throw new Error('无权删除该项目')
      }

      // 1. 先删除该项目下当前婚礼的所有费用
      const expenseRes = await db.collection('expenses')
        .where({ projectId: deleteProjectId, weddingId })
        .get()

      // 逐条删除费用记录（小程序端不支持批量删除）
      const deletePromises = expenseRes.data.map(expense =>
        db.collection('expenses').doc(expense._id).remove()
      )
      await Promise.all(deletePromises)

      // 2. 删除项目本身
      await db.collection('projects').doc(deleteProjectId).remove()

      wx.showToast({ title: '删除成功', icon: 'success' })
      this.setData({ deleteProjectId: '' })
      this.fetchProjects()
    } catch (err) {
      console.error('onConfirmDelete', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 取消删除
  onCancelDelete() {
    this.setData({
      showDeleteDialog: false,
      deleteProjectId: '',
    })
  },
})
