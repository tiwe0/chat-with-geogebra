/**
 * GeoGebra 命令验证器测试示例
 * 运行: node --loader tsx src/lib/__tests__/validator-examples.ts
 */

import { validateCommands, autoFixCommand, getCommandHelp } from '../geogebra-validator'

console.log('='.repeat(60))
console.log('GeoGebra 命令验证器测试示例')
console.log('='.repeat(60))

// 示例1: 基本验证
console.log('\n【示例1: 基本命令验证】')
const basicCommands = [
  'A=(1,2)',
  'B=(3,4)',
  'Line[A,B]',
]
const result1 = validateCommands(basicCommands)
console.log('验证结果:', result1.isValid ? '✓ 通过' : '✗ 失败')
console.log('问题数:', result1.issues.length)

// 示例2: 常见错误
console.log('\n【示例2: 常见错误检测】')
const errorCommands = [
  'A=1,2)',           // 中文括号
  'B=(3,4)',          // 中文逗号
  'C=(5 6)',          // 缺少逗号
  'f(x) = sin(x)',    // 函数定义格式
]
const result2 = validateCommands(errorCommands)
console.log('检测到的问题:')
result2.issues.forEach(issue => {
  console.log(`  行${issue.line}: [${issue.severity}] ${issue.message}`)
  if (issue.suggestion) {
    console.log(`    💡 ${issue.suggestion}`)
  }
})

// 示例3: 自动修复
console.log('\n【示例3: 自动修复】')
const buggyCommands = [
  'A=1,2)',
  'Circle[M,3',
  'f(x) = x^2',
]
console.log('原始命令:', buggyCommands)
const result3 = validateCommands(buggyCommands)
console.log('修复后命令:', result3.fixedCommands)

// 示例4: 单个命令修复
console.log('\n【示例4: 单个命令修复】')
const testCases = [
  'A=1,2)',
  'B=(3,4)',
  'Line[A B',
  'f(x) = sin(x)',
]
testCases.forEach(cmd => {
  const { fixed, changes } = autoFixCommand(cmd)
  if (changes.length > 0) {
    console.log(`原始: ${cmd}`)
    console.log(`修复: ${fixed}`)
    console.log(`变更: ${changes.join(', ')}`)
    console.log()
  }
})

// 示例5: 命令帮助
console.log('\n【示例5: 命令帮助】')
const commands = ['Point', 'Line', 'Circle', 'Rotate']
commands.forEach(cmd => {
  console.log(`${cmd}: ${getCommandHelp(cmd)}`)
})

// 示例6: 复杂场景
console.log('\n【示例6: 复杂场景验证】')
const complexCommands = [
  'O=(0,0)',
  'A=(1,0)',
  'circle=Circle[O,1]',
  'B=Rotate[A,90°,O]',
  'C=Rotate[B,90°,O]',
  'D=Rotate[C,90°,O]',
  'square=Polygon[A,B,C,D]',
  'f(x)=sin(x)',
  'g(x)=cos(x)',
]
const result6 = validateCommands(complexCommands)
console.log('命令数:', complexCommands.length)
console.log('验证结果:', result6.isValid ? '✓ 全部通过' : '✗ 有问题')
if (result6.issues.length > 0) {
  console.log('问题列表:')
  result6.issues.forEach(issue => {
    console.log(`  行${issue.line}: ${issue.message}`)
  })
}

// 示例7: 严重程度统计
console.log('\n【示例7: 严重程度统计】')
const mixedCommands = [
  'A=1,2)',           // error
  'B=(3,4)',          // error
  'f(x) = sin(x)',    // warning
  'Line[A,B]',        // ok
]
const result7 = validateCommands(mixedCommands)
const errorCount = result7.issues.filter(i => i.severity === 'error').length
const warningCount = result7.issues.filter(i => i.severity === 'warning').length
const infoCount = result7.issues.filter(i => i.severity === 'info').length

console.log(`错误: ${errorCount}`)
console.log(`警告: ${warningCount}`)
console.log(`提示: ${infoCount}`)
console.log(`总计: ${result7.issues.length}`)

console.log('\n' + '='.repeat(60))
console.log('测试完成!')
console.log('='.repeat(60))
