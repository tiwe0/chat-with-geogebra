import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trash2, Plus, ChevronLeft, ChevronRight, Settings } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ConfigDialog } from "@/components/config-dialog"
import { Textarea } from "@/components/ui/textarea"
import { ChatInterface } from "@/components/chat-interface"
import { Toast } from "@/components/toast"
import { GeogebraPanel } from "@/components/geogebra-panel"
import { useAppStore, convertChatMessagesToStore, convertStoreMessagesToChat, EMPTY_MESSAGES_ARRAY, type Message } from "@/lib/store"
import { 
  logGeoGebraStatus
} from "@/lib/geogebra-helper"

// 声明全局类型
declare global {
  interface Window {
    GGBApplet: any
    ggbApplet: any
    ggbAppletReady: boolean
  }
}

export default function ChatPage() {
  // 使用 zustand hooks 获取状态和 actions
  const config = useAppStore((state) => state.config)
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const showGeogebra = useAppStore((state) => state.showGeogebra)
  const setActiveConversation = useAppStore((state) => state.setActiveConversation)
  const createConversation = useAppStore((state) => state.createConversation)
  const deleteConversation = useAppStore((state) => state.deleteConversation)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const setShowGeogebra = useAppStore((state) => state.setShowGeogebra)
  const setMessages = useAppStore((state) => state.setMessages)
  const updateConversationTitle = useAppStore((state) => state.updateConversationTitle)

  // Get messages for the active conversation - 使用常量空数组避免无限循环
  const storeMessages = useAppStore((state) => {
    const messages = state.messages?.[activeConversationId]
    return Array.isArray(messages) ? messages : EMPTY_MESSAGES_ARRAY
  })

  // 本地UI状态
  const [configOpen, setConfigOpen] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  const isDesktop = useMediaQuery("(min-width: 1024px)")

  // 初始化聊天钩子
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages: setChatMessages,
    append,
    error,
  } = useChat({
    id: activeConversationId,
    body: {
      configSettings: config,
    },
    fetch: async (input, init) => {
      // 使用本地 API 而不是 Next.js API route
      const { messages: reqMessages, ...restBody } = JSON.parse(init?.body as string || '{}')
      
      try {
        const { callChatAPI } = await import('@/lib/chat-api')
        const result = await callChatAPI({
          messages: reqMessages,
          configSettings: restBody.configSettings,
        })
        
        // 将 streamText 结果转换为 Response
        return result.toTextStreamResponse()
      } catch (error) {
        console.error('Chat API error:', error)
        throw error
      }
    },
    initialMessages: (convertStoreMessagesToChat(storeMessages || []) || []) as any,
    onResponse: (response) => {
      console.debug("聊天响应状态:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      // 清除之前的错误
      setChatError(null)

      if (!response.ok) {
        response
          .json()
          .then((data) => {
            console.error("聊天响应错误:", data)
            setChatError(data.error || "请求处理失败，请检查API密钥和网络连接")
          })
          .catch((err) => {
            console.error("解析错误响应失败:", err)
            setChatError("请求处理失败，请检查API密钥和网络连接")
          })
      }
    },
    onFinish: (message) => {
      console.debug("聊天完成:", { messageLength: message.content.length })
      // 消息会在下一个 render 中更新，由 useEffect 处理保存
    },
    onError: (error) => {
      console.error("聊天错误:", error)
      setChatError(error.message || "发生错误，请重试")
    },
  })

  // 添加错误状态监控
  useEffect(() => {
    if (error) {
      console.error("聊天钩子错误:", error)
      setChatError(error.message || "发生错误，请重试")
    }
  }, [error])

  // 当activeConversationId变化时，重置错误状态并同步消息
  useEffect(() => {
    setChatError(null)
    
    // 切换对话时，同步store中的消息到useChat
    const chatMessages = convertStoreMessagesToChat(storeMessages)
    console.debug("切换对话，同步消息:", {
      conversationId: activeConversationId,
      messageCount: chatMessages.length
    })
    
    // 使用 as any 暂时绕过类型检查，因为运行时类型是正确的
    setChatMessages(chatMessages as any)
  }, [activeConversationId, setChatMessages])
  
  // 当 messages 变化时，自动保存到 store（防抖处理）
  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) return
    
    const timer = setTimeout(() => {
      try {
        // 过滤掉"data"角色的消息，只保留标准角色，并转换为store兼容格式
        const validMessages = messages
          .filter(m => m && m.role !== 'data')
          .map(m => ({
            id: m.id || `msg-${Date.now()}`,
            role: m.role as "user" | "assistant" | "system",
            content: m.content || '',
          }))
        const updatedMessages = convertChatMessagesToStore(validMessages)
        if (updatedMessages && updatedMessages.length > 0) {
          console.debug("自动保存消息到store:", { 
            conversationId: activeConversationId, 
            messageCount: updatedMessages.length 
          })
          setMessages(activeConversationId, updatedMessages)
        }
      } catch (error) {
        console.error("保存消息失败:", error)
      }
    }, 500) // 500ms 防抖
    
    return () => clearTimeout(timer)
  }, [messages, activeConversationId, setMessages])

  // 当用户提交消息时，更新store中的对话标题
  useEffect(() => {
    if (messages.length > 0 && messages[0].role === "user") {
      const title = messages[0].content.slice(0, 20) + (messages[0].content.length > 20 ? "..." : "")
      const conversation = conversations.find((c) => c.id === activeConversationId)
      if (conversation && conversation.title !== title && conversation.title === "新会话") {
        updateConversationTitle(activeConversationId, title)
      }
    }
  }, [messages, activeConversationId, conversations, updateConversationTitle])

  // 自定义提交处理函数
  const handleChatSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input.trim()) return

      // 清除之前的错误
      setChatError(null)

      try {
        // 调用原始handleSubmit
        handleSubmit(e)
      } catch (err: any) {
        console.error("提交消息错误:", err)
        setChatError(err.message || "发送消息失败，请重试")
      }
    },
    [input, handleSubmit, setChatError],
  )

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen)
  }, [sidebarOpen, setSidebarOpen])

  // 重置GeoGebra - 清空内容但不销毁
  const resetGeoGebra = useCallback(() => {
    console.log("手动重置GeoGebra...")
    logGeoGebraStatus()
    if (window.ggbApplet) {
      try {
        // 只重置内容，不销毁 applet
        window.ggbApplet.reset()
        console.log("GeoGebra重置成功")
      } catch (error) {
        console.error("GeoGebra重置失败:", error)
      }
    } else {
      console.warn("GeoGebra applet不可用")
    }
  }, [])

  // 执行最新消息中的所有GeoGebra命令
  const executeLatestCommands = useCallback(() => {
    if (!window.ggbApplet || messages.length === 0) {
      console.warn("GeoGebra applet不可用或没有消息，无法执行命令")
      return
    }

    // 查找最新的助手消息
    const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant")
    if (!latestAssistantMessage) {
      console.warn("没有找到助手消息，无法执行命令")
      return
    }

    console.log("准备执行最新消息中的GeoGebra命令")

    // 提取GeoGebra命令
    const commands: string[] = []

    // 匹配形如 `ggb:命令` 的内容
    const ggbRegex = /`ggb:([^`]+)`/g
    let match
    while ((match = ggbRegex.exec(latestAssistantMessage.content)) !== null) {
      commands.push(match[1].trim())
    }

    // 匹配代码块中的GeoGebra命令
    const codeBlockRegex = /```geogebra\n([\s\S]*?)```/g
    let codeMatch
    while ((codeMatch = codeBlockRegex.exec(latestAssistantMessage.content)) !== null) {
      const blockCommands = codeMatch[1].split("\n").filter((line) => line.trim() !== "")
      commands.push(...blockCommands)
    }

    if (commands.length === 0) {
      console.warn("最新消息中没有找到GeoGebra命令")
      return
    }

    console.log(`找到${commands.length}个GeoGebra命令，准备执行`)

    // 重置GeoGebra
    try {
      window.ggbApplet.reset()
      console.log("GeoGebra重置成功")
    } catch (e) {
      console.error("GeoGebra重置失败:", e)
    }

    // 执行所有命令
    commands.forEach((cmd, index) => {
      setTimeout(() => {
        console.log(`执行命令 ${index + 1}/${commands.length}: "${cmd}"`)
        try {
          window.ggbApplet.evalCommand(cmd)
          console.log(`命令执行成功: "${cmd}"`)
        } catch (e) {
          console.error(`执行GeoGebra命令失败: "${cmd}"`, e)
        }
      }, index * 100) // 每条命令间隔100ms执行，避免执行过快
    })

    // 显示执行成功的提示
    setChatError(`已执行${commands.length}条GeoGebra命令`)
    setTimeout(() => setChatError(null), 3000)
  }, [messages, setChatError])

  // 缓存对话列表
  const conversationItems = useMemo(() => {
    return conversations.map((conv) => (
      <div key={conv.id} className="flex items-center gap-2 mb-2">
        <Button
          variant={activeConversationId === conv.id ? "secondary" : "ghost"}
          className="w-full justify-start text-left truncate"
          onClick={() => setActiveConversation(conv.id)}
        >
          {conv.title}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            deleteConversation(conv.id)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ))
  }, [conversations, activeConversationId, setActiveConversation, deleteConversation])

  return (
    <div className="flex h-screen bg-background">
      {/* Config Dialog */}
      <ConfigDialog open={configOpen} onOpenChange={setConfigOpen} onSave={() => setSaveSuccess(true)} />

      {/* Sidebar for conversations */}
      {isDesktop && sidebarOpen && (
        <div className="w-64 border-r p-4 relative">
          <div className="flex items-center mb-4">
            <Button
              variant="outline"
              className="flex-1 justify-start"
              onClick={() => {
                if (!isLoading) {
                  createConversation()
                }
              }}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" /> 新对话
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 ml-2" onClick={toggleSidebar}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">收起侧栏</span>
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="space-y-2">{conversationItems}</div>
          </ScrollArea>

          <div className="mt-4 pt-4 border-t flex items-center">
            <Button variant="outline" className="flex-1 justify-start" onClick={() => setConfigOpen(true)}>
              <Settings className="mr-2 h-4 w-4" /> 设置
            </Button>
          </div>
        </div>
      )}

      {isDesktop && !sidebarOpen && (
        <div className="w-10 flex-shrink-0 flex items-center justify-center border-r">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none" onClick={toggleSidebar}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">展开侧栏</span>
          </Button>
        </div>
      )}

      {/* Main content area with chat and GeoGebra */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Chat section */}
        {isDesktop && !showGeogebra && (
          <Button variant="outline" className="absolute top-4 right-4 z-10" onClick={() => setShowGeogebra(true)}>
            显示 GeoGebra
          </Button>
        )}
        <div className={`${isDesktop && showGeogebra ? "lg:w-[50%]" : "w-full"} flex flex-row relative`}>
          {/* Mobile view tabs */}
          <div className="lg:hidden w-full">
            <Tabs defaultValue="chat" className="w-full">
              <div className="flex items-center p-2 border-b">
                <TabsList className="flex-1">
                  <TabsTrigger value="chat">对话</TabsTrigger>
                  <TabsTrigger value="settings">设置</TabsTrigger>
                </TabsList>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!isLoading) {
                      createConversation()
                    }
                  }}
                  disabled={isLoading}
                  className="ml-2"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <TabsContent value="chat" className="h-[calc(100vh-112px)] flex flex-col">
                <ChatInterface
                  messages={messages}
                  input={input}
                  handleInputChange={handleInputChange}
                  handleSubmit={handleChatSubmit}
                  isLoading={isLoading}
                  error={chatError}
                />
              </TabsContent>

              <TabsContent value="settings" className="h-[calc(100vh-112px)] p-4">
                <div className="space-y-4">
                  <h3 className="text-xl font-medium">设置</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">模型类型</label>
                      <select
                        className="w-full p-2 bg-background border rounded-md"
                        value={config.modelType}
                        onChange={(e) => useAppStore.getState().updateConfig({ modelType: e.target.value })}
                      >
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku">Claude 3 Haiku</option>
                        <option value="deepseek-chat">DeepSeek Chat</option>
                        <option value="deepseek-coder">DeepSeek Coder</option>
                        <option value="llama-3">Llama 3</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">OpenAI API 密钥</label>
                      <input
                        type="password"
                        value={config.apiKeys.openai || ""}
                        onChange={(e) => useAppStore.getState().updateApiKey("openai", e.target.value)}
                        placeholder="输入 OpenAI API 密钥"
                        className="w-full p-2 bg-background border rounded-md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Anthropic API 密钥</label>
                      <input
                        type="password"
                        value={config.apiKeys.anthropic || ""}
                        onChange={(e) => useAppStore.getState().updateApiKey("anthropic", e.target.value)}
                        placeholder="输入 Anthropic API 密钥"
                        className="w-full p-2 bg-background border rounded-md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">DeepSeek API 密钥</label>
                      <input
                        type="password"
                        value={config.apiKeys.deepseek || ""}
                        onChange={(e) => useAppStore.getState().updateApiKey("deepseek", e.target.value)}
                        placeholder="输入 DeepSeek API 密钥"
                        className="w-full p-2 bg-background border rounded-md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">系统提示词</label>
                      <Textarea
                        value={config.systemPrompt}
                        onChange={(e) => useAppStore.getState().updateConfig({ systemPrompt: e.target.value })}
                        placeholder="输入系统提示词，定义AI助手的行为和知识范围"
                        className="min-h-[100px]"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setSaveSuccess(true)
                        setTimeout(() => setSaveSuccess(false), 3000)
                      }}
                    >
                      保存设置
                    </Button>
                    {saveSuccess && (
                      <div className="mt-2 p-2 bg-green-100 text-green-800 rounded-md text-center">设置已成功保存</div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Desktop chat interface */}
          <div className="flex-1 hidden lg:flex flex-col">
            <ChatInterface
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              onOpenConfig={() => setConfigOpen(true)}
              error={chatError || error?.message}
              showGeogebra={showGeogebra}
              setShowGeogebra={setShowGeogebra}
              onRequestAIFix={append}
            />
          </div>
        </div>

        {/* GeoGebra section (desktop only) */}
        {isDesktop && showGeogebra && (
          <GeogebraPanel
            onClose={() => setShowGeogebra(false)}
            onExecuteLatestCommands={executeLatestCommands}
            onDebug={() => {
              const status = logGeoGebraStatus()
              alert(JSON.stringify(status, null, 2))
            }}
          />
        )}
      </div>
      {saveSuccess && (
        <Toast variant="success" position="top">
          设置已成功保存
        </Toast>
      )}
      {chatError && (
        <Toast variant="error" position="top" open={!!chatError} onClose={() => setChatError(null)}>
          {chatError}
        </Toast>
      )}
    </div>
  )
}

