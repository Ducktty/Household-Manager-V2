# 家当管家 v1 · 演示版

> 手机 App:拍一下产品包装就能识别并加入家里的库存,系统会提前告诉你什么时候该补货、买多少最划算。

---

## 这是什么

一个**纯前端**的家当管理演示 App,实现 SPEC v1.7 的 11 个屏幕。**没有真实 AI 识别**(用 Web Share 跳转 Gemini),数据存浏览器 `localStorage`,刷新不丢。

**最新更新(v1.2)**:
- ✅ Web Share API:拍图后调起手机系统分享面板,直接分享到 Gemini App
- ✅ 自动剪贴板检测:从 Gemini 切回 App,自动读剪贴板
- ✅ 产品合并:编辑时撞同款,弹确认合并(数量+历史合并)
- ✅ 修复长按误触 + 保存后跳首页防重复
- ✅ 购买历史管理页 + 单条编辑/删除

---

## 🚀 如何部署(就一步:Vercel)

### 前置:有 GitHub 账号

没有的话先去 <https://github.com> 注册一个。

### 步骤 1:把项目推到 GitHub

在项目目录里跑(需要先装 [Git for Windows](https://git-scm.com/download/win)):

```powershell
cd D:\jiadang-app-v1

# 如果这是新项目
git init
git add .
git commit -m "init: 家当管家 v1.2"

# 去 GitHub 创建一个新仓库(空仓库,不要勾 Add README)
# 例如:https://github.com/你的用户名/jiadang-app-v1
# 然后跑:
git remote add origin https://github.com/你的用户名/jiadang-app-v1.git
git branch -M main
git push -u origin main
```

> 第一次 push 会让你输 GitHub 账号密码,现在 GitHub 强制用 **Personal Access Token**(PAT)当密码,去 <https://github.com/settings/tokens> 生成一个(选 `repo` 权限就够)。

### 步骤 2:在 Vercel 导入并部署

1. 去 <https://vercel.com> → 用 GitHub 账号登录
2. 第一次会让你**授权 Vercel 访问你的 GitHub**,点 Authorize
3. 进 Dashboard → 点 **"Add New → Project"**
4. 在 **"Import Git Repository"** 列表里,找到 `jiadang-app-v1`,点 **Import**
5. 不用改任何配置(Project Name / Framework Preset / Root Directory 都自动检测)
6. 点 **Deploy**
7. 30 秒后,给你一个链接:
   ```
   https://jiadang-app-v1-你的用户名.vercel.app
   ```
8. **手机浏览器开这个链接** ✅ 完成

### 步骤 3:改代码后重新部署

在项目目录里:

```powershell
git add .
git commit -m "更新说明"
git push
```

Vercel **自动检测** push,30 秒后新版本生效(同一个链接)。

### 部署到自己的域名(可选)

Vercel Dashboard → Project → Settings → Domains → 输入你的域名,按提示加 DNS 记录。

---

## 📄 核心流程(怎么用)

### A. 主流程(拍照 → Gemini → 自动入库)

```
1. 首页 → 点"📷 拍一下,添加产品"
2. 拍照页 → 点大圆,拍产品包装
3. 弹底部抽屉 → 点"✨ 跳转 Gemini 识别"
4. ⭐ 手机弹出系统分享面板 → 选 Gemini App
5. 在 Gemini 里粘贴 prompt + 发送图片
6. Gemini 回答产品名 → 长按复制 → 切回本 App
7. ⭐ App 自动检测剪贴板 → 跳到粘贴页(产品名已填)
8. 填数量+价格 → 点"下一步"
9. 没同款 → 跳手动输入页补全 → 保存 → 回首页
```

### B. 简化流程(手动输入)

1. 首页 → 点"不想拍?手动输入产品"
2. 输产品名 → 已有同款会显示候选卡
3. **点候选** → 切换到"加进现有库存"模式,只填数量+价格
4. 或者填完整信息保存

### C. 批量购买计算

1. 详情页 → 点"算一下批量买划不划算"
2. 改 4 个数字 → 点"算一下划算吗"
3. 看 3 种颜色结论(🟢 划算 / 🟡 一般 / 🔴 不建议)
4. 点"加入采购清单"

### D. 采购清单

- 首页右上 🛒 图标进清单
- 列表里移除单项 / 一键清空

### E. 长按操作菜单

- 任意产品卡 → **长按 0.7 秒** → 弹底部菜单(编辑/删除/取消)
- v1.2 修复了之前"点不进"的 bug(700ms 阈值 + 移动手指立即取消)

### F. 购买历史编辑(新)

- 详情页历史行 → **点任一行** → 弹编辑框(改日期/数量/价格/删除)
- 详情页 → 右上 **"📋 管理全部"** → 全列表页
- 全列表页 → 点任一行 → 也能编辑/删除

### G. 产品合并(新)

- 详情页 → 编辑产品 → 改名为已有同款 → 保存
- 弹"已有同款产品"确认 → 确认 → 数量+历史合并,删另一个产品

---

## 🧪 自测清单

部署到 Vercel 后,在手机浏览器开链接,按下面点一遍:

### 基础

- [ ] 看到"你好" + 3 个默认产品
- [ ] 第一个产品(伊利纯牛奶)显示"注意"黄色标签
- [ ] 右上角 🛒 购物车图标

### 拍照 + Web Share(⭐ 核心)

- [ ] 点"📷 拍一下" → 调起手机相机
- [ ] 拍完图 → 弹底部抽屉
- [ ] 选"跳转 Gemini" → ⭐ **手机弹系统分享面板**(微信/QQ/Gemini 等应用)
- [ ] 选 Gemini → 图 + prompt 都发过去
- [ ] 切回本 App → ⭐ **自动跳粘贴页,产品名已填**

### 手动输入

- [ ] 首页 → "不想拍?手动输入产品"
- [ ] 输"牛奶" → 出现"家里有同款"绿色候选卡
- [ ] 点候选 → 标题变"加进现有库存",只显示数量+价格
- [ ] 改数量 + 价格 → 点保存 → ⭐ **自动回首页 + toast"已加入库存"**

### 详情页

- [ ] 点 +/- → 显示"● 未保存"
- [ ] 点"保存" → toast
- [ ] **回首页后,数量已更新**
- [ ] **点产品卡(轻点 300ms)能正常进详情,不会误触长按菜单** ← v1.2 修复

### 历史编辑(新)

- [ ] 详情页 → 点任一历史行 → 弹编辑框
- [ ] 改价格 → 保存 → 列表里价格更新
- [ ] 再次点同一行 → 删除 → 该条消失
- [ ] 详情页 → 右上"📋 管理全部" → 全列表页
- [ ] 全列表里能编辑/删除每一条

### 产品合并(新)

- [ ] 进"可口可乐"详情 → 编辑 → 改名为"伊利纯牛奶 1L" → 保存
- [ ] 弹"已有同款产品" → 确认
- [ ] 数量 = 原 1 + 6 = 7
- [ ] 历史 = 原 4 + 2 = 6 条
- [ ] 首页只剩 2 个产品(伊利纯牛奶 + 蓝月亮)

### 计算器

- [ ] 改 4 个数字 → 算一下 → 3 种颜色都试一遍

### 采购清单

- [ ] ROI → "加入采购清单" → 跳清单页
- [ ] 首页 🛒 badge 显示数字
- [ ] 清单里能移除 / 清空

### 持久化

- [ ] 任何操作后关浏览器再开 → 数据还在

---

## 🐞 调试入口(浏览器控制台)

```js
__jd.reset()    // 清空所有数据,刷新
__jd.seed()     // 同 reset
__jd.state()    // 看当前 PRODUCTS / CART
```

---

## 📁 文件结构

```
jiadang-app-v1/
├── index.html      42K  11 个屏幕
├── styles.css      30K  清爽设计 + 手机适配
├── app.js          58K  业务逻辑 + localStorage + Web Share + 合并
├── favicon.ico
├── README.md
└── test-artifacts/    (可选)自动化测试 + 截图
```

---

## 🛠 技术栈

- 纯 HTML + CSS + JavaScript,无框架
- `localStorage` 持久化
- `Web Share API`(系统分享) + `Clipboard API`
- Vercel 静态托管(自动 HTTPS)

---

## 🚧 已知限制(V1 范围外)

- 真实相机调用:`<input type="file" capture="environment">`,真机 HTTPS 下能调原生相机
- 真实 Gemini API 没接(避免引入 API key),用 Web Share 跳转
- 剪贴板自动读:用 `visibilitychange` 触发,iOS 部分版本需用户在剪贴板弹窗里点"允许"
- 多货币 / 自定义图标:留到 V2

---

## 📜 更新日志

- **v1.2** — Web Share API + 产品合并 + 历史管理页 + 修复长按误触 + 保存后跳首页
- **v1.1** — 修复 2 个 bug(自动输入表单、采购清单页)
- **v1.0** — 最小可用原型(4 屏 + 假数据)
