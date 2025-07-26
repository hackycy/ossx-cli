# ossx-cli

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

指定文件夹上传至对象存储服务，可用于日常部署前端代码自动化脚本

![rec.gif](https://github.com/user-attachments/assets/853d7d3d-5085-4038-b4bd-4e7ffc23a0bc)

| 平台 | 阿里云 | 腾讯云 | 七牛云 | 自定义 |
| ------ | :---: | :---: | :------: | :------: |
| 是否支持 | ✅ | ✅ | 计划支持 | ✅ |

> 上传支持错误日志查看，默认输出至node_modules/.ossx目录下

## 安装

``` bash
pnpm add -D ossx-cli
```

## 使用

运行:

``` bash
npx ossx
```

### 配置

创建`ossx.config.[jt]s`文件:

``` typescript
import { defineConfig } from 'ossx-cli'

export default defineConfig({
  provider: {
    name: 'aliyun-oss',
    // ...
  },
  target: 'dist',
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
