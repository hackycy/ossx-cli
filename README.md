# ossx-cli

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

指定文件夹上传至对象存储服务，可用于日常部署前端代码自动化脚本

![rec.gif](https://github.com/user-attachments/assets/853d7d3d-5085-4038-b4bd-4e7ffc23a0bc)

## 支持平台

<div align="center">

| 🌐 平台 | 📊 支持状态 |
|:-------:|:----------:|
| 阿里云 | ✅ 已支持 |
| 腾讯云 | ✅ 已支持 |
| SSH | ✅ 已支持 |
| 七牛云 | ⏳ 计划支持 |
| 自定义 | ✅ 已支持 |

</div>

> 上传支持错误日志查看，默认输出至node_modules/.ossx目录下

## 安装

``` bash
pnpm add -D ossx-cli
```

## 使用

运行:

``` bash
pnpm ossx
```

### 配置

创建`ossx.config.[jt]s`文件:

``` typescript
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  provider: {
    name: 'aliyun-oss',
    // ...不同OSS剩余配置请查看types
  },
  // cwd: process.cwd(),
  // 本地要上传的目录，相对于cwd，只允许相对路径
  target: 'dist',
  // OSS目录，会将所有文件上传至该目录，可不填，但不要以/开头
  destination: 'archive',
  // 忽略上传的文件，支持glob
  ignoreFiles: ['*.zip']
})
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
