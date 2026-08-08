# 备婚记账 (WedLedger) 数据库设计

本文档记录了小程序使用的云开发数据库（NoSQL）集合结构。项目和费用表中的 `weddingId` 关联 `wedding_info._id`，用于按婚礼隔离数据。

## 1. 婚礼基本信息表 (`wedding_info`)
这一张表每个用户（或每对新人）只有一条记录，用于存储全局配置。

| 字段名 | 类型 | 示例 / 说明 |
| :--- | :--- | :--- |
| `_id` | String | (自动生成) 记录唯一标识 |
| `wedding_id` | String | 协作标识，用于多人同步数据 |
| `date` | String/Date | 如 "2026-10-04" |
| `total_budget` | Number | 如 100000 |
| `create_time` | Timestamp | 记录创建时间 |

## 2. 项目管理表 (`projects`)
存储婚礼的大项（如酒席、婚纱照等）。
> **注意**：总金额和付款状态建议不存储在这一张表，而是通过聚合查询 `expenses` 表实时计算得出，保证数据一致性。

| 字段名 | 类型 | 示例 / 说明 |
| :--- | :--- | :--- |
| `_id` | String | (自动生成) 记录唯一标识 |
| `weddingId` | String | 关联 `wedding_info._id`，用于按婚礼隔离项目数据 |
| `name` | String | 项目名称，如 "酒席-小天鹅洋湖" |
| `type` | String | 项目类型，如 "酒店"、"婚纱照"、"礼服" |
| `leader` | String | 负责人，如 "李惠权" |
| `remarks` | String | 备注信息 |
| `contract_images` | Array<String> | 存储合同照片的云存储 FileID 列表 |

## 3. 费用记录表 (`expenses`)
记录每一笔细分支出，与项目表是“多对一”关系。

| 字段名 | 类型 | 示例 / 说明 |
| :--- | :--- | :--- |
| `_id` | String | (自动生成) 记录唯一标识 |
| `weddingId` | String | 关联 `wedding_info._id`，用于按婚礼隔离费用数据 |
| `project_id` | String | 关联 `projects` 表的 `_id` |
| `expense_type` | String | 费用类型，如 "一次定金"、"尾款" |
| `amount` | Number/Null | 金额，允许为空/null（对应“待定”逻辑） |
| `status` | String/Boolean | 支付状态，如 "已支付"、"未支付" |
| `pay_time` | String/Date | 支付时间 |
| `pay_method` | String | 支付方式，如 "微信"、"现金" |
| `payer` | String | 支付人员 |
| `remarks` | String | 备注信息 |
| `voucher_images`| Array<String> | 存储支付凭证/收据照片的 FileID 列表 |

## 4. 协同成员表 (`members`)
用于实现邀请协同功能。

| 字段名 | 类型 | 示例 / 说明 |
| :--- | :--- | :--- |
| `_id` | String | (自动生成) 记录唯一标识 |
| `wedding_id` | String | 关联所属婚礼 |
| `openid` | String | 用户的微信唯一标识 |
| `nick_name` | String | 用户昵称 |
| `avatar_url` | String | 头像地址 |
| `role` | String | 角色，如 "admin" (管理员) 或 "editor" (编辑者) |
