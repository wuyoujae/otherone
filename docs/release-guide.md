# GitHub 提交与自动生成安装包说明

这个项目已经配置好了 GitHub Actions 自动打包桌面安装包。

发布机制是：

1. 先把代码提交并推送到 GitHub 的 `main` 分支。
2. 再创建一个形如 `v0.1.1` 的 Git tag 并推送到 GitHub。
3. GitHub Actions 会自动在 macOS、Windows、Linux 三个平台构建安装包。
4. 构建完成后，安装包会出现在 GitHub Releases 页面。

相关文件：

- GitHub 工作流：[.github/workflows/release.yml](/Users/wuyoujae/Desktop/Omnibuild/otherone-app/.github/workflows/release.yml)
- Electron 打包配置：[electron-builder.yml](/Users/wuyoujae/Desktop/Omnibuild/otherone-app/electron-builder.yml)
- 项目脚本：[package.json](/Users/wuyoujae/Desktop/Omnibuild/otherone-app/package.json)

## 一次完整发布怎么做

### 1. 先确认本地代码没问题

在项目根目录执行：

```bash
npm run build:desktop
```

这一步会完成：

- Next.js 生产构建
- Electron 主进程编译

如果这里失败，不要急着发版，先修复报错。

### 2. 提交代码到 GitHub

先看当前改动：

```bash
git status
```

把要提交的文件加入暂存区：

```bash
git add .
```

提交：

```bash
git commit -m "feat: your change"
```

推送到远程主分支：

```bash
git push origin main
```

### 3. 创建版本 tag

发布桌面安装包不是单纯靠 `git push origin main`，而是靠推送版本 tag 触发。

当前工作流监听的是：

```yml
push:
  tags:
    - 'v*'
```

所以 tag 必须长这样：

- `v0.1.1`
- `v0.2.0`
- `v1.0.0`

创建 tag：

```bash
git tag v0.1.1
```

推送 tag：

```bash
git push origin v0.1.1
```

也可以一次把本地所有 tag 推上去：

```bash
git push origin --tags
```

更推荐单独推当前 tag，避免把旧 tag 一起推上去。

### 4. 等待 GitHub 自动构建安装包

推送 tag 后，打开：

- GitHub 仓库的 `Actions` 页面
- 选择 `Build & Release Desktop`

这个工作流会自动在 3 个系统构建：

- macOS
- Windows
- Linux

构建成功后，安装包会被发布到仓库的 `Releases` 页面。

常见产物一般会包括：

- macOS: `.dmg`、`.zip`
- Windows: `.exe` 或 NSIS 安装包
- Linux: `.AppImage`

## 以后最常用的命令

如果你只是正常发一个新版本，通常按这个顺序执行就够了：

```bash
npm run build:desktop
git status
git add .
git commit -m "chore: release updates"
git push origin main
git tag v0.1.1
git push origin v0.1.1
```

## 版本号怎么定

建议 tag 和 [package.json](/Users/wuyoujae/Desktop/Omnibuild/otherone-app/package.json) 里的 `version` 保持一致。

例如：

- `package.json` 里是 `0.1.1`
- 那么 tag 也建议用 `v0.1.1`

如果你改了版本号，记得先提交，再打 tag。

## 如果自动打包失败，先检查这几个地方

### 1. GitHub Actions 是否报错

先看仓库 `Actions` 页面里的失败日志。

### 2. 工作流触发条件是否满足

只有推送 `v*` 格式的 tag 才会自动发布 Release。

### 3. 打包配置是否存在

这个项目使用的是 Electron Builder，配置文件是：

- [electron-builder.yml](/Users/wuyoujae/Desktop/Omnibuild/otherone-app/electron-builder.yml)

其中已经配置了发布目标：

- GitHub 仓库 `wuyoujae/otherone`

### 4. GitHub Token 权限是否正常

当前工作流使用 GitHub Actions 自带的 `GITHUB_TOKEN` 发布 Release，一般不需要额外再创建 `GH_TOKEN` secret。

如果仓库权限设置过严，需要确认 Actions 对仓库内容有写权限。

## 手动触发补充说明

现在工作流也支持在 GitHub 页面手动点击 `Run workflow`。

但真正用于“发布新版本安装包”的标准方式，仍然建议使用：

1. 推送代码到 `main`
2. 推送 `v*` 版本 tag

这样版本记录最清晰，也最不容易混乱。
