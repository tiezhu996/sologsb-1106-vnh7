# 木版年画刻版工序档案

## 项目简介

面向木版年画作坊的纯前端工序档案应用。它把画稿、分版、刻版、修版与套色印制过程串成可追溯的本地记录，便于刻工与印制管事按套色序号协作。

## Docker 一键启动

首次启动先复制环境配置，再构建并启动容器：

```bash
cp .env.example .env && docker compose up -d --build
```

停止服务可执行：

```bash
docker compose down
```

## 技术栈

| 层级 | 方案 |
| --- | --- |
| 界面框架 | Svelte 5（runes 模式） |
| 类型系统 | TypeScript（strict） |
| 构建工具 | Vite 5 |
| 状态管理 | Svelte store |
| 页面路由 | svelte-spa-router 4（history 模式） |
| 本地数据 | IndexedDB + Dexie 4 |
| 容器服务 | Nginx alpine |

## 访问地址

服务启动后访问：

```text
http://localhost:21806
```

## 本地开发方式

```bash
cd frontend
npm install
npm run dev
```

类型与组件检查：

```bash
cd frontend
npm run check
```

工分记账规则与数据库迁移的回归验证（在 Node 中跑，不依赖浏览器）：

```bash
cd frontend
npm run verify
```

## 目录结构

```text
.
├── docker-compose.yml
├── .env.example
├── README.md
└── frontend
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── scripts/            # 工分规则与迁移的 Node 验证脚本
    └── src
        ├── components/common/  # 色块、阶段轨道、空态、序号输入
        ├── hooks/              # 版片顺序与刻工负荷派生逻辑
        ├── pages/              # 六个业务页面
        ├── router/             # SPA 路由映射
        ├── stores/             # 画稿、版片、刻工、工分状态
        ├── types/              # 业务模型与具名联合类型
        └── utils/              # Dexie、序号校验、工分计档、JSON/CSV 导出
```

## 数据存储说明

数据全部写入浏览器 IndexedDB，不依赖后端服务。数据库名为 `gbwoodprint-db`，当前结构版本为 `3`。

- `version(1)` 建立画稿、版片、刻工、印制批次、工序节点五张表及常用查询索引。
- `version(2)` 为各表回填 `schemaRev: 2`，便于后续迁移识别数据结构。
- `version(3)` 新建 `workPoints` 工分表，并为版片回填 `sizeTier` 幅面档位（老数据默认中幅）。
- 首次创建数据库时通过 Dexie 的 `populate` 回调写入四类画稿、完整基础版片、四名刻工、印制批次、多条工序节点与若干历史工分。
- 刷新页面不会丢失数据；清除浏览器站点数据会同时清除本地档案。

## 工分记账规则

- 版片按幅面分小幅、中幅、大幅三档，分别记 1、2、3 分；学徒接活按半档计。
- 刻工在版片编排台把版标成刻成时，按当时档位给本人记一笔当月工分；同一块版在账期间重复标刻成只算一笔。
- 版片退回在刻时撤销在账那一笔；之后再次刻成按新的一笔重记。
- 幅面档位中途改动时，当月那笔在账工分跟着按新档位重算，往月已结的账不受影响。
- 未指派刻工的版片不能标刻成，工分必须记到本人名下。

## 核心功能与路由表

| 路由 | 页面 | 主要能力 |
| --- | --- | --- |
| `/drafts` | 画稿总览 | 按题材与状态筛选，查看版片刻成进度和最近印制批次，内联新建画稿并定幅面档位 |
| `/drafts/:id/blocks` | 版片编排台 | 按套色序号排列表格，指派刻工、校验序号、调幅面档位、标记刻成记工分、退回在刻撤账并记录崩口 |
| `/blocks/:id/nodes` | 工序节点时间线 | 推进或回退工序节点，登记操作人、时间与耗时 |
| `/batches` | 印制批次登记 | 登记纸张、颜料、印数，并逐版填写套色偏差 |
| `/carvers` | 刻工档与版片分布 | 按专长筛选，查看在刻版片数、节点平均耗时、当月工分与当班分布 |
| `/settlement` | 工分结算 | 按月份查看逐笔账目与按人汇总，可导出 JSON 结算单或 CSV |
| 其它 | 画稿总览 | 已实现 history 路由到画稿总览的回退 |
