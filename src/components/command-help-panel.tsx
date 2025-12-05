/**
 * GeoGebra 命令帮助面板
 * 提供命令搜索、语法提示和实时验证
 */

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, BookOpen, Code, AlertCircle, CheckCircle, Info } from 'lucide-react'
import {
  searchCommands,
  getCommandHelp,
  validateCommandSyntax,
  getAllCommandNames,
  type CommandInfo,
  type ValidationIssue
} from '@/lib/geogebra-syntax-validator'

interface CommandHelpPanelProps {
  onInsertCommand?: (command: string) => void
}

export function CommandHelpPanel({ onInsertCommand }: CommandHelpPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCommand, setSelectedCommand] = useState<CommandInfo | null>(null)
  const [testCommand, setTestCommand] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationIssue[]>([])

  // 搜索命令
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return []
    }
    return searchCommands(searchQuery)
  }, [searchQuery])

  // 验证测试命令
  const handleValidateTest = () => {
    if (!testCommand.trim()) {
      setValidationResult([])
      return
    }
    const issues = validateCommandSyntax(testCommand)
    setValidationResult(issues)
  }

  // 选择命令查看详情
  const handleSelectCommand = (cmd: CommandInfo) => {
    setSelectedCommand(cmd)
    setSearchQuery('')
  }

  // 插入示例命令
  const handleInsertExample = (command: string) => {
    if (onInsertCommand) {
      onInsertCommand(command)
    }
  }

  // 获取验证图标
  const getValidationIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* 搜索栏 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            命令搜索
          </CardTitle>
          <CardDescription>搜索 GeoGebra 命令和功能</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="输入命令名或描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          {searchResults.length > 0 && (
            <ScrollArea className="h-48 mt-2 border rounded-md p-2">
              {searchResults.map((cmd, idx) => (
                <div
                  key={idx}
                  className="p-2 hover:bg-muted rounded cursor-pointer mb-1"
                  onClick={() => handleSelectCommand(cmd)}
                >
                  <div className="font-mono text-sm font-semibold text-primary">
                    {cmd.signature}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cmd.description}
                  </div>
                </div>
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 命令详情 */}
      {selectedCommand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {selectedCommand.commandBase}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-semibold mb-1">签名:</div>
              <code className="text-xs bg-muted p-2 rounded block">
                {selectedCommand.signature}
              </code>
            </div>

            <div>
              <div className="text-sm font-semibold mb-1">描述:</div>
              <p className="text-sm text-muted-foreground">
                {selectedCommand.description}
              </p>
            </div>

            {selectedCommand.examples.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">示例:</div>
                <div className="space-y-2">
                  {selectedCommand.examples.map((example, idx) => (
                    <div key={idx} className="border rounded p-2">
                      {example.description && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {example.description}
                        </p>
                      )}
                      {example.command && (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                            {example.command}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleInsertExample(example.command)}
                          >
                            插入
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCommand.note && (
              <div>
                <div className="text-sm font-semibold mb-1">注意:</div>
                <p className="text-xs text-muted-foreground">
                  {selectedCommand.note}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 命令测试器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            命令验证
          </CardTitle>
          <CardDescription>测试命令语法是否正确</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="输入命令进行测试..."
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidateTest()}
            />
            <Button onClick={handleValidateTest}>验证</Button>
          </div>

          {validationResult.length > 0 ? (
            <div className="space-y-2">
              {validationResult.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded border ${
                    issue.severity === 'error'
                      ? 'bg-red-50 border-red-200'
                      : issue.severity === 'warning'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {getValidationIcon(issue.severity)}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{issue.message}</div>
                      {issue.suggestion && (
                        <div className="text-xs mt-1 text-muted-foreground">
                          💡 {issue.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : testCommand && (
            <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-700">语法正确</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
