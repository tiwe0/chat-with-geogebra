// 创建一个新文件来分离ChatInterface组件，并添加调试日志
import type React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, AlertCircle, Play } from "lucide-react"
import { useRef, useEffect, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useAppStore } from "@/lib/store"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, Code, Sparkles } from "lucide-react"
import { useState, useCallback } from "react"
import { validateCommands, autoFixCommand, type ValidationIssue } from "@/lib/geogebra-validator"
import type { Message } from "@ai-sdk/react"

// Chat interface component
export function ChatInterface({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  onOpenConfig,
  error,
  showGeogebra,
  setShowGeogebra,
  onRequestAIFix,
}: {
  messages: any[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  onOpenConfig?: () => void
  error?: string | null
  showGeogebra?: boolean
  setShowGeogebra?: (show: boolean) => void
  onRequestAIFix?: (message: Message | { role: 'user' | 'assistant', content: string }) => Promise<string | null | undefined>
}) {
  // 从store获取对话数据
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const setActiveConversation = useAppStore((state) => state.setActiveConversation)

  // 添加自定义提交处理函数，以便添加调试日志
  const onSubmitWithDebug = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      handleSubmit(e)
    },
    [handleSubmit],
  )

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // 当消息更新时滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // 跟踪已处理的消息ID，确保每条消息只处理一次
  const processedMessagesRef = useRef<Set<string>>(new Set())

  // 在组件顶层添加这个状态
  const [messageCommandsState, setMessageCommandsState] = useState<Record<string, boolean>>({})
  
  // 存储每条消息的验证结果
  const [validationResults, setValidationResults] = useState<Record<string, { issues: ValidationIssue[], fixedCommands?: string[] }>>({})
  
  // AI修复请求中状态
  const [fixingMessageId, setFixingMessageId] = useState<string | null>(null)

  // 请求AI修复命令
  const requestAIFix = useCallback(async (messageIndex: number, issues: ValidationIssue[]) => {
    if (!onRequestAIFix) return
    
    const message = messages[messageIndex]
    const msgId = message.id || `msg-index-${messageIndex}`
    
    setFixingMessageId(msgId)
    
    try {
      // 按严重程度分组问题
      const errors = issues.filter(i => i.severity === 'error')
      const warnings = issues.filter(i => i.severity === 'warning')
      
      // 构造详细的错误描述
      const errorDetails = errors.map(i => {
        let detail = `  第${i.line}行: ${i.command}\n    问题: ${i.message}`
        if (i.suggestion) {
          detail += `\n    建议: ${i.suggestion}`
        }
        if (i.fixedCommand && i.fixedCommand !== i.command) {
          detail += `\n    修复为: ${i.fixedCommand}`
        }
        return detail
      }).join('\n\n')
      
      const fixPrompt = `你之前生成的GeoGebra命令存在 ${errors.length} 个语法错误，需要修复。

❌ 检测到的错误:
${errorDetails}

📋 常见错误类型:
- 使用了中文标点符号（全角括号（）、全角逗号，）
- 坐标格式错误（缺少逗号、多余空格）
- 括号不匹配
- 点定义格式不正确

✅ 正确的格式示例:
- 点定义: A=(1,2) 或 A=Point[1,2]
- 直线: line=Line[A,B]
- 圆: circle=Circle[M,3]
- 函数: f(x)=sin(x)

请重新生成完整的回复，确保:
1. 所有GeoGebra命令使用英文标点符号
2. 坐标格式正确: (x,y) 不是 (x y) 或 (x，y)
3. 命令放在 \`\`\`geogebra 代码块中
4. 保持原有的解释和说明，只修复命令部分

原始回复:
${message.content}`

      await onRequestAIFix({
        role: 'user',
        content: fixPrompt
      })
    } catch (error) {
      console.error('请求AI修复失败:', error)
    } finally {
      setFixingMessageId(null)
    }
  }, [messages, onRequestAIFix])

  // 修改extractGgbCommandsFromMessage函数，添加验证逻辑
  const extractGgbCommandsFromMessage = useCallback((content: string, messageId?: string) => {
    console.log("[提取命令] 开始提取，内容长度:", content.length)
    const ggbCommands: string[] = []

    // 匹配形如 `ggb:命令` 的内容
    const ggbRegex = /`ggb:([^`]+)`/g
    let match

    while ((match = ggbRegex.exec(content)) !== null) {
      const cmd = match[1].trim()
      console.log("[提取命令] 找到 ggb: 格式命令:", cmd)
      ggbCommands.push(cmd)
    }

    // 匹配代码块中的GeoGebra命令 - 支持多种换行符
    const codeBlockRegex = /```geogebra\s*\n([\s\S]*?)```/g
    let codeMatch

    while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
      console.log("[提取命令] 找到 geogebra 代码块:", codeMatch[1])
      const commands = codeMatch[1].split("\n")
        .map(line => line.trim())
        .filter((line) => {
          // 过滤空行和注释行（# 或 //）
          return line !== "" && !line.startsWith('#') && !line.startsWith('//')
        })
      console.log("[提取命令] 代码块中的命令数:", commands.length, commands)
      ggbCommands.push(...commands)
    }

    console.log("[提取命令] 总共提取到", ggbCommands.length, "条命令")
    
    // 验证命令
    if (ggbCommands.length > 0 && messageId) {
      const validationResult = validateCommands(ggbCommands)
      console.log("[命令验证] 验证结果:", validationResult)
      
      setValidationResults(prev => ({
        ...prev,
        [messageId]: {
          issues: validationResult.issues,
          fixedCommands: validationResult.fixedCommands
        }
      }))
      
      // 如果有错误，返回修复后的命令
      if (!validationResult.isValid && validationResult.fixedCommands) {
        console.log("[命令验证] 使用修复后的命令:", validationResult.fixedCommands)
        return validationResult.fixedCommands
      }
    }
    
    return ggbCommands
  }, [])

  // 执行GeoGebra命令，根据API文档使用返回值检查
  const executeGgbCommand = useCallback((cmd: string) => {
    if (window.ggbApplet) {
      try {
        const success = window.ggbApplet.evalCommand(cmd)
        if (success) {
          console.log(`[执行成功] ${cmd}`)
          return true
        } else {
          console.error(`[执行失败] 命令: "${cmd}" (evalCommand返回false)`)
          return false
        }
      } catch (e) {
        console.error(`[执行异常] 命令: "${cmd}"`, e)
        return false
      }
    } else {
      console.warn(`GeoGebra applet 不可用，无法执行命令: "${cmd}"`)
      return false
    }
  }, [])

  // 执行特定消息中的所有命令
  const executeMessageCommands = useCallback((commands: string[]) => {
    if (!window.ggbApplet || commands.length === 0) {
      console.warn("GeoGebra applet不可用或没有命令，无法执行命令")
      return
    }

    console.log(`准备执行消息中的${commands.length}个GeoGebra命令`)

    // 重置GeoGebra
    try {
      window.ggbApplet.reset()
      console.log("GeoGebra applet重置成功")
    } catch (e) {
      console.error("重置GeoGebra失败:", e)
    }

    // 执行所有命令，记录成功和失败
    const timeoutIds: NodeJS.Timeout[] = []
    let successCount = 0
    let failCount = 0
    
    commands.forEach((cmd, index) => {
      const timeoutId = setTimeout(() => {
        console.log(`执行命令 ${index + 1}/${commands.length}: "${cmd}"`)
        const success = window.ggbApplet.evalCommand(cmd)
        
        if (success) {
          successCount++
          console.log(`[${index + 1}/${commands.length}] ✓ 成功: "${cmd}"`)
        } else {
          failCount++
          console.error(`[${index + 1}/${commands.length}] ✗ 失败: "${cmd}"`)
        }
        
        // 最后一条命令执行完后输出统计
        if (index === commands.length - 1) {
          console.log(`\n命令执行完成: ${successCount}成功, ${failCount}失败\n`)
        }
      }, index * 100)
      timeoutIds.push(timeoutId)
    })

    // 返回清理函数
    return () => {
      timeoutIds.forEach(clearTimeout)
    }
  }, [])

  // 缓存最后一条消息的ID，避免在每次渲染时重新计算
  const lastMessageId = useMemo(() => {
    if (messages.length === 0) return null
    const lastMessage = messages[messages.length - 1]
    return lastMessage.id || `msg-index-${messages.length - 1}`
  }, [messages])

  // 修改监听消息变化的useEffect，添加更多日志并修复可能的问题
  useEffect(() => {
    if (messages.length === 0 || !lastMessageId) return

    const lastMessage = messages[messages.length - 1]
    console.log("[自动执行] 检查最后一条消息:", {
      role: lastMessage.role,
      id: lastMessageId,
      contentLength: lastMessage.content?.length,
      已处理: processedMessagesRef.current.has(lastMessageId)
    })

    // 只处理助手的消息，确保消息有内容
    if (lastMessage.role === "assistant" && lastMessage.content) {
      if (!processedMessagesRef.current.has(lastMessageId)) {
        // 标记该消息已处理
        processedMessagesRef.current.add(lastMessageId)
        console.log("[自动执行] 标记消息已处理:", lastMessageId)

        // 提取命令
        const commands = extractGgbCommandsFromMessage(lastMessage.content, lastMessageId)

        if (commands.length > 0) {
          console.log("[自动执行] 准备执行命令:", commands)
          
          // 如果 GeoGebra 面板未显示，自动显示
          if (setShowGeogebra && !showGeogebra) {
            console.log("[自动执行] 自动显示 GeoGebra 面板")
            setShowGeogebra(true)
          }
          
          // 确保 GeoGebra applet 已加载
          let checkAttempts = 0
          const maxAttempts = 20 // 最多尝试 2 秒（考虑到可能需要显示面板）
          let timeoutId: NodeJS.Timeout

          const checkAndExecute = () => {
            if (checkAttempts >= maxAttempts) {
              console.warn("[自动执行] GeoGebra applet 加载超时，放弃执行命令")
              return
            }

            checkAttempts++

            if (window.ggbApplet && typeof window.ggbApplet.evalCommand === "function") {
              console.log("[自动执行] GeoGebra 就绪，开始执行")
              // 清除之前的构造
              try {
                window.ggbApplet.reset()
                console.log("[自动执行] GeoGebra 重置成功")
              } catch (e) {
                console.error("[自动执行] 重置GeoGebra失败:", e)
              }

              // 执行所有命令，记录结果
              let successCount = 0
              let failCount = 0
              
              commands.forEach((cmd, index) => {
                setTimeout(() => {
                  console.log(`[自动执行] 执行命令 ${index + 1}/${commands.length}: "${cmd}"`)
                  const success = executeGgbCommand(cmd)
                  
                  if (success) {
                    successCount++
                  } else {
                    failCount++
                  }
                  
                  // 最后一条命令执行完后输出统计
                  if (index === commands.length - 1) {
                    console.log(`\n[自动执行] 完成: ${successCount}成功, ${failCount}失败\n`)
                  }
                }, index * 100)
              })
            } else {
              console.log(`[自动执行] GeoGebra 未就绪，重试 ${checkAttempts}/${maxAttempts}`)
              // 如果GeoGebra还没加载完成，等待100ms后再次尝试
              timeoutId = setTimeout(checkAndExecute, 100)
            }
          }

          checkAndExecute()

          // 清理函数
          return () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
          }
        } else {
          console.log("[自动执行] 未找到命令")
        }
      }
    }
  }, [lastMessageId, messages, extractGgbCommandsFromMessage, executeGgbCommand])

  // 当对话ID变化时，清除已处理消息的记录
  useEffect(() => {
    processedMessagesRef.current.clear()
  }, [activeConversationId])

  // 为每个消息提取GeoGebra命令 - 优化：只在消息长度变化时重新计算
  const messageCommandsMap = useMemo(() => {
    const result: Record<number, string[]> = {}

    messages.forEach((message, index) => {
      if (message.role === "assistant" && message.content) {
        const msgId = message.id || `msg-index-${index}`
        result[index] = extractGgbCommandsFromMessage(message.content, msgId)
      } else {
        result[index] = []
      }
    })

    return result
  }, [messages, extractGgbCommandsFromMessage]) // 依赖完整的messages数组以确保内容变化时重新计算

  return (
    <>
      <Card className="flex-1 flex flex-col overflow-hidden border-0 rounded-none">
        <CardHeader className="border-b p-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex-1 lg:hidden">
              <select
                className="w-full p-2 bg-background border rounded-md"
                value={activeConversationId}
                onChange={(e) => {
                  console.debug("切换对话:", {
                    newConversation: e.target.value,
                  })
                  setActiveConversation(e.target.value)
                }}
              >
                {conversations.map((conv) => (
                  <option key={conv.id} value={conv.id}>
                    {conv.title}
                  </option>
                ))}
              </select>
            </div>
            <CardTitle className="text-xl hidden lg:block">对话</CardTitle>
            <div className="flex gap-2"></div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative overflow-hidden">
          <div className="chat-messages-container absolute inset-0 p-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">开始一个对话</h3>
                  <p className="text-muted-foreground">提出问题或开始新话题以开始聊天。</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 pb-1">
                {messages.map((message, index) => {
                  // 使用预先计算的命令
                  const messageCommands = messageCommandsMap[index] || []

                  return (
                    <div key={index} className="mb-3">
                      <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "assistant" && messageCommands.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 mr-1 flex-shrink-0 self-start mt-1"
                            onClick={() => executeMessageCommands(messageCommands)}
                            title="执行此消息中的所有GeoGebra命令"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <div
                          className={`max-w-[90%] rounded-lg px-3 py-1.5 ${
                            message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <div className="markdown-content whitespace-pre-wrap break-words">
                            <ReactMarkdown
                              remarkPlugins={[remarkMath, remarkGfm]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                // 自定义链接，在新标签页打开
                                a: ({ node, ...props }) => (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  />
                                ),
                                // 内联代码
                                code: ({ node, className, children, ref, ...props }) => {
                                  const match = /language-(\w+)/.exec(className || "")
                                  const isInline = !match
                                  
                                  if (isInline) {
                                    return (
                                      <code
                                        className="px-1.5 py-0.5 mx-0.5 rounded bg-muted text-sm font-mono"
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    )
                                  }
                                  
                                  // 代码块
                                  return (
                                    <SyntaxHighlighter
                                      style={vscDarkPlus as any}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-md my-2 text-sm"
                                    >
                                      {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>
                                  )
                                },
                                // 段落
                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                // 标题
                                h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-2 mt-4" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-2 mt-3" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-2 mt-2" {...props} />,
                                // 列表
                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                                // 引用
                                blockquote: ({ node, ...props }) => (
                                  <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2" {...props} />
                                ),
                                // 表格
                                table: ({ node, ...props }) => (
                                  <div className="overflow-x-auto my-2">
                                    <table className="min-w-full border-collapse border border-gray-300" {...props} />
                                  </div>
                                ),
                                th: ({ node, ...props }) => (
                                  <th className="border border-gray-300 px-4 py-2 bg-muted font-semibold" {...props} />
                                ),
                                td: ({ node, ...props }) => (
                                  <td className="border border-gray-300 px-4 py-2" {...props} />
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>

                      {/* 在助手消息下方显示GeoGebra命令和验证结果 */}
                      {message.role === "assistant" && messageCommands.length > 0 && (
                        <div className="ml-4 mt-1 mb-2 w-[90%]">
                          {/* 验证警告 */}
                          {(() => {
                            const msgId = message.id || `msg-index-${index}`
                            const validation = validationResults[msgId]
                            const errorCount = validation?.issues.filter(i => i.severity === 'error').length || 0
                            const warningCount = validation?.issues.filter(i => i.severity === 'warning').length || 0
                            
                            if (errorCount > 0 || warningCount > 0) {
                              const isFixing = fixingMessageId === msgId
                              
                              return (
                                <Alert variant={errorCount > 0 ? "destructive" : "default"} className="mb-2 text-xs py-2">
                                  <AlertCircle className="h-3 w-3" />
                                  <AlertDescription>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="font-semibold">
                                        命令验证: {errorCount > 0 && `${errorCount} 个错误`} {warningCount > 0 && `${warningCount} 个警告`}
                                      </div>
                                      {errorCount > 0 && onRequestAIFix && !isLoading && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-xs px-2 gap-1"
                                          onClick={() => requestAIFix(index, validation.issues)}
                                          disabled={isFixing}
                                        >
                                          <Sparkles className="h-3 w-3" />
                                          {isFixing ? '修复中...' : '请AI修复'}
                                        </Button>
                                      )}
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      {validation.issues.slice(0, 3).map((issue, idx) => (
                                        <div key={idx} className="flex items-start gap-1">
                                          <span className={`font-medium ${issue.severity === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
                                            行{issue.line}:
                                          </span>
                                          <span>{issue.message}</span>
                                        </div>
                                      ))}
                                      {validation.issues.length > 3 && (
                                        <div className="text-muted-foreground">还有 {validation.issues.length - 3} 个问题...</div>
                                      )}
                                    </div>
                                    {validation.fixedCommands && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        💡 已自动应用修复建议
                                      </div>
                                    )}
                                  </AlertDescription>
                                </Alert>
                              )
                            }
                            return null
                          })()}
                          
                          <Collapsible
                            open={messageCommandsState[`msg-${index}`] || false}
                            onOpenChange={(open) => {
                              setMessageCommandsState((prev) => ({
                                ...prev,
                                [`msg-${index}`]: open,
                              }))
                            }}
                            className="w-full"
                          >
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="flex items-center gap-1 h-6 px-2 text-xs">
                                <Code className="h-3 w-3" />
                                GeoGebra命令 ({messageCommands.length})
                                {messageCommandsState[`msg-${index}`] ? (
                                  <ChevronUp className="h-3 w-3 ml-1" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex items-center gap-1 h-6 px-2 text-xs ml-2"
                              onClick={() => executeMessageCommands(messageCommands)}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              执行全部
                            </Button>
                            <CollapsibleContent>
                              <div className="mt-1 space-y-1 border rounded-md p-2 bg-background">
                                {messageCommands.map((cmd, i) => {
                                  const msgId = message.id || `msg-index-${index}`
                                  const validation = validationResults[msgId]
                                  const cmdIssue = validation?.issues.find(issue => issue.line === i + 1)
                                  
                                  return (
                                    <div key={i} className="space-y-1">
                                      <div className="text-xs p-1.5 bg-muted rounded-md flex justify-between items-center">
                                        <div className="flex items-center gap-2 flex-1">
                                          <span className="text-muted-foreground">{i + 1}.</span>
                                          <code className="text-xs flex-1">{cmd}</code>
                                          {cmdIssue && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                              cmdIssue.severity === 'error' ? 'bg-red-100 text-red-700' :
                                              cmdIssue.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-blue-100 text-blue-700'
                                            }`}>
                                              {cmdIssue.severity === 'error' ? '错误' :
                                               cmdIssue.severity === 'warning' ? '警告' : '提示'}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 ml-2"
                                          onClick={() => executeGgbCommand(cmd)}
                                          title="在GeoGebra中执行"
                                        >
                                          <span className="sr-only">执行</span>▶
                                        </Button>
                                      </div>
                                      {cmdIssue && (
                                        <div className="ml-6 text-[11px] space-y-1">
                                          <div className="text-muted-foreground">{cmdIssue.message}</div>
                                          {cmdIssue.suggestion && (
                                            <div className="text-blue-600">💡 {cmdIssue.suggestion}</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </div>
                  )
                })}
                {isLoading && (
                  <div className="flex justify-start mb-3">
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div className="bg-muted text-muted-foreground rounded-lg px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="animate-bounce inline-block w-2 h-2 bg-current rounded-full" style={{ animationDelay: '0ms' }}></span>
                            <span className="animate-bounce inline-block w-2 h-2 bg-current rounded-full" style={{ animationDelay: '150ms' }}></span>
                            <span className="animate-bounce inline-block w-2 h-2 bg-current rounded-full" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <span className="text-sm">AI 正在思考...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t p-4 flex-shrink-0">
          <form onSubmit={onSubmitWithDebug} className="flex w-full gap-2">
            <Input placeholder="输入您的消息..." value={input} onChange={handleInputChange} className="flex-1" />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </>
  )
}

