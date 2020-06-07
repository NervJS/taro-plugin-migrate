export function createLogSymbols () {
  const isSupported = process.platform !== 'win32' || process.env.CI || process.env.TERM === 'xterm-256color'
  const main = {
    info: 'ℹ',
    success: '✔',
    warning: '⚠',
    error: '✖'
  }

  const fallbacks = {
    info: 'i',
    success: '√',
    warning: '‼',
    error: '×'
  }

  return isSupported ? main : fallbacks
}

export function traverseObjectNode (node) {
  const t = require('@babel/types')
  if (node.type === 'ClassProperty' || node.type === 'ObjectProperty') {
    const properties = node.value.properties
    const obj = {}
    properties.forEach(p => {
      let key = t.isIdentifier(p.key) ? p.key.name : p.key.value
      obj[key] = traverseObjectNode(p.value)
    })
    return obj
  }
  if (node.type === 'ObjectExpression') {
    const properties = node.properties
    const obj= {}
    properties.forEach(p => {
      let key = t.isIdentifier(p.key) ? p.key.name : p.key.value
      obj[key] = traverseObjectNode(p.value)
    })
    return obj
  }
  if (node.type === 'ArrayExpression') {
    return node.elements.map(item => traverseObjectNode(item))
  }
  if (node.type === 'NullLiteral') {
    return null
  }
  return node.value
}

export const DEFAULT_Component_SET = new Set<string>([
  'View',
  'ScrollView',
  'Swiper',
  'CoverView',
  'CoverImage',
  'Icon',
  'Text',
  'RichText',
  'Progress',
  'Button',
  'Checkbox',
  'Form',
  'Input',
  'Label',
  'Picker',
  'PickerView',
  'PickerViewColumn',
  'Radio',
  'RadioGroup',
  'CheckboxGroup',
  'Slider',
  'Switch',
  'Textarea',
  'Navigator',
  'Audio',
  'Image',
  'Video',
  'Camera',
  'LivePlayer',
  'LivePusher',
  'Map',
  'Canvas',
  'OpenData',
  'WebView',
  'SwiperItem',
  'MovableArea',
  'MovableView',
  'FunctionalPageNavigator',
  'Ad',
  'Block',
  'Import',
  'OfficialAccount',
  'Template',
  'Editor'
])
