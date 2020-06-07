# @tarojs/plugin-migrate

> 快速升级迁移插件

## 安装

在 Taro 项目根目录下安装

```bash
$ npm i @tarojs/plugin-migrate --save
```

## 使用

请确保 Taro CLI 已升级至 Taro 2/3 的最新版本。

修改项目 `config/index.js` 中的 `plugins` 配置为如下

```js
const config = {
  ...
  plugins: [
    ...其余插件

    '@tarojs/plugin-migrate'
  ]
  ...
}
```

随后执行命令

```bash
$ taro migrate
```

即会开始进行代码迁移转换，迁移的目标版本会根据 CLI 的 major 版本来确定。

## 功能

* [x] Taro 2/3：对编译配置进行识别，并给予提示
* [x] Taro 3：生成 babel.config.js 文件
* [x] Taro 3：生成 App 和页面的配置文件 *.config.js
* [ ] Taro 3：对代码进行调整
