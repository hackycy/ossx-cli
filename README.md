# ossx-cli

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

![Feb-06-2026 20-58-49](https://github.com/user-attachments/assets/68f905f2-5cfb-4004-b088-2cc9c8bd0186)

将本地构建产物一键上传到对象存储或服务器目录，用于前端/静态站点/资源文件自动化部署流程。

| 平台 | 状态 | 说明 |
|------|------|------|
| 阿里云 OSS | ✅ | 直传签名（HMAC-SHA1）PUT 上传 |
| 腾讯云 COS | ✅ | 临时签名（q-sign-*）PUT 上传 |
| 七牛云 | ⏳ | 规划中 |
| SSH | ✅ | 基于 `ssh2` / `node-ssh` 直接传输文件 |
| FTP | ⏳ | 规划中 |
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

支持多provider

``` ts
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  providers: [
    {
      tag: 'config1',
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
  destination: 'remote-path',
  maxLogfiles: 1,
})
```

> CI环境下可配置`OSSX_CI_PROVIDER_TAG`环境变量用于设置默认provider

## 使用

运行命令

```bash
npx ossx
```

指定配置文件：

```bash
npx ossx -c ./ossx.config.ts
```

## License

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
