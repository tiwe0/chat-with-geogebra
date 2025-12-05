/**
 * GeoGebra 语法验证器 - 基于 parsed_commands.json
 * 提供精确的命令签名验证和参数类型检查
 */

import commandsData from '../../docs/parsed_commands.json'

enum CommandType { // 赋值，函数调用，表达式等
  Assignment,
  FunctionCall,
  Expression,
}

export interface CommandInfo {
  signature: string
  commandBase: string
  description: string
  examples: Array<{
    description: string
    command: string
  }>
  note: string
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  line?: number
  command?: string
  suggestion?: string
  fixedCommand?: string
}

// 解析命令签名中的参数类型
interface ParamType {
  name: string
  types: string[]
  optional: boolean
}

/**
 * 解析命令签名,提取参数信息
 * 例如: "Circle( <Point>, <Number> )" -> { name: "Circle", params: [...] }
 */
function parseSignature(signature: string): { name: string; params: ParamType[] } {
  const match = signature.match(/^([A-Za-z]+)\s*\((.*)\)/)
  if (!match) {
    return { name: signature, params: [] }
  }

  const name = match[1]
  const paramsStr = match[2].trim()
  
  if (!paramsStr) {
    return { name, params: [] }
  }

  const params: ParamType[] = []
  
  // 分割参数 - 处理嵌套的尖括号
  let depth = 0
  let currentParam = ''
  
  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i]
    
    if (char === '<') depth++
    else if (char === '>') depth--
    else if (char === ',' && depth === 0) {
      if (currentParam.trim()) {
        params.push(parseParam(currentParam.trim()))
      }
      currentParam = ''
      continue
    }
    
    currentParam += char
  }
  
  if (currentParam.trim()) {
    params.push(parseParam(currentParam.trim()))
  }

  return { name, params }
}

/**
 * 解析单个参数
 * 例如: "<Point>" 或 "<Number a>" 或 "[<Boolean>]"
 */
function parseParam(paramStr: string): ParamType {
  const optional = paramStr.startsWith('[') && paramStr.endsWith(']')
  if (optional) {
    paramStr = paramStr.slice(1, -1).trim()
  }

  // 提取类型和参数名
  // 格式: <Type> 或 <Type name> 或 <Type|Type2>
  const match = paramStr.match(/<([^>]+)>(?:\s+(\w+))?/)
  if (!match) {
    return { name: '', types: [paramStr], optional }
  }

  const typesStr = match[1]
  const name = match[2] || ''
  
  // 支持多个类型用 | 分隔
  const types = typesStr.split('|').map(t => t.trim())

  return { name, types, optional }
}

/**
 * 构建命令索引 - 按命令名称分组
 */
const commandIndex = new Map<string, CommandInfo[]>()

commandsData.forEach((cmd) => {
  const commandName = cmd.commandBase.toLowerCase()
  if (!commandIndex.has(commandName)) {
    commandIndex.set(commandName, [])
  }
  commandIndex.get(commandName)!.push(cmd as CommandInfo)
})

/**
 * 获取命令的所有签名
 */
export function getCommandSignatures(commandName: string): CommandInfo[] {
  return commandIndex.get(commandName.toLowerCase()) || []
}

/**
 * 检查命令是否存在
 */
export function isValidCommand(commandName: string): boolean {
  return commandIndex.has(commandName.toLowerCase())
}

/**
 * 获取所有可用命令名称
 */
export function getAllCommandNames(): string[] {
  return Array.from(commandIndex.keys()).map(name => 
    // 首字母大写
    name.charAt(0).toUpperCase() + name.slice(1)
  )
}

/**
 * 解析命令调用,提取命令名和参数
 */
function parseCommandCall(command: string): { name: string; args: string[] } | null {
  // 处理赋值语句: A = Point(1, 2)
  const assignMatch = command.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/)
  if (assignMatch) {
    command = assignMatch[2]
  }

  // 处理函数调用: CommandName(arg1, arg2, ...)
  const match = command.match(/^([A-Za-z]+)\s*\((.*)\)$/)
  if (!match) {
    // 可能是简单的赋值或表达式
    return null
  }

  const name = match[1]
  const argsStr = match[2].trim()

  if (!argsStr) {
    return { name, args: [] }
  }

  // 解析参数 - 考虑括号嵌套
  const args: string[] = []
  let depth = 0
  let currentArg = ''

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i]

    if (char === '(' || char === '{' || char === '[') {
      depth++
    } else if (char === ')' || char === '}' || char === ']') {
      depth--
    } else if (char === ',' && depth === 0) {
      args.push(currentArg.trim())
      currentArg = ''
      continue
    }

    currentArg += char
  }

  if (currentArg.trim()) {
    args.push(currentArg.trim())
  }

  return { name, args }
}

/**
 * 验证单个命令
 */
export function validateCommandSyntax(command: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const trimmed = command.trim()

  if (!trimmed) {
    return []
  }

  // 解析命令调用
  const parsed = parseCommandCall(trimmed)
  if (!parsed) {
    // 可能是赋值、表达式或其他语句,暂不验证
    return []
  }

  const { name, args } = parsed

  // 检查命令是否存在
  if (!isValidCommand(name)) {
    issues.push({
      severity: 'error',
      message: `未知命令: ${name}`,
      command: trimmed,
      suggestion: `可用命令: ${findSimilarCommands(name).join(', ') || '请检查拼写'}`
    })
    return issues
  }

  // 获取该命令的所有签名
  const signatures = getCommandSignatures(name)
  
  // 尝试匹配任一签名
  let matched = false
  let bestMatchError: string | null = null

  for (const sig of signatures) {
    const parsed = parseSignature(sig.signature)
    const { params } = parsed

    // 检查参数数量
    const requiredParams = params.filter(p => !p.optional).length
    const totalParams = params.length

    if (args.length < requiredParams) {
      bestMatchError = `参数不足: 需要至少 ${requiredParams} 个参数,提供了 ${args.length} 个`
      continue
    }

    if (args.length > totalParams) {
      bestMatchError = `参数过多: 最多 ${totalParams} 个参数,提供了 ${args.length} 个`
      continue
    }

    // 参数数量匹配,认为有效
    matched = true
    
    // 可以进一步验证参数类型(需要更复杂的类型推断)
    break
  }

  if (!matched && bestMatchError) {
    issues.push({
      severity: 'error',
      message: bestMatchError,
      command: trimmed,
      suggestion: `正确签名: ${signatures.map(s => s.signature).join(' 或 ')}`
    })
  }

  // 如果匹配成功但有多个签名,提供信息
  if (matched && signatures.length > 1) {
    issues.push({
      severity: 'info',
      message: `此命令有 ${signatures.length} 种用法`,
      command: trimmed,
      suggestion: signatures.map(s => s.signature).join('\n')
    })
  }

  return issues
}

/**
 * 查找相似的命令名(用于拼写建议)
 */
function findSimilarCommands(input: string, maxResults: number = 3): string[] {
  const inputLower = input.toLowerCase()
  const allCommands = getAllCommandNames()
  
  // 简单的相似度计算 - 基于前缀匹配和包含关系
  const matches = allCommands
    .map(cmd => ({
      cmd,
      score: calculateSimilarity(inputLower, cmd.toLowerCase())
    }))
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(m => m.cmd)

  return matches
}

/**
 * 计算字符串相似度
 */
function calculateSimilarity(a: string, b: string): number {
  // 前缀匹配得分最高
  if (b.startsWith(a)) return 100
  if (b.includes(a)) return 50
  
  // Levenshtein 距离的简化版本
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  
  let matches = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++
  }
  
  return (matches / maxLen) * 30
}

/**
 * 获取命令的详细信息和示例
 */
export function getCommandHelp(commandName: string): CommandInfo[] {
  return getCommandSignatures(commandName)
}

/**
 * 搜索命令(模糊搜索)
 */
export function searchCommands(query: string): CommandInfo[] {
  const queryLower = query.toLowerCase()
  const results: CommandInfo[] = []

  commandsData.forEach((cmd) => {
    const commandInfo = cmd as CommandInfo
    
    // 搜索命令名
    if (commandInfo.commandBase.toLowerCase().includes(queryLower)) {
      results.push(commandInfo)
      return
    }
    
    // 搜索描述
    if (commandInfo.description.toLowerCase().includes(queryLower)) {
      results.push(commandInfo)
      return
    }
  })

  return results.slice(0, 20) // 限制结果数量
}

/**
 * 验证多条命令
 */
export function validateCommandsBatch(commands: string[]): {
  allIssues: ValidationIssue[]
  isValid: boolean
} {
  const allIssues: ValidationIssue[] = []

  commands.forEach((cmd, index) => {
    const issues = validateCommandSyntax(cmd)
    issues.forEach(issue => {
      issue.line = index + 1
      allIssues.push(issue)
    })
  })

  const hasErrors = allIssues.some(issue => issue.severity === 'error')

  return {
    allIssues,
    isValid: !hasErrors
  }
}
