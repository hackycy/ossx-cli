# ossx-cli

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

将本地构建产物一键上传到对象存储或服务器目录，用于前端/静态站点/资源文件自动化部署流程。

![rec.gif](https://github.com/user-attachments/assets/853d7d3d-5085-4038-b4bd-4e7ffc23a0bc)

## ✨ 特性

- 多 Provider：阿里云 OSS / 腾讯云 COS / SSH / 自定义函数（可扩展）
- 纯配置驱动：`ossx.config.{ts,js,json}` 自动加载（基于 c12）
- 支持 include / ignore (glob) 及函数过滤，灵活控制上传集合
- 失败可中断：`abortOnFailure` 控制遇错是否立即停止
- 上传完成可删除本地文件：`removeWhenUploaded`
- 详细日志：失败请求/响应头体、统计汇总、日志轮转 (`maxLogfiles`)
- 进度条 + 事件回调：`onStart / onProgress / onFinish` 二次扩展
- 自定义请求默认值：在 `onStart` 里 `setRequestDefault` 注入公共 Header
- TypeScript 友好：完整类型提示、`defineConfig` 辅助

## 🧩 支持平台

| 平台 | 状态 | 说明 |
|------|------|------|
| 阿里云 OSS | ✅ | 直传签名（HMAC-SHA1）PUT 上传 |
| 腾讯云 COS | ✅ | 临时签名（q-sign-*）PUT 上传 |
| SSH | ✅ | 基于 `ssh2` / `node-ssh` 直接传输文件 |
| 自定义 | ✅ | 提供 `upload(ctx)` 钩子自行实现 |
| 七牛云 | ⏳ | 规划中 |

> 错误日志默认输出至 `node_modules/.ossx`，可通过 `logDir` 配置。

## 📦 安装

```bash
pnpm add -D ossx-cli
# 或
npm i -D ossx-cli
# 或
yarn add -D ossx-cli
```

## 🚀 快速开始

1. 在项目根目录创建 `ossx.config.ts`
2. 运行 `npx ossx`（或加入 CI/CD 脚本）

```ts
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  provider: {
    name: 'aliyun-oss',
    accessKeyId: 'AKID',
    accessKeySecret: 'SECRET',
    bucket: 'your-bucket',
    region: 'oss-cn-hangzhou',
    secure: true,
  },
  target: 'dist', // 本地目录(相对 cwd)
  destination: 'archive', // 远程前缀目录，可为空
  ignoreFiles: ['*.zip'], // glob 忽略
})
```

执行：
```bash
npx ossx
```

## 🛠 CLI 命令

```bash
ossx [options]

Options:
  -e, --env <path>   指定配置文件所在目录(或绝对路径)
  --clean            清空日志目录 (logDir)
  -v, --version      查看版本
  -h, --help         帮助
```

示例：
```bash
ossx --clean
ossx -e ./env/prod
```

`--env` 既可传入：
1. 绝对路径（包含配置文件）
2. 相对路径（相对当前执行目录）

## ⚙️ 配置说明 (`OssOptions`)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| provider | `Provider` | 必填 | 上传提供方配置 (见下) |
| target | `string` | `dist` | 本地相对目录，扫描上传文件 |
| destination | `string` | - | 远程存储前缀；不要以 `/` 开头 |
| cwd | `string` | `process.cwd()` | 工作目录，用于解析 `target` |
| includeFiles | `string[]` | `['**/*']` | 仅包含的文件(glob) |
| ignoreFiles | `string[] | (file)=>boolean` | - | 忽略文件 (支持函数动态过滤) |
| removeWhenUploaded | `boolean` | `false` | 上传成功后删除本地文件 |
| abortOnFailure | `boolean` | `false` | 任一文件失败即中止整体流程 |
| logger | `boolean` | `true` | 是否启用日志记录 |
| logDir | `string` | `node_modules/.ossx` | 日志目录 (可相对 cwd) |
| maxLogfiles | `number` | - | 最多保留日志文件数 (超出自动清理) |
| retryTimes | `number` | - | 错误重试次数 |
| onStart | `(total,{setRequestDefault})` | - | 上传开始回调，可注入请求默认值 |
| onProgress | `(file,current,total,error?)` | - | 单文件完成回调，含错误 |
| onFinish | `(total,fail)` | - | 全部结束回调 |

### Provider 详解

#### 阿里云 `aliyun-oss`
| 字段 | 必填 | 说明 |
|------|------|------|
| accessKeyId | ✅ | AccessKey ID |
| accessKeySecret | ✅ | AccessKey Secret |
| bucket | ✅ | Bucket 名称 |
| region | ✅ | Region (用于拼接默认 endpoint) |
| endpoint | ❌ | 自定义域名 (默认 `${region}.aliyuncs.com`) |
| secure | ❌ | `true` 使用 https |

#### 腾讯云 `tencent-cloud-cos`
| 字段 | 必填 | 说明 |
|------|------|------|
| secretId | ✅ | SecretId |
| secretKey | ✅ | SecretKey |
| bucket | ✅ | `<name>-<APPID>` |
| region | ✅ | Region |
| endpoint | ❌ | 自定义域名 (默认 `cos.${region}.myqcloud.com`) |
| secure | ❌ | `true` 使用 https |

#### SSH `ssh`
| 字段 | 说明 |
|------|------|
| host / port / username / password | 对应 ssh 连接参数 |
| privateKeyPath / privateKey | 私钥路径或 Buffer |
| 其余字段 | 透传给 `node-ssh` |

#### 自定义 `custom`
```ts
defineConfig({
  provider: {
    name: 'custom',
    upload: async ({ file, request }) => {
      // file.localFilePath / file.remoteFilePath / file.mimeType ...
      // 使用 request.request({ method,url,data,headers }) 自行实现
    },
  },
  target: 'dist'
})
```

## 🔄 事件回调示例

```ts
export default defineConfig({
  provider: {/* ... */},
  onStart(total, { setRequestDefault }) {
    console.log('开始上传，共', total, '个文件')
    setRequestDefault({ timeout: 15000, headers: { 'X-From': 'ossx' } })
  },
  onProgress(file, current, total, err) {
    if (err)
      console.error('失败:', file.filename, err.message)
    else console.log(`[${current}/${total}]`, file.remoteFilePath)
  },
  onFinish(total, fail) {
    console.log('完成，总数:', total, '失败:', fail)
  }
})
```

## 💡 进阶用法

### 忽略函数
```ts
ignoreFiles: (file) => {
  if (file.filename.endsWith('.map'))
    return false // 不上传 sourcemap
}
```

### 条件中断
```ts
abortOnFailure: true // 任一文件失败即退出 (ExitCode=1)
```

### 上传后删除本地文件
```ts
removeWhenUploaded: true
```

### 限制日志文件数量
```ts
maxLogfiles: 10
```

### 多环境配置
```
project
 ├─ env/
 │   ├─ dev/ossx.config.ts
 │   └─ prod/ossx.config.ts
 └─ package.json
```
执行：
```bash
ossx -e ./env/dev
ossx -e ./env/prod
```

## ❓ FAQ

**Q: 上传失败如何排查?**
A: 查看 `logDir` 目录下最新 `.log` 文件，含请求/响应头与响应体；或加环境变量 `DEBUG=1` 查看堆栈。

**Q: `destination` 要以 `/` 开头吗?**
A: 不需要，内部会拼接为前缀；若使用 SSH 且你想放绝对路径，可以直接在 provider 里把 `destination` 写为绝对路径（已支持）。

**Q: 可以只上传部分文件吗?**
A: 使用 `includeFiles`/`ignoreFiles` (glob) 或提供函数版本的 `ignoreFiles`。

**Q: 如何自定义请求 Header?**
A: 在 `onStart` 中调用 `setRequestDefault({ headers: { ... } })`。

**Q: 日志会越来越多?**
A: 设置 `maxLogfiles`，超出数量自动清理最旧文件。

## 📝 License

[MIT](./LICENSE) License © [hackycy](https://github.com/hackycy)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/ossx-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/ossx-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/ossx-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/ossx-cli
[bundle-src]: https://img.shields.io/bundlephobia/minzip/ossx-cli?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=ossx-cli
[license-src]: https://img.shields.io/github/license/hackycy/ossx-cli.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/hackycy/ossx-cli/blob/main/LICENSE
