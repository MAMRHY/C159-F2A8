const db = wx.cloud.database()

Page({
  data: {
    isEdit: false,
    projectId: '',
    
    // Form data
    name: '',
    typeId: '',
    typeName: '',
    leader: '',
    remark: '',
    
    // Type Modal
    showTypeModal: false,
    typeSearchKey: '',
    types: [],
    filteredTypes: [],
    hasExactMatch: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        isEdit: true,
        projectId: options.id
      })
      this.fetchProjectDetail()
    }
    
    this.fetchTypes()
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [field]: e.detail.value
    })
  },

  async fetchProjectDetail() {
    wx.showLoading({ title: '加载中' })
    try {
      const res = await db.collection('projects').doc(this.data.projectId).get()
      const data = res.data
      this.setData({
        name: data.name,
        typeId: data.typeId,
        typeName: data.typeName,
        leader: data.leader,
        remark: data.remark || ''
      })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async fetchTypes() {
    try {
      const res = await db.collection('project-type').get()
      this.setData({
        types: res.data,
        filteredTypes: res.data
      })
    } catch (e) {
      console.error(e)
    }
  },

  showTypePicker() {
    this.setData({
      showTypeModal: true,
      typeSearchKey: '',
      filteredTypes: this.data.types,
      hasExactMatch: false
    })
  },

  hideTypePicker() {
    this.setData({
      showTypeModal: false
    })
  },

  onSearchTypeInput(e) {
    const key = e.detail.value
    const filtered = this.data.types.filter(t => t.name.includes(key))
    const hasExactMatch = this.data.types.some(t => t.name === key)
    
    this.setData({
      typeSearchKey: key,
      filteredTypes: filtered,
      hasExactMatch: hasExactMatch
    })
  },

  onSelectType(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      typeId: item._id,
      typeName: item.name,
      showTypeModal: false
    })
  },

  async createNewType() {
    const newName = this.data.typeSearchKey
    if (!newName) return
    wx.showLoading({ title: '创建中' })
    try {
      const res = await db.collection('project-type').add({
        data: {
          name: newName,
          createdAt: db.serverDate()
        }
      })
      const newType = {
        _id: res._id,
        name: newName
      }
      this.setData({
        types: [...this.data.types, newType],
        typeId: newType._id,
        typeName: newType.name,
        showTypeModal: false
      })
      wx.showToast({ title: '创建成功', icon: 'success' })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async onSubmit() {
    const { name, typeId, typeName, leader, remark, isEdit, projectId } = this.data
    
    if (!name) {
      return wx.showToast({ title: '请输入项目名称', icon: 'none' })
    }
    if (!typeId) {
      return wx.showToast({ title: '请选择项目类型', icon: 'none' })
    }
    if (!leader) {
      return wx.showToast({ title: '请输入负责人', icon: 'none' })
    }

    wx.showLoading({ title: '保存中' })
    
    const projectData = {
      name,
      typeId,
      typeName,
      leader,
      remark,
      updatedAt: db.serverDate()
    }

    try {
      if (isEdit) {
        await db.collection('projects').doc(projectId).update({
          data: projectData
        })
      } else {
        projectData.createdAt = db.serverDate()
        await db.collection('projects').add({
          data: projectData
        })
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
