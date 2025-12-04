# 🎨 Chat with GeoGebra

~~(⚠️本项目因作者找到了一周加班五天的工作而丧失了维护能力，虽然作者已经畅想出了详细的后续更新计划和宏伟的商业版图。如果您觉得您有能力让这个项目更好，请联系作者)~~

（最近闲下来了，加上总有老师希望这个项目继续完善下去，所以又回来继续做做）

使用自然语言交流，辅助绘制 GeoGebra 图像的轻量工具。

## TODO List

- [ ] 基于ast的geogebra5.2语法解析器，用于给大模型提供语法错误反馈 （working）
- [ ] 基于语法解析器的自我纠正mcp
- [ ] 上传图片直接绘图解题
- [x] 更稳定的客户端而非网页端（见Release）

## 🛠️ 项目简介

**Chat with GeoGebra** 是一个基于 **React** 构建的项目，  
通过与大语言模型（LLM）交流，让用户用自然语言描述需求，自动生成 GeoGebra 命令并实时绘图。

## 🧙‍♂️ 背景故事（中二版）

在那个充满阳光与幻梦的青春时代，作者暗恋着一位温柔而又神秘的女教师。  
她手执粉笔，绘制着世界的边界，却苦于无法驯服名为 GeoGebra 的神之工具。

面对女神的无助眼神，作者点燃了心中的烈火：  
> “即使踏碎万难，我也要为她创造一把能用语言驾驭图形的魔杖！”

数月闭关修炼，挑战 LLM，驾驭 API，召唤 Claude、ChatGPT 与 DeepSeek，  
终于，**Chat with GeoGebra** 横空出世！

然而，当迷雾散尽，少年终于明白：女神不过是凡人，她的光芒只存在于幻想之中。  
带着微笑与遗憾，作者收剑入鞘，将这份力量留给了所有需要它的人。🌌

## ✨ 功能特色

- 🧠 自然语言生成 GeoGebra 命令
- 🖼️ 自动绘制图像，实时反馈
- 🔗 支持接入多个大模型（Claude、ChatGPT、DeepSeek）
- 🌐 无需安装，直接在线访问
- 🏠 支持本地部署
- 🔑 支持自定义 API Key

## 🌍 在线体验

~~直接访问：[👉 点击这里访问网站]() 迁移中~~

## 🖼️ 预览截图

![预览图](./public/preview.jpg)  

## 🚀 快速开始（本地部署）

```bash

# 克隆仓库
git clone https://github.com/tiwe0/chat-with-geogebra.git
cd chat-with-geogebra 

# 安装依赖
pnpm install

# 运行开发环境
pnpm dev
```

 ⚡ 注意：需要自行准备 Claude、ChatGPT、DeepSeek 等服务的 API Key。

## 🧩 技术栈
- ~~Next.js~~
- React
- GeoGebra Command API
- 大语言模型接入（Claude / ChatGPT / DeepSeek）

## 📜 开源协议

本项目基于 MIT License 开源，允许自由商用。
代码版权归作者 Ivory (也就是本仓库的拥有者，虽然他的 github 账号名为 tiwe0) 所有。

## 📬 联系方式

作者：Ivory
邮箱：contact@ivory.cafe
请注明来意，因为作者的邮箱里垃圾订阅邮件很多，虽然这些邮件也不能让作者感到被关心，也不能给作者带来心灵上的温暖。
