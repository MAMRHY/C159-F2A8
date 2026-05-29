// pages/record-add/index.js
const db = wx.cloud.database()

Page({
  data: {
    editId: '', // 编辑模式时的记录 _id，为空则为新增模式
    pageTitle: '新增费用',
    showMore: false,
    paymentMethod: '',
    paymentDate: '',
    paymentOptions: ['微信', '支付宝', '银行卡转账', '现金'],
    projects: [], //关联项目列表
    filteredProjects: [],
    expensesTypes: [], // 费用类型
    filteredTypes: [],
    projectId: '',
    projectName: '',
    expenseTypeId: '',
    expenseTypeName: '',
    amount: '',
    paid: false,
    imageUrls: [],
    imageFileIDs: [],
    showProjectModal: false,
    showTypeModal: false,
    projectSearchKey: '',
    typeSearchKey: '',
    hasExactMatch: false,
  },

  onLoad(options) {
    const { id } = options
    if (id) {
      this.setData({ editId: id, pageTitle: '编辑费用' })
      wx.setNavigationBarTitle({ title: '编辑费用' })
    } else {
      wx.setNavigationBarTitle({ title: '新增费用' })
    }
    this.fetchProjects()
    this.fetchExpenseTypes()
    if (id) {
      this.fetchRecord(id)
    }
  },

  async fetchRecord(id) {
    wx.showLoading({ title: '加载中' })
    try {
      const res = await db.collection('expenses').doc(id).get()
      const record = res.data
      this.setData({
        projectId: record.projectId || '',
        projectName: record.projectName || '',
        expenseTypeId: record.expenseTypeId || '',
        expenseTypeName: record.expenseTypeName || '',
        amount: record.amount != null ? String(record.amount) : '',
        paid: !!record.paid,
        paymentMethod: record.paymentMethod || '',
        paymentDate: record.paymentDate || '',
        imageUrls: record.imageFileIDs || [],
        imageFileIDs: record.imageFileIDs || [],
        showMore: !!(record.paymentMethod || record.paymentDate),
      })
    } catch (e) {
      console.error('fetchRecord', e)
      wx.showToast({ title: '加载记录失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async fetchProjects() {
    try {
      const res = await db.collection('projects').field({ name: true }).get()
      this.setData({
        projects: res.data,
        filteredProjects: res.data,
      })
    } catch (e) {
      console.error('fetchProjects', e)
    }
  },

  async fetchExpenseTypes() {
    try {
      const res = await db.collection('expenses-type').get()
      this.setData({
        expensesTypes: res.data,
        filteredTypes: res.data,
      })
    } catch (e) {
      console.error('fetchExpenseTypes', e)
    }
  },

  toggleMoreDetails() {
    this.setData({ showMore: !this.data.showMore })
  },

  onPaymentMethodChange(e) {
    const index = e.detail.value
    this.setData({ paymentMethod: this.data.paymentOptions[index] })
  },

  onDateChange(e) {
    this.setData({ paymentDate: e.detail.value })
  },

  showProjectPicker() {
    this.setData({
      showProjectModal: true,
      projectSearchKey: '',
      filteredProjects: this.data.projects,
    })
  },

  hideProjectPicker() {
    this.setData({ showProjectModal: false })
  },

  showTypePicker() {
    this.setData({
      showTypeModal: true,
      typeSearchKey: '',
      filteredTypes: this.data.expensesTypes,
      hasExactMatch: false,
    })
  },

  hideTypePicker() {
    this.setData({ showTypeModal: false })
  },

  onSearchProjectInput(e) {
    const key = e.detail.value
    const filtered = this.data.projects.filter(item => item.name.includes(key))
    this.setData({
      projectSearchKey: key,
      filteredProjects: filtered,
    })
  },

  onSearchTypeInput(e) {
    const key = e.detail.value
    const filtered = this.data.expensesTypes.filter(item => item.name.includes(key))
    const hasExactMatch = this.data.expensesTypes.some(item => item.name === key)
    this.setData({
      typeSearchKey: key,
      filteredTypes: filtered,
      hasExactMatch,
    })
  },

  onSelectProject(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      projectId: item._id,
      projectName: item.name,
      showProjectModal: false,
    })
  },

  onSelectType(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      expenseTypeId: item._id,
      expenseTypeName: item.name,
      showTypeModal: false,
    })
  },

  async createNewType() {
    const newName = this.data.typeSearchKey.trim()
    if (!newName) {
      return wx.showToast({ title: '请输入费用类型名称', icon: 'none' })
    }

    wx.showLoading({ title: '创建中' })
    try {
      const res = await db.collection('expenses-type').add({
        data: {
          name: newName,
          createdAt: db.serverDate(),
        },
      })
      const newType = {
        _id: res._id,
        name: newName,
      }
      this.setData({
        expensesTypes: [...this.data.expensesTypes, newType],
        expenseTypeId: newType._id,
        expenseTypeName: newType.name,
        showTypeModal: false,
      })
      wx.showToast({ title: '创建成功', icon: 'success' })
    } catch (e) {
      console.error('createNewType', e)
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  onPaidStatusChange(e) {
    this.setData({ paid: e.detail.value })
  },

  async onImageAdd(e) {
    const newFiles = e.detail.current || []
    if (!newFiles.length) return

    wx.showLoading({ title: '上传中' })
    const uploadIds = []
    try {
      for (const filePath of newFiles) {
        const suffix = filePath.match(/\.\w+$/)?.[0] || '.jpg'
        const cloudPath = `expenses/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath,
        })
        uploadIds.push(uploadRes.fileID)
      }
      this.setData({
        imageUrls: newFiles,
        imageFileIDs: uploadIds,
      })
    } catch (e) {
      console.error('onImageAdd', e)
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onImageRemove(e) {
    const removeIndex = e.detail.index
    const imageUrls = this.data.imageUrls.filter((_, index) => index !== removeIndex)
    const imageFileIDs = this.data.imageFileIDs.filter((_, index) => index !== removeIndex)
    this.setData({ imageUrls, imageFileIDs })
  },

  async onSubmit() {
    const {
      editId,
      projectId,
      projectName,
      expenseTypeId,
      expenseTypeName,
      amount,
      paid,
      paymentMethod,
      paymentDate,
      imageFileIDs,
    } = this.data

    if (!projectId) {
      return wx.showToast({ title: '请选择关联项目', icon: 'none' })
    }
    if (!expenseTypeId) {
      return wx.showToast({ title: '请选择费用类型', icon: 'none' })
    }
    const trimmedAmount = (amount || '').trim()
    const parsedAmount = trimmedAmount ? parseFloat(trimmedAmount) : null


    wx.showLoading({ title: '保存中' })
    try {
      if (editId) {
        // 编辑模式：更新现有记录
        await db.collection('expenses').doc(editId).update({
          data: {
            projectId,
            projectName,
            expenseTypeId,
            expenseTypeName,
            amount: parsedAmount,
            paid,
            paymentMethod,
            paymentDate,
            imageFileIDs,
            updatedAt: db.serverDate(),
          },
        })
        wx.showToast({ title: '修改成功', icon: 'success' })
      } else {
        // 新增模式
        await db.collection('expenses').add({
          data: {
            projectId,
            projectName,
            expenseTypeId,
            expenseTypeName,
            amount: parsedAmount,
            paid,
            paymentMethod,
            paymentDate,
            imageFileIDs,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
          },
        })
        wx.showToast({ title: '保存成功', icon: 'success' })
      }
      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
    } catch (e) {
      console.error('onSubmit', e)
      wx.showToast({ title: editId ? '修改失败' : '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
})