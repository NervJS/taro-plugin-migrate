import * as path from 'path'
import { createLogSymbols, DEFAULT_Component_SET } from './utils'

export default (ctx) => {
  ctx.registerCommand({
    name: 'migrate',
    fn () {
      const { appPath, configPath, sourcePath } = ctx.paths
      const { fs, chalk, resolveScriptPath } = ctx.helper
      const { cliVersion } = ctx.runOpts

      const pkgPath = path.join(appPath, 'package.json')
      if (!fs.existsSync(pkgPath)) {
        console.log(chalk.red('当前目录下不存在 package.json 文件，请检查！'))
        return
      }

      const migrateToVersion = cliVersion.split('.')[0]
      const logSymbols = createLogSymbols()

      console.log(`开始迁移到 Taro ${migrateToVersion}...`)
      console.log()
      // migrate config
      const initialConfig = ctx.initialConfig
      console.log(chalk.underline(`[1] 处理配置，位置： ${path.dirname(configPath)}`))
      if (initialConfig.weapp) {
        console.log(`${chalk.yellow(`${logSymbols.warning} 配置中存在 weapp，Taro 2 开始已废弃而改为 mini，请按照文档 https://nervjs.github.io/taro/docs/config-detail/#mini 进行调整`)}`)
        if (initialConfig.weapp.module) {
          console.log(`${chalk.yellow(`${logSymbols.warning} 同时 weapp 配置中，module 配置已废弃，module 下的配置如 postcss 直接挂载在 mini 下，请按照文档 https://nervjs.github.io/taro/docs/config-detail/#mini 进行调整`)}`)
        }
      }
      if (initialConfig.h5 && initialConfig.h5.module) {
        console.log(`${chalk.yellow(`${logSymbols.warning} h5 配置中，module 配置已废弃，module 下的配置如 postcss 直接挂载在 h5 下，请按照文档 https://nervjs.github.io/taro/docs/config-detail/#h5 进行调整`)}`)
      }
      if (migrateToVersion === '3') {
        if (initialConfig.framework) {
          console.log(`${chalk.yellow(`${logSymbols.warning} 当前转换到 Taro 3 后将默认使用 Nerv 框架，请在配置文件 ${configPath} 中添加 framework: nerv 配置`)}`)
        }
        // 处理 babel 配置
        const ejs = require('ejs')
        console.log()
        console.log(chalk.underline(`[2] 生成 babel 配置文件 babel.config.js`))
        if (initialConfig.babel) {
          console.log(`${chalk.yellow(`${logSymbols.warning} config 中 babel 配置已废弃，可以移除！`)}`)
        }
        const babelConfigTemplate = ejs.render(fs.readFileSync(path.resolve(__dirname, '..', 'src/babelconfig.ejs')).toString(), {
          framework: 'nerv',
          typescript: fs.existsSync(path.join(appPath, 'tsconfig.json'))
        })
        fs.writeFileSync(path.join(appPath, 'babel.config.js'), babelConfigTemplate)
        console.log(`${chalk.green(`${logSymbols.success} 成功生成 babel 配置文件 babel.config.js`)}`)
        console.log()
        console.log(chalk.underline(`[3] 调整 App、页面、组件的 config 配置`))
        const entryPath = resolveScriptPath(path.join(sourcePath, 'app'))
        if (!fs.existsSync(entryPath)) {
          console.log(chalk.red('项目入口文件不存在，请检查！'))
          return
        }
        const entryResult = parseEntry(ctx, entryPath)
        const entryConfig = entryResult.configObj
        const appPages = entryConfig.pages.map(item => resolveScriptPath(path.join(sourcePath, item)))
        const subpackages = entryConfig.subPackages || entryConfig['subpackages']
        if (subpackages && subpackages.length) {
          subpackages.forEach(item => {
            if (item.pages && item.pages.length) {
              const root = item.root
              item.pages.forEach(page => {
                let pageItem = `${root}/${page}`
                pageItem = pageItem.replace(/\/{2,}/g, '/')
                let hasPageIn = false
                entryConfig.pages.forEach(name => {
                  if (name === pageItem) {
                    hasPageIn = true
                  }
                })
                if (!hasPageIn) {
                  const pagePath = resolveScriptPath(path.join(sourcePath, pageItem))
                  appPages.push(pagePath)
                }
              })
            }
          })
        }
        appPages.forEach(pagePath => {
          if (fs.existsSync(pagePath)) {
            parsePage(ctx, pagePath)
          }
        })
        console.log()
        console.log(`${chalk.green(`${logSymbols.success} Taro 3 文件变化迁移完成，但具体的代码未做修改，请参照迁移指南 https://nervjs.github.io/taro/docs/next/migration 对代码进行调整。`)}`)
      }
    }
  })
}

function createAst (code) {
  const parser = require('@babel/parser')
  return parser.parse(code, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'typescript',
      'asyncGenerators',
      'bigInt',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'decorators-legacy',
      'doExpressions',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'functionBind',
      'functionSent',
      'importMeta',
      'logicalAssignment',
      'nullishCoalescingOperator',
      'numericSeparator',
      'objectRestSpread',
      'optionalCatchBinding',
      'optionalChaining',
      'partialApplication',
      'throwExpressions',
      'topLevelAwait'
    ]
  })
}

function parseAst (ast) {
  const traverse = require('@babel/traverse').default
  const t = require('@babel/types')
  const { traverseObjectNode } = require('./utils')
  let configObj
  let exportDefaultName
  const importDefaultNames = new Map()
  const importNames = new Map()
  const customComponents = new Map()
  traverse(ast, {
    ClassProperty (astPath) {
      const node = astPath.node
      const keyName = node.key.name
      if (keyName === 'config') {
        configObj = traverseObjectNode(node)
      }
    },
    ImportDeclaration (astPath) {
      const node = astPath.node
      const source = node.source
      let value = source.value
      const specifiers = node.specifiers
      specifiers.forEach(item => {
        if (item.type === 'ImportDefaultSpecifier') {
          importDefaultNames.set(item.local.name, value)
        } else {
          importNames.set(item.local.name, value)
        }
      })
    },
    ExportDefaultDeclaration (astPath) {
      const node = astPath.node
      const declaration = node.declaration
      exportDefaultName = declaration.id ? declaration.id.name : declaration.name
    },
    AssignmentExpression (astPath) {
      const node = astPath.node
      const left = node.left
      if (t.isMemberExpression(left) && t.isIdentifier(left.object)) {
        if (left.object.name === exportDefaultName
            && t.isIdentifier(left.property)
            && left.property.name === 'config') {
          configObj = traverseObjectNode(node.right)
        }
      }
    },
    JSXOpeningElement (astPath) {
      const node = astPath.node
      if (node.name.type === 'JSXIdentifier') {
        const tagName = node.name.name
        importDefaultNames.forEach((v, k) => {
          if (tagName === k && !DEFAULT_Component_SET.has(k)) {
            customComponents.set(k, v)
          }
        })
        importNames.forEach((v, k) => {
          if (tagName === k && !DEFAULT_Component_SET.has(k)) {
            customComponents.set(k, v)
          }
        })
      }
    }
  })
  if (!configObj) {
    configObj = {}
  }
  return {
    configObj,
    ast,
    customComponents
  }
}

function parseEntry (ctx, entryPath) {
  const { fs, chalk, normalizePath } = ctx.helper
  const { sourcePath } = ctx.paths
  const entryCode = fs.readFileSync(entryPath).toString()
  const ast = createAst(entryCode)
  const { configObj } = parseAst(ast)
  const logSymbols = createLogSymbols()
  // 写入 entry config file
  const entryConfigPath = entryPath.replace(path.extname(entryPath), '.config.js')
  fs.writeFileSync(entryConfigPath, `export default ${JSON.stringify(configObj, null, 2)}`)
  console.log(`${chalk.green(`${logSymbols.success} 成功生成入口配置文件 ${normalizePath(entryConfigPath.replace(sourcePath, ''))}`)}`)
  return {
    configObj
  }
}

function parsePage (ctx, pagePath) {
  const { fs, chalk, normalizePath, resolveScriptPath, isEmptyObject } = ctx.helper
  const { sourcePath } = ctx.paths
  const pageCode = fs.readFileSync(pagePath).toString()
  const ast = createAst(pageCode)
  const { configObj, customComponents } = parseAst(ast)
  const logSymbols = createLogSymbols()
  if (customComponents.size) {
    customComponents.forEach((componentPath, componentName) => {
      const componentRealPath = resolveScriptPath(path.resolve(pagePath, '..', componentPath))
      const usingComponents = configObj.usingComponents || {}
      parseComponent(ctx, componentRealPath, pagePath, usingComponents)
      if (!isEmptyObject(usingComponents)) {
        configObj.usingComponents = usingComponents
      }
    })
  }
  // 写入 page config file
  const pageConfigPath = pagePath.replace(path.extname(pagePath), '.config.js')
  fs.writeFileSync(pageConfigPath, `export default ${JSON.stringify(configObj, null, 2)}`)
  console.log(`${chalk.green(`${logSymbols.success} 成功生成入口配置文件 ${normalizePath(pageConfigPath.replace(sourcePath, ''))}`)}`)
  return {
    configObj
  }
}

function parseComponent (ctx, componentPath, pagePath, usingComponents) {
  const { fs, resolveScriptPath, promoteRelativePath } = ctx.helper
  const pageCode = fs.readFileSync(componentPath).toString()
  const ast = createAst(pageCode)
  const { configObj = {}, customComponents } = parseAst(ast)
  if (configObj.usingComponents) {
    Object.keys(configObj.usingComponents).forEach(key => {
      const fPath = resolveScriptPath(componentPath, '..', configObj.usingComponents[key])
      usingComponents[key] = promoteRelativePath(path.relative(pagePath, fPath).replace(path.extname(fPath), ''))
    })
  }
  if (customComponents.size) {
    customComponents.forEach(cPath => {
      const componentRealPath = resolveScriptPath(path.resolve(componentPath, '..', cPath))
      parseComponent(ctx, componentRealPath, pagePath, usingComponents)
    })
  }
}
