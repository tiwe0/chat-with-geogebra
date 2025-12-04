import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// 空数组常量，用于避免在 selector 中创建新引用
const EMPTY_MESSAGES_ARRAY: Message[] = []

// 类型定义
export type ApiKeys = {
  openai?: string
  anthropic?: string
  deepseek?: string
}

export type ConfigSettings = {
  modelType: string
  apiKeys: ApiKeys
  systemPrompt: string
}

export type Conversation = {
  id: string
  title: string
}

export type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: number
}

// 默认配置
const DEFAULT_CONFIG: ConfigSettings = {
  modelType: "gpt-4o",
  apiKeys: {
    openai: "",
    anthropic: "",
    deepseek: "",
  },
  systemPrompt: `你是一个专业的数学和几何学助手，擅长使用 GeoGebra 创建几何图形、函数图像和动态动画。

# 📝 回答格式要求

## 数学公式
- **行内公式**：使用单个美元符号包裹，如 $x^2 + y^2 = r^2$
- **块级公式**：使用双美元符号包裹，居中显示
  $$\\int_a^b f(x)dx = F(b) - F(a)$$

## GeoGebra 命令
- 必须放在代码块中，使用 \`\`\`geogebra 标记：

\`\`\`geogebra
Circle((0,0), 5)
A = (3, 4)
\`\`\`

- 每行一个命令，按逻辑顺序排列
- 不要在命令后添加注释
- 用户可以点击"执行"按钮自动运行这些命令

## Markdown 支持
- 使用标题、列表、表格等组织内容
- 代码片段用反引号包裹：\`variable\`
- 链接和加粗等格式正常使用

# 🎯 回答策略

1. **清晰解释**：用通俗易懂的语言说明数学概念
2. **提供公式**：用 LaTeX 格式展示数学公式
3. **给出命令**：在 \`\`\`geogebra 代码块中提供完整命令
4. **分步骤**：复杂问题分解为多个步骤
5. **举例说明**：适当提供具体数值示例

# 📐 GeoGebra 命令参考

## 基本几何对象
- **点**：\`A = (2, 3)\` 或 \`Point(x坐标, y坐标)\`
- **向量**：\`v = Vector(A, B)\` 或 \`v = (1, 2)\`
- **线段**：\`Segment(A, B)\`
- **直线**：\`Line(A, B)\` 或 \`Line(点, 方向向量)\`
- **射线**：\`Ray(起点, 方向点)\`
- **圆**：\`Circle(圆心, 半径)\` 或 \`Circle(圆心, 圆上的点)\`
- **椭圆**：\`Ellipse(焦点1, 焦点2, 长半轴)\`
- **多边形**：\`Polygon(A, B, C, D)\`
- **正多边形**：\`RegularPolygon(顶点1, 顶点2, 边数)\`

## 函数和曲线
- **函数**：\`f(x) = x^2 + 2x + 1\`
- **参数方程**：\`Curve(x(t), y(t), t, 起始值, 结束值)\`
- **极坐标**：\`Curve(r(φ) cos(φ), r(φ) sin(φ), φ, 0, 2π)\`
- **隐函数**：\`Implicit(x^2 + y^2 = 25)\`

## 变换和测量
- **中点**：\`Midpoint(A, B)\`
- **垂直平分线**：\`PerpendicularBisector(A, B)\`
- **垂线**：\`PerpendicularLine(点, 直线)\`
- **平行线**：\`Line(点, 直线)\` (通过点平行于直线)
- **角**：\`Angle(点1, 顶点, 点2)\`
- **距离**：\`Distance(A, B)\`
- **面积**：\`Area(多边形)\`

## 动画和交互（重要！）
- **滑块**：\`a = Slider(最小值, 最大值, 增量)\`
  - 例：\`t = Slider(0, 10, 0.1)\`
- **启动动画**：\`StartAnimation(滑块, true)\`
- **停止动画**：\`StartAnimation(滑块, false)\`
- **动画速度**：\`SetAnimationSpeed(对象, 速度)\`
- **轨迹**：\`SetTrace(对象, true)\` 显示运动轨迹
- **轨迹曲线**：\`Locus(动点, 参数)\`

## 高级功能
- **序列**：\`Sequence(表达式, 变量, 起始, 终止, 步长)\`
  - 例：\`Sequence(k, k, 1, 10, 1)\` 生成 1 到 10
- **列表**：\`list = {1, 2, 3, 4, 5}\`
- **条件**：\`If(条件, 真值, 假值)\`
- **文本**：\`Text("显示的文字", (x, y))\`
- **动态文本**：\`"a = " + a\` 显示变量值

# 💡 常见场景示例

## 1. 静态几何图形
\`\`\`geogebra
A = (0, 0)
B = (4, 0)
C = (2, 3)
triangle = Polygon(A, B, C)
\`\`\`

## 2. 函数图像
\`\`\`geogebra
f(x) = sin(x)
g(x) = cos(x)
\`\`\`

## 3. 参数动画
\`\`\`geogebra
t = Slider(0, 2π, 0.01)
P = (5cos(t), 5sin(t))
Circle((0,0), 5)
StartAnimation(t, true)
\`\`\`

## 4. 动态函数
\`\`\`geogebra
a = Slider(-5, 5, 0.1)
f(x) = a*x^2
StartAnimation(a, true)
\`\`\`

# ⚠️ 重要语法规则（必须严格遵守）

## 标点符号
**❌ 错误**: 使用中文全角标点
- A=（1，2）  # 中文括号和逗号
- Line[A，B]  # 中文逗号

**✅ 正确**: 必须使用英文半角标点
- A=(1,2)     # 英文括号和逗号
- Line[A,B]   # 英文逗号

## 坐标格式
**❌ 错误**: 坐标之间缺少逗号或格式错误
- A=(1 2)     # 缺少逗号
- A=1,2)      # 缺少左括号
- A=(1,2      # 缺少右括号

**✅ 正确**: (x,y) 格式，逗号分隔，括号完整
- A=(1,2)
- B=(3.5,-2)
- C=(0,0)

## 函数定义
**❌ 错误**: 等号两侧有空格
- f(x) = sin(x)

**✅ 正确**: 等号紧贴，无空格
- f(x)=sin(x)
- g(x)=x^2+2*x-1

## 点定义
**✅ 两种正确格式**:
- A=(1,2)          # 简洁格式（推荐）
- A=Point[1,2]     # 完整格式

## 命令检查清单
生成命令前请自查:
1. ✓ 是否使用了英文括号 () 和方括号 []
2. ✓ 是否使用了英文逗号 ,
3. ✓ 坐标是否格式为 (x,y) 且逗号正确
4. ✓ 函数定义是否为 f(x)=expression（无空格）
5. ✓ 括号是否成对出现且正确闭合

# 🎯 输出格式示例

## 正确的完整示例
\`\`\`geogebra
# 定义三角形
A=(0,0)
B=(4,0)
C=(2,3)
triangle=Polygon[A,B,C]

# 计算面积
area=Area[triangle]
\`\`\`

# ⚠️ 注意事项
- 命令区分大小写
- 点名使用大写字母（A, B, C...）
- 变量使用小写字母（a, b, t...）
- π 可以用 pi 或直接写 π
- 三角函数：sin, cos, tan（括号内为弧度）
- 确保命令语法正确，否则 GeoGebra 会报错

# 🤝 互动方式
- 如果用户需求不明确，主动提出澄清问题
- 可以参考之前的对话内容理解上下文
- 鼓励用户实验和修改参数
- 提供进阶学习建议

现在，请用友好、专业的态度帮助用户探索数学和几何的奇妙世界！`,
}

// 默认对话
const DEFAULT_CONVERSATION: Conversation = {
  id: "default",
  title: "新对话",
}

// Store类型
interface AppState {
  // 配置状态
  config: ConfigSettings
  updateConfig: (config: Partial<ConfigSettings>) => void
  updateApiKey: (provider: keyof ApiKeys, key: string) => void

  // 对话状态
  conversations: Conversation[]
  activeConversationId: string
  messages: Record<string, Message[]>

  // 对话操作
  setActiveConversation: (id: string) => void
  createConversation: () => string
  deleteConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void

  // 消息操作
  addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  clearMessages: (conversationId: string) => void

  // UI状态
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  showGeogebra: boolean
  setShowGeogebra: (show: boolean) => void
}

// 创建store - 使用普通方式而不是immer中间件
export const useAppStore = create<AppState>()(
  persist<AppState>(
    (set, get) => ({
      // 配置状态
      config: DEFAULT_CONFIG,
      updateConfig: (newConfig: Partial<ConfigSettings>) =>
        set((state: AppState) => ({
          config: { ...state.config, ...newConfig },
        })),
      updateApiKey: (provider: keyof ApiKeys, key: string) =>
        set((state: AppState) => ({
          config: {
            ...state.config,
            apiKeys: {
              ...state.config.apiKeys,
              [provider]: key,
            },
          },
        })),

      // 对话状态
      conversations: [DEFAULT_CONVERSATION],
      activeConversationId: DEFAULT_CONVERSATION.id,
      messages: {
        [DEFAULT_CONVERSATION.id]: [], // 确保默认对话有消息数组
      },

      // 对话操作
      setActiveConversation: (id: string) => set({ activeConversationId: id }),
      createConversation: () => {
        const id = `conv-${Date.now()}`
        const newConversation: Conversation = { id, title: "新会话" }

        set((state: AppState) => {
          // 检查是否已经存在相同ID的对话，防止重复创建
          const existingConversation = state.conversations.find((c) => c.id === id)
          if (existingConversation) {
            return { activeConversationId: id }
          }

          return {
            conversations: [...state.conversations, newConversation],
            activeConversationId: id,
            // 确保新对话的消息列表为空
            messages: {
              ...state.messages,
              [id]: [],
            },
          }
        })

        return id
      },
      deleteConversation: (id: string) =>
        set((state: AppState) => {
          // 如果要删除的是当前活动对话，则切换到另一个对话
          let newActiveId = state.activeConversationId
          if (state.activeConversationId === id && state.conversations.length > 1) {
            const nextConv = state.conversations.find((c) => c.id !== id)
            if (nextConv) {
              newActiveId = nextConv.id
            }
          }

          // 删除对话
          const newConversations = state.conversations.filter((c) => c.id !== id)

          // 删除对话消息
          const newMessages = { ...state.messages }
          delete newMessages[id]

          // 如果没有对话，创建一个新的
          if (newConversations.length === 0) {
            const newId = `conv-${Date.now()}`
            const newConversation: Conversation = { id: newId, title: "新会话" }
            return {
              conversations: [newConversation],
              activeConversationId: newId,
              messages: newMessages,
            }
          }

          return {
            conversations: newConversations,
            activeConversationId: newActiveId,
            messages: newMessages,
          }
        }),
      updateConversationTitle: (id: string, title: string) =>
        set((state: AppState) => ({
          conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
        })),

      // 消息操作
      addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) =>
        set((state: AppState) => {
          const conversationMessages = state.messages[conversationId] || []

          const newMessage: Message = {
            ...message,
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            createdAt: Date.now(),
          }

          const newMessages = {
            ...state.messages,
            [conversationId]: [...conversationMessages, newMessage],
          }

          // 如果是第一条用户消息，更新对话标题
          let newConversations = [...state.conversations]
          if (message.role === "user" && conversationMessages.length === 0) {
            const title = message.content.slice(0, 20) + (message.content.length > 20 ? "..." : "")
            newConversations = state.conversations.map((c) => (c.id === conversationId ? { ...c, title } : c))
          }

          return {
            messages: newMessages,
            conversations: newConversations,
          }
        }),
      setMessages: (conversationId: string, messages: Message[]) =>
        set((state: AppState) => ({
          messages: {
            ...state.messages,
            [conversationId]: messages,
          },
        })),
      clearMessages: (conversationId: string) =>
        set((state: AppState) => ({
          messages: {
            ...state.messages,
            [conversationId]: [],
          },
        })),

      // UI状态
      sidebarOpen: true,
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      showGeogebra: true,
      setShowGeogebra: (show: boolean) => set({ showGeogebra: show }),
    }),
    {
      name: "llm-chat-storage",
      storage: createJSONStorage(() => {
        // 确保只在浏览器环境中访问 localStorage
        if (typeof window !== 'undefined') {
          return localStorage
        }
        // SSR 时返回一个空的 storage 实现
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      partialize: (state: AppState) => ({
        ...state,
        config: state.config,
        conversations: state.conversations,
        messages: state.messages,
        activeConversationId: state.activeConversationId,
        sidebarOpen: state.sidebarOpen,
        showGeogebra: state.showGeogebra,
      }),
    },
  ),
)

// 辅助函数，用于从useChat钩子的消息格式转换到我们的消息格式
interface ChatMessage {
  id?: string
  role: "user" | "assistant" | "system"
  content: string
}

// 导出空数组常量供外部使用
export { EMPTY_MESSAGES_ARRAY }

export function convertChatMessagesToStore(messages: ChatMessage[]): Message[] {
  if (!messages || !Array.isArray(messages)) {
    console.warn("[convertChatMessagesToStore] Invalid messages:", messages)
    return []
  }
  return messages.map((msg, index) => ({
    id: msg.id || `imported-${index}`,
    role: msg.role,
    content: msg.content,
    createdAt: Date.now() - (messages.length - index) * 1000, // 简单模拟创建时间
  }))
}

// 辅助函数，用于从我们的消息格式转换到useChat钩子的消息格式
export function convertStoreMessagesToChat(messages: Message[]): ChatMessage[] {
  if (!messages || !Array.isArray(messages)) {
    console.warn("[convertStoreMessagesToChat] Invalid messages:", messages)
    return []
  }
  return messages.map((msg) => ({
    id: msg.id || `msg-${Date.now()}-${Math.random()}`,
    role: msg.role,
    content: msg.content,
  }))
}

