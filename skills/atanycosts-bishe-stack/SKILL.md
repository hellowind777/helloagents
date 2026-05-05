---
name: atanycosts-bishe-stack
description: Atanycosts 毕设实现规范。面向 Java + MyBatis/MyBatis-Plus + 前端的毕设场景，要求职责分层、数据库真源、无 JPA、无 Java 默认数据初始化。
---

# Atanycosts 毕设实现规范

这个 skill 只在 **用户明确说明“这是毕设”** 时激活。
它不负责重新设计 HelloAGENTS 命令层，而是给毕设类实现任务附加一套稳定的技术与交付约束。

## 何时激活

- 用户明确说“这是毕设”
- 用户在毕设场景下要求新增实体、接口、页面或模块
- 用户显式调用 `/atanycosts-bishe-stack`

## 后端硬约束

### 技术选型

- ORM 只用 **MyBatis 或 MyBatis-Plus**
- **禁止 JPA / Hibernate / Spring Data JPA**
- `application.yml` 保持纯静态值，**禁止 `${ENV_VAR:default}`**

### 分层方式

按职责分层，不按域堆目录：

```text
mapper/
service/
service/impl/
controller/
model/entity/
model/dto/
model/vo/
```

约束：

- 一表一实体
- DTO / VO 尽量少而复用
- 不把 mapper、service、controller 混在同一业务目录里

### 数据与初始化

- 默认数据必须走数据库，不写 Java 初始化逻辑
- 禁止 `@PostConstruct`、`ApplicationRunner` 一类业务种子数据初始化
- 演示数据、测试数据、初始账号都通过 SQL 或现有导入链路处理

### SQL 变更

涉及 schema 或数据调整时：

- 先生成 UTF-8 无 BOM `.sql`
- 不通过 shell 管道或 here-string 直喂数据库
- 容器数据库优先走 `docker cp + docker exec ... -f`
- PostgreSQL 先设置 `client_encoding='UTF8'`
- 执行后补编码与结果验收

## 前端硬约束

- 默认按 **PC 网站** 处理，除非用户明确要求移动端
- 不在前端写死默认业务数据
- 不写死后端 URL
- 所有数据走后端接口
- 视觉和组件策略遵循 `hello-ui`
- 工程化验收遵循 `atanycosts-frontend-guard`

## 生成与实现偏好

当毕设功能需求已经明确时：

- 直接按数据库表、entity、mapper、service、controller、DTO、VO、前端页面这一链路实现
- 不额外制造无用抽象层
- 新增或改动接口时，同步考虑前端 payload、权限、校验与返回结构
- 如果功能明显跨模块或需求仍不清晰，优先回到现有 `~plan` 主流程做方案澄清

## 审查重点

- 有没有偷偷用了 JPA
- 有没有把默认数据塞进 Java 代码
- 有没有一表多实体或模型爆炸
- 有没有把环境变量写进 `application.yml`
- 有没有前端写死后端地址或演示数据

## 协同关系

- 代码质量守门：`atanycosts-code-guard`
- 重构清理：`atanycosts-refactor-clean`
- 前端落地：`atanycosts-frontend-guard` + `hello-ui`
- 测试与收尾：沿用 HelloAGENTS 现有 `hello-test`、`hello-review`、`hello-verify`
