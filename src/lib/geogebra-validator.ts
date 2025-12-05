/**
 * GeoGebra 命令验证器
 * 用于检测 AI 生成的 GeoGebra 命令中的语法错误并提供修复建议
 * 集成基于 parsed_commands.json 的精确语法验证
 */

import { validateCommandSyntax as syntaxValidate, isValidCommand } from './geogebra-syntax-validator'

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  command?: string;
  suggestion?: string;
  fixedCommand?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  fixedCommands?: string[];
}

/**
 * GeoGebra 命令验证规则
 */
const VALIDATION_RULES = {
  // 常见的对象类型
  objectTypes: ['Point', 'Line', 'Circle', 'Segment', 'Vector', 'Polygon', 'Function', 'Curve'],
  
  // 常见的命令
  commonCommands: [
    'Point', 'Line', 'Circle', 'Segment', 'Vector', 'Polygon',
    'Midpoint', 'Intersect', 'Perpendicular', 'Parallel',
    'Tangent', 'Angle', 'Distance', 'Area', 'Length',
    'Rotate', 'Translate', 'Reflect', 'Dilate',
    'Sequence', 'If', 'Execute', 'SetValue', 'Delete'
  ],
  
  // 坐标格式
  coordinatePattern: /\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/g,
  
  // 变量命名规则 (A-Z, a-z, 可带下标数字)
  variablePattern: /^[A-Za-z][A-Za-z0-9_]*$/,
  
  // 函数定义格式
  functionPattern: /^[a-z]\(x\)\s*=\s*.+$/,
};

/**
 * 常见错误模式及修复建议
 */
const ERROR_PATTERNS = [
  {
    // 中文括号（全角括号）
    pattern: /[（）]/g,
    message: '使用了中文括号',
    fix: (cmd: string) => cmd.replace(/（/g, '(').replace(/）/g, ')'),
    severity: 'error' as const,
  },
  {
    // 中文逗号（全角逗号）
    pattern: /，/g,
    message: '使用了中文逗号',
    fix: (cmd: string) => cmd.replace(/，/g, ','),
    severity: 'error' as const,
  },
  {
    // 坐标缺少逗号
    pattern: /\((-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/g,
    message: '坐标之间缺少逗号',
    fix: (cmd: string) => cmd.replace(/\((-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/g, '($1,$2)'),
    severity: 'error' as const,
  },
  {
    // 等号前后不当空格 (f(x) = sin(x) 应该是 f(x)=sin(x))
    pattern: /([a-z])\s*\(\s*x\s*\)\s*=\s*/g,
    message: '函数定义格式建议: f(x)=expression',
    fix: (cmd: string) => cmd.replace(/([a-z])\s*\(\s*x\s*\)\s*=\s*/g, '$1(x)='),
    severity: 'warning' as const,
  },
  {
    // 对象名包含空格
    pattern: /^([A-Z][a-z]*\s+[A-Z])/,
    message: '对象名不能包含空格',
    fix: (cmd: string) => cmd.replace(/\s+/g, ''),
    severity: 'error' as const,
  },
  {
    // 赋值语句缺少等号
    pattern: /^([A-Z][A-Za-z0-9]*)\s*\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)$/,
    message: '点定义需要使用等号: A=(x,y)',
    fix: (cmd: string) => cmd.replace(/^([A-Z][A-Za-z0-9]*)\s*/, '$1='),
    severity: 'error' as const,
  },
  {
    // 缺少对象引用
    pattern: /^(Line|Circle|Segment|Perpendicular|Parallel|Tangent)\s*\(\s*\)$/,
    message: '命令缺少必要的参数',
    fix: null,
    severity: 'error' as const,
  },
  {
    // 数字格式错误 (多个小数点)
    pattern: /\d+\.\d+\.\d+/,
    message: '数字格式错误(包含多个小数点)',
    fix: null,
    severity: 'error' as const,
  },
  {
    // 未闭合的括号
    pattern: /^[^()]*\([^)]*$/,
    message: '括号未正确闭合',
    fix: (cmd: string) => {
      const openCount = (cmd.match(/\(/g) || []).length;
      const closeCount = (cmd.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        return cmd + ')'.repeat(openCount - closeCount);
      }
      return cmd;
    },
    severity: 'error' as const,
  },
]

/**
 * 后处理检查（在基本模式检查后执行，避免误报）
 * 暂时移除非ASCII字符检查，因为GeoGebra支持Unicode数学符号
 */
const POST_VALIDATION_CHECKS: Array<{
  name: string;
  check: (cmd: string, existingIssues: ValidationIssue[]) => ValidationIssue | null;
}> = []

/**
];

/**
 * 语法特定检查
 */
const SYNTAX_CHECKS = [
  {
    name: '点定义检查',
    check: (cmd: string): ValidationIssue | null => {
      // A=(1,2) 格式
      const pointMatch = cmd.match(/^([A-Z][A-Za-z0-9]*)\s*=\s*\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)$/);
      if (pointMatch) {
        const [, name, x, y] = pointMatch;
        if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
          return {
            severity: 'error',
            message: `点名称 "${name}" 格式不正确,应以大写字母开头`,
            command: cmd,
            suggestion: '使用大写字母开头的名称,如: A=(1,2), Point1=(3,4)',
          };
        }
        return null;
      }
      
      // Point(x, y) 格式
      const pointCmdMatch = cmd.match(/^([A-Z][A-Za-z0-9]*)\s*=\s*Point\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/);
      if (pointCmdMatch) {
        return {
          severity: 'warning',
          message: '建议使用简化格式定义点',
          command: cmd,
          suggestion: `${pointCmdMatch[1]}=(${pointCmdMatch[2]},${pointCmdMatch[3]})`,
          fixedCommand: `${pointCmdMatch[1]}=(${pointCmdMatch[2]},${pointCmdMatch[3]})`,
        };
      }
      
      return null;
    },
  },
  {
    name: '函数定义检查',
    check: (cmd: string): ValidationIssue | null => {
      const funcMatch = cmd.match(/^([a-z][a-z0-9]*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
      if (funcMatch) {
        const [, name, expr] = funcMatch;
        
        // 检查表达式中是否包含无效字符
        if (/[^a-zA-Z0-9+\-*/^().,\s]/.test(expr)) {
          return {
            severity: 'warning',
            message: `函数表达式可能包含无效字符`,
            command: cmd,
            suggestion: '确保只使用数学运算符和函数名(sin, cos, tan, sqrt, abs等)',
          };
        }
        
        return null;
      }
      return null;
    },
  },
  {
    name: '命令参数检查',
    check: (cmd: string): ValidationIssue | null => {
      // Line[A, B] 格式
      const lineMatch = cmd.match(/^([A-Z][A-Za-z0-9]*)\s*=\s*Line\s*\[\s*([A-Z][A-Za-z0-9]*)\s*,\s*([A-Z][A-Za-z0-9]*)\s*\]$/);
      if (lineMatch) {
        const [, lineName, point1, point2] = lineMatch;
        if (point1 === point2) {
          return {
            severity: 'error',
            message: '直线需要两个不同的点',
            command: cmd,
            suggestion: `使用两个不同的点: Line[A, B]`,
          };
        }
        return null;
      }
      return null;
    },
  },
  {
    name: '对象引用检查',
    check: (cmd: string): ValidationIssue | null => {
      // 检查是否引用了未定义的对象 (这个需要上下文,目前只做基本检查)
      const refMatch = cmd.match(/\b([A-Z][A-Za-z0-9]*)\b/g);
      if (refMatch && refMatch.length > 1) {
        // 基本格式检查
        return null;
      }
      return null;
    },
  },
];

/**
 * 验证单个命令
 */
export function validateCommand(command: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let trimmedCmd = command.trim();
  
  // 过滤注释：移除 # 或 // 及其后的所有内容
  const hashIndex = trimmedCmd.indexOf('#');
  const slashIndex = trimmedCmd.indexOf('//');
  
  let commentIndex = -1;
  if (hashIndex !== -1 && slashIndex !== -1) {
    commentIndex = Math.min(hashIndex, slashIndex);
  } else if (hashIndex !== -1) {
    commentIndex = hashIndex;
  } else if (slashIndex !== -1) {
    commentIndex = slashIndex;
  }
  
  if (commentIndex !== -1) {
    trimmedCmd = trimmedCmd.substring(0, commentIndex).trim();
  }
  
  // 如果注释后为空，直接返回空数组（不报错）
  if (!trimmedCmd) {
    return [];
  }
  
  // 1. 首先执行基于 parsed_commands.json 的精确语法验证
  try {
    const syntaxIssues = syntaxValidate(trimmedCmd);
    if (syntaxIssues.length > 0) {
      issues.push(...syntaxIssues);
      // 如果有严重错误，可能不需要继续检查格式问题
      const hasError = syntaxIssues.some(i => i.severity === 'error');
      if (hasError) {
        return issues;
      }
    }
  } catch (error) {
    // 语法验证器出错，继续使用原有验证
    console.warn('[Validator] Syntax validator error:', error);
  }
  
  // 2. 检查常见错误模式（避免重复检测）
  const detectedPatterns = new Set<string>();
  
  for (const errorPattern of ERROR_PATTERNS) {
    // 重置正则表达式的lastIndex（对于全局正则很重要）
    errorPattern.pattern.lastIndex = 0;
    
    if (errorPattern.pattern.test(trimmedCmd)) {
      // 避免同类错误重复报告
      const patternKey = errorPattern.message;
      if (detectedPatterns.has(patternKey)) {
        continue;
      }
      detectedPatterns.add(patternKey);
      
      const issue: ValidationIssue = {
        severity: errorPattern.severity,
        message: errorPattern.message,
        command: trimmedCmd,
      };
      
      if (errorPattern.fix) {
        const fixed = errorPattern.fix(trimmedCmd);
        // 只有修复后确实有变化才添加建议
        if (fixed !== trimmedCmd) {
          issue.fixedCommand = fixed;
          issue.suggestion = `建议修改为: ${fixed}`;
          issues.push(issue);
        }
      } else {
        issue.suggestion = '请检查命令格式';
        issues.push(issue);
      }
    }
  }
  
  // 3. 执行语法特定检查
  for (const syntaxCheck of SYNTAX_CHECKS) {
    const issue = syntaxCheck.check(trimmedCmd);
    if (issue) {
      issues.push(issue);
    }
  }
  
  // 4. 后处理检查（避免误报）
  for (const postCheck of POST_VALIDATION_CHECKS) {
    const issue = postCheck.check(trimmedCmd, issues);
    if (issue) {
      issues.push(issue);
    }
  }
  
  return issues;
}

/**
 * 验证多个命令
 */
export function validateCommands(commands: string[]): ValidationResult {
  const allIssues: ValidationIssue[] = [];
  const fixedCommands: string[] = [];
  
  commands.forEach((cmd, index) => {
    // 过滤空行和纯注释行（# 或 //）
    const trimmed = cmd.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      return; // 跳过此行，不添加到 fixedCommands
    }
    
    const issues = validateCommand(cmd);
    
    // 添加行号信息
    issues.forEach(issue => {
      issue.line = index + 1;
      allIssues.push(issue);
    });
    
    // 尝试自动修复
    const errorIssue = issues.find(i => i.severity === 'error' && i.fixedCommand);
    if (errorIssue?.fixedCommand) {
      fixedCommands.push(errorIssue.fixedCommand);
    } else {
      // 只有非注释行才添加到 fixedCommands
      fixedCommands.push(cmd);
    }
  });
  
  const hasErrors = allIssues.some(issue => issue.severity === 'error');
  
  return {
    isValid: !hasErrors,
    issues: allIssues,
    fixedCommands: allIssues.length > 0 ? fixedCommands : undefined,
  };
}

/**
 * 从文本中提取 GeoGebra 命令并验证
 */
export function extractAndValidateCommands(text: string): ValidationResult {
  const commands: string[] = [];
  
  // 提取代码块中的命令
  const codeBlockRegex = /```geogebra\s*\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const blockContent = match[1].trim();
    const lines = blockContent.split('\n')
      .map(line => line.trim())
      .filter(line => {
        // 过滤空行和以 # 或 // 开头的注释行
        return line && !line.startsWith('#') && !line.startsWith('//');
      });
    commands.push(...lines);
  }
  
  if (commands.length === 0) {
    return {
      isValid: true,
      issues: [],
    };
  }
  
  return validateCommands(commands);
}

/**
 * 获取命令的详细说明
 */
export function getCommandHelp(commandName: string): string {
  const helpTexts: Record<string, string> = {
    'Point': '定义点: A=(x,y) 或 A=Point[x,y]',
    'Line': '定义直线: line=Line[A,B] (通过两点)',
    'Circle': '定义圆: circle=Circle[M,r] (圆心和半径) 或 Circle[M,A] (圆心和圆上一点)',
    'Segment': '定义线段: seg=Segment[A,B]',
    'Vector': '定义向量: v=Vector[A,B]',
    'Polygon': '定义多边形: poly=Polygon[A,B,C,...]',
    'Midpoint': '中点: M=Midpoint[A,B]',
    'Intersect': '交点: C=Intersect[line1,line2]',
    'Perpendicular': '垂线: perp=Perpendicular[A,line]',
    'Parallel': '平行线: par=Parallel[A,line]',
    'Tangent': '切线: tan=Tangent[A,circle]',
    'Angle': '角度: angle=Angle[A,B,C]',
    'Distance': '距离: d=Distance[A,B]',
    'Rotate': '旋转: B=Rotate[A,angle,M] (点A绕M旋转angle角度)',
    'Translate': '平移: B=Translate[A,v] (点A沿向量v平移)',
  };
  
  return helpTexts[commandName] || '未找到该命令的帮助信息';
}

/**
 * 智能修复命令
 */
export function autoFixCommand(command: string): { fixed: string; changes: string[] } {
  let fixed = command.trim();
  const changes: string[] = [];
  
  // 应用所有可以自动修复的规则
  for (const errorPattern of ERROR_PATTERNS) {
    if (errorPattern.fix && errorPattern.pattern.test(fixed)) {
      const before = fixed;
      fixed = errorPattern.fix(fixed);
      if (before !== fixed) {
        changes.push(errorPattern.message);
      }
    }
  }
  
  return { fixed, changes };
}
