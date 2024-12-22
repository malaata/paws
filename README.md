# 自动完成 Paws 任务机器人

此脚本可自动完成任务、领取奖励，并更新用户账户余额。

注册链接： [点击注册](https://t.me/PAWSOG_bot/PAWS?startapp=C308agCW)

---

## **功能介绍**
- 身份认证并获取账户余额。
- 获取每个用户的可用任务，并完成可以领取奖励的任务。
- 自动领取已完成任务的奖励。
- 模拟人工操作的随机延迟。
- 每 24 小时定时自动执行。

---

## **运行环境**
- Node.js (v12 及以上版本)
- npm 或 yarn 包管理工具

---

## **安装步骤**

### 1. 克隆项目并进入文件夹：
```bash
git https://github.com/ziqing888/paws-bot/.git
cd paws-bot
```
### 2. 安装所需依赖：
```
npm install
```
 准备数据文件：
在项目根目录下创建以下文件：

hash.txt： 每行包含一个 query_id（支持 JSON 格式或纯文本）。

示例：
hash.txt 示例内容：
```
"query_id_1"
"query_id_2"
```
使用以下命令启动脚本：
```
node index.js
```
