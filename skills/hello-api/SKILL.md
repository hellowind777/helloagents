---
name: hello-api
description: 构建、修改或审查 REST API、GraphQL 端点、webhook、中间件、请求/响应处理、API 版本管理、限流或分页时使用。
---

API 相关代码必须遵循以下规范。

## 编码前
先确定资源模型和端点契约，再写代码。

## RESTful 设计
- 资源命名：复数名词 `/users`，嵌套 `/users/:id/posts`
- HTTP 方法语义：GET 读、POST 创建、PUT 全量更新、PATCH 部分更新、DELETE 删除
- 状态码准确：200 成功、201 创建、204 无内容、400 参数错误、401 未认证、403 无权限、404 不存在、409 冲突、422 验证失败、500 服务端错误

## 请求验证
- 入参验证在 controller 层，使用 schema 验证库（zod、joi、ajv）
- 验证类型、范围、格式、必填
- 文件上传限制大小和类型
- 请求体大小限制

## 响应格式
- 统一成功响应：`{ data, meta? }`
- 统一错误响应：`{ error: { code, message, details? } }`
- 列表接口必须分页：`?page=1&limit=20` 或 cursor-based
- 支持排序：`?sort=created_at&order=desc`
- 过滤参数白名单

## 版本与保护
- API 版本化：URL 前缀 `/v1/` 或 header
- 限流保护：按 IP/用户/API key
- 超时设置：所有外部调用设超时
- CORS：明确允许的 origin，不用 `*`

## 交付检查
- [ ] 状态码准确反映操作结果
- [ ] 所有入参已验证
- [ ] 列表接口有分页
- [ ] 错误响应格式统一
- [ ] 有限流保护
