# ArcIns ImageToolkit 外部API文档

## 概述

本目录包含ArcIns ImageToolkit系统的外部API文档和调用示例，专门为局域网内的其他开发人员设计，用于访问历史采集的图片组和图片数据。

## 文件说明

### 📖 文档文件

- **[外部API文档.md](./外部API文档.md)** - 完整的API接口文档
  - API概述和基本信息
  - 所有接口的详细说明
  - 请求参数和响应格式
  - 数据字段说明
  - 使用注意事项

### 💻 示例代码

- **[Python调用示例.py](./Python调用示例.py)** - Python版本的API调用示例
  - 完整的API客户端类
  - 所有接口的调用演示
  - 错误处理和重试逻辑
  - 图片下载功能

- **[JavaScript调用示例.js](./JavaScript调用示例.js)** - JavaScript版本的API调用示例
  - 支持Node.js和浏览器环境
  - 现代JavaScript语法（async/await）
  - 完整的API客户端类
  - 浏览器中的图片下载功能

- **[cURL调用示例.sh](./cURL调用示例.sh)** - cURL命令行示例
  - 所有API接口的cURL命令
  - 错误处理和性能测试
  - 常用命令集合
  - 可直接执行的Shell脚本

## 快速开始

### 1. 服务器信息

- **后端API服务**: `http://192.10.222.123:8001`
- **外部API基础URL**: `http://192.10.222.123:8001/api/v1/external`
- **MinIO文件服务**: `http://192.10.222.123:9000`
- **MinIO管理界面**: `http://192.10.222.123:9001`

### 2. 基本测试

使用cURL快速测试API是否可用：

```bash
# 测试服务器连接
curl http://192.10.222.123:8001/api/v1/external/stats

# 获取图片组列表
curl "http://192.10.222.123:8001/api/v1/external/image-groups?page=1&size=5"
```

### 3. 选择合适的示例

根据您的开发环境选择合适的示例：

- **Python开发者**: 使用 `Python调用示例.py`
- **JavaScript/Node.js开发者**: 使用 `JavaScript调用示例.js`
- **Shell脚本/命令行**: 使用 `cURL调用示例.sh`
- **其他语言**: 参考API文档和cURL示例

## API接口概览

### 核心接口

| 接口 | 方法 | 路径 | 描述 |
|------|------|------|------|
| 系统统计 | GET | `/stats` | 获取系统统计信息 |
| 图片组列表 | GET | `/image-groups` | 获取图片组列表（支持分页和搜索） |
| 图片组详情 | GET | `/image-groups/{id}` | 获取指定图片组详情 |
| 图片列表 | GET | `/image-groups/{id}/images` | 获取图片组中的图片列表 |
| 图片详情 | GET | `/images/{id}` | 获取单张图片详情 |

### 特性

- ✅ **只读访问** - 所有接口均为只读，不会修改数据
- ✅ **分页支持** - 支持分页查询，避免大量数据传输
- ✅ **搜索功能** - 支持按关键词搜索图片组
- ✅ **直接访问** - 图片URL可直接在浏览器中访问
- ✅ **无需认证** - 当前版本无需认证即可访问
- ✅ **JSON格式** - 统一使用JSON格式传输数据

## 使用示例

### Python示例

```python
from Python调用示例 import ArcInsImageToolkitAPI

# 创建API客户端
api = ArcInsImageToolkitAPI()

# 获取系统统计
stats = api.get_stats()
print(f"总共有 {stats['total_groups']} 个图片组，{stats['total_images']} 张图片")

# 获取图片组列表
groups = api.get_image_groups(page=1, size=10)
for group in groups['data']:
    print(f"图片组: {group['name']} ({group['image_count']} 张图片)")
```

### JavaScript示例

```javascript
const ArcInsImageToolkitAPI = require('./JavaScript调用示例.js');

// 创建API客户端
const api = new ArcInsImageToolkitAPI();

// 获取图片组列表
api.getImageGroups(1, 10).then(groups => {
    console.log(`找到 ${groups.total} 个图片组`);
    groups.data.forEach(group => {
        console.log(`- ${group.name}: ${group.image_count} 张图片`);
    });
});
```

### cURL示例

```bash
# 获取系统统计
curl -H "Accept: application/json" \
  "http://192.10.222.123:8001/api/v1/external/stats"

# 搜索图片组
curl -H "Accept: application/json" \
  "http://192.10.222.123:8001/api/v1/external/image-groups?search=风景&page=1&size=10"
```

## 常见问题

### Q: 如何获取图片的实际文件？

A: 每张图片都有一个 `minio_url` 字段，这是可以直接访问的图片URL。您可以：
1. 直接在浏览器中打开URL查看图片
2. 使用HTTP客户端下载图片文件
3. 在网页中使用 `<img>` 标签显示图片

### Q: API有访问频率限制吗？

A: 当前版本没有严格的频率限制，但建议：
- 合理使用分页，避免一次性获取大量数据
- 不要过于频繁地调用API
- 在生产环境中添加适当的延迟和重试逻辑

### Q: 如何处理网络错误？

A: 建议实现以下错误处理策略：
1. 检查HTTP状态码
2. 解析错误响应中的 `detail` 字段
3. 实现重试机制（建议最多重试3次）
4. 添加超时设置

### Q: 可以修改或删除数据吗？

A: 不可以。外部API只提供只读访问，无法修改、添加或删除任何数据。这是为了保护系统数据的完整性。

### Q: 如何获取最新的数据？

A: API返回的都是实时数据。如果系统中添加了新的图片组或图片，API会立即反映这些变化。

## 技术支持

### 错误排查

1. **连接失败**
   - 检查服务器是否运行：`curl http://192.10.222.123:8001/api/v1/external/stats`
   - 检查网络连接
   - 确认IP地址和端口正确

2. **404错误**
   - 检查API路径是否正确
   - 确认请求的资源ID是否存在

3. **422错误**
   - 检查请求参数是否符合要求
   - 确认分页参数在有效范围内

4. **500错误**
   - 服务器内部错误，请联系系统管理员

### 性能优化建议

1. **分页使用**
   - 图片组列表：建议每页20-50条
   - 图片列表：建议每页50-100张

2. **缓存策略**
   - 统计信息可以缓存较长时间
   - 图片组信息变化不频繁，可适当缓存
   - 图片URL可以长期缓存

3. **并发控制**
   - 避免同时发起过多请求
   - 使用连接池复用HTTP连接

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 提供基础的只读API接口
- 支持图片组和图片数据访问
- 提供完整的文档和示例代码

## 联系方式

如有问题或建议，请联系系统管理员。

---

**注意**: 本API仅供局域网内部使用，请勿在公网环境中暴露这些接口。