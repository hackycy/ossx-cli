# ossx-cli

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

![Feb-06-2026 20-58-49](https://github.com/user-attachments/assets/68f905f2-5cfb-4004-b088-2cc9c8bd0186)

将本地构建产物一键上传到对象存储或服务器目录，用于前端/静态站点/资源文件自动化部署流程。

| 平台 | 状态 | 说明 |
|------|------|------|
| 阿里云 OSS | ✅ | 直传签名（HMAC-SHA1）PUT 上传 |
| 腾讯云 COS | ✅ | 临时签名（q-sign-*）PUT 上传 |
| 七牛云 | ⏳ | 规划中 |
| SSH | ✅ | 基于 `ssh2` / `node-ssh` 直接传输文件 |
| FTP | ✅ | 基于 `basic-ftp` 传输文件 |
| 自定义 | ✅ | 提供 `upload(ctx)` 钩子自行实现 |

## 安装

``` bash
pnpm add -D ossx-cli
```

## 配置

默认读取项目根目录的 `ossx.config.*`（支持 ts/js/json）。

示例配置：

```ts
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  provider: {
    name: 'aliyun-oss',
    endpoint: 'oss-cn-shenzhen.aliyuncs.com',
    accessKeyId: 'xxxxxxx',
    accessKeySecret: 'xxxxxxx',
    bucket: 'bucket-xxx',
  },
  target: 'dist',
  ignoreFiles: ['*.zip', 'index.html'],
  destination: 'remote-path',
  maxLogfiles: 1,
})
```

FTP 配置示例：

```ts
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  provider: {
    name: 'ftp',
    host: 'ftp.example.com',
    port: 21,
    username: 'your-username',
    password: 'your-password',
    secure: false, // 或 true 启用 FTPS
  },
  target: 'dist',
  destination: '/remote/path',
})
```

### 多 Provider 选择

配置多个具名 provider，但不配置 `pipeline` 时，CLI 会保持交互选择模式：

``` ts
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  providers: [
    {
      tag: 'config1',
      destination: 'remote-path-1',
      provider: {
        name: 'aliyun-oss',
        endpoint: 'oss-cn-shenzhen.aliyuncs.com',
        accessKeyId: 'xxxxxxx',
        accessKeySecret: 'xxxxxxx',
        bucket: 'bucket-xxx',
      }
    },
    {
      tag: 'config2',
      destination: 'remote-path-2',
      provider: {
        name: 'aliyun-oss',
        endpoint: 'oss-cn-shenzhen.aliyuncs.com',
        accessKeyId: 'xxxxxxx',
        accessKeySecret: 'xxxxxxx',
        bucket: 'bucket-xxx',
      }
    }
  ],
  target: 'dist',
  ignoreFiles: ['*.zip', 'index.html'],
  maxLogfiles: 1,
})
```

CI 环境下可配置 `OSSX_CI_PROVIDER_TAG` 环境变量选择默认 provider。

### 流水线

通过 `pipeline` 按 tag 指定执行顺序。步骤之间严格串行；每个步骤内部仍然按照自己的 `maxWorkers` 并发上传文件。

```ts
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  target: 'dist',
  retryTimes: 3,
  maxWorkers: 8,
  providers: [
    {
      tag: 'oss',
      destination: 'web/assets',
      provider: {
        name: 'aliyun-oss',
        endpoint: 'oss-cn-shenzhen.aliyuncs.com',
        accessKeyId: 'xxxxxxx',
        accessKeySecret: 'xxxxxxx',
        bucket: 'bucket-xxx',
      },
    },
    {
      tag: 'server',
      destination: '/var/www/app',
      maxWorkers: 2,
      provider: {
        name: 'ssh',
        host: 'example.com',
        username: 'deploy',
        password: 'xxxxxxx',
      },
    },
  ],
  pipeline: ['oss', 'server'],
})
```

配置合并优先级为：默认选项 `<` 顶层选项 `<` provider 条目选项。provider 条目可以单独覆盖 `target`、`destination`、文件过滤、重试、worker 数量和备份等上传选项。

流水线行为：

- 当前步骤完全结束后，下一步骤才会开始。
- 任一步骤存在上传失败时，流水线停止，CLI 返回非零退出码。
- `abortOnFailure: false` 会先完成当前步骤的剩余文件；设为 `true` 时会终止当前步骤的其他 worker。
- `removeWhenUploaded` 会延迟到整条流水线成功后执行，避免前序步骤删除后续步骤需要的源文件。
- 本地文件删除失败不会改变已经完成的上传结果，CLI 会输出未删除文件警告并记录到流水线汇总。
- 流水线模式不会显示 provider 选择提示，`OSSX_CI_PROVIDER_TAG` 只用于非流水线的选择模式。

`pipeline` 中的 tag 必须存在且 provider tag 不能重复。需要使用同一账户上传到不同目录时，可以定义两个不同 tag。

## 使用

运行命令

```bash
npx ossx
```

指定配置文件：

```bash
npx ossx -c ./ossx.config.ts
```

## 测试

```bash
# 流水线顺序、失败阻断和延迟删除
pnpm test

# 启动 Docker SSH/SFTP 与 FTP 服务并执行真实流水线上传
pnpm test:integration
```

Docker 集成测试使用本机端口 `2222`、`2121` 和被动 FTP 端口 `21100-21110`。

## License

[MIT](./LICENSE) License © [hackycy](https://github.com/hackycy)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/ossx-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/ossx-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/ossx-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/ossx-cli
[license-src]: https://img.shields.io/github/license/hackycy/ossx-cli.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/hackycy/ossx-cli/blob/main/LICENSE
