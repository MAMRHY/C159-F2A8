const app = getApp()
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
    hasExactMatch: false,

    // 协同成员
    members: [],
    currentOpenid: ''
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
    this.fetchMembers()
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
      if (!data || data.weddingId !== app.globalData.weddingId) {
        throw new Error('无权访问该项目')
      }
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
    
    const weddingId = app.globalData.weddingId
    if (!weddingId) {
      wx.hideLoading()
      return wx.showToast({ title: '请先创建婚礼', icon: 'none' })
    }

    const projectData = {
      weddingId,
      name,
      typeId,
      typeName,
      leader,
      remark,
      updatedAt: db.serverDate()
    }

    try {
      if (isEdit) {
        const existing = await db.collection('projects').doc(projectId).get()
        if (!existing.data || existing.data.weddingId !== weddingId) {
          throw new Error('无权编辑该项目')
        }
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
  },

  // 获取婚礼账本成员以做负责人单选
  async fetchMembers() {
    try {
      const openid = app.globalData.openid || '';
      this.setData({ currentOpenid: openid });
      
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 1. 先查出当前婚礼
      const weddingRes = await db.collection('wedding_info').where(
        _.or([
          { _openid: openid },
          { partnerOpenid: openid }
        ])
      ).get();
      
      let membersOpenids = [openid]; // 默认至少有自己
      
      if (weddingRes.data.length > 0) {
        const wedding = weddingRes.data[0];
        membersOpenids = [wedding._openid];
        if (wedding.partnerOpenid) {
          membersOpenids.push(wedding.partnerOpenid);
        }
      }
      
      // 2. 查出这些 Openid 对应的 users 记录
      const usersRes = await db.collection('users').where({
        _openid: _.in(membersOpenids)
      }).get();
      
      let members = [];
      membersOpenids.forEach(mOpenid => {
        const user = usersRes.data.find(u => u._openid === mOpenid);
        if (user) {
          members.push({
            openid: mOpenid,
            avatarUrl: user.avatarUrl || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
            nickName: user.nickName || (mOpenid === openid ? '我' : '伴侣')
          });
        } else {
          members.push({
            openid: mOpenid,
            avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
            nickName: mOpenid === openid ? '我' : '伴侣'
          });
        }
      });
      
      this.setData({ members });
      
      // 3. 如果是新增模式且没有设置过 leader，默认勾选当前登录的这个人
      if (!this.data.isEdit && !this.data.leader) {
        const currentUser = members.find(m => m.openid === openid);
        if (currentUser) {
          this.setData({
            leader: currentUser.nickName
          });
        }
      }
      
    } catch (e) {
      console.error('获取成员失败', e);
    }
  },

  onSelectLeader(e) {
    const { name } = e.currentTarget.dataset;
    this.setData({
      leader: name
    });
  }
})
