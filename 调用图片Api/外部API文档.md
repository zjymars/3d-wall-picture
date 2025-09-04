# ArcIns ImageToolkit 外部API文档

## 概述

本文档描述了ArcIns ImageToolkit系统提供的外部API接口，专门为局域网内的其他开发人员设计，用于访问历史采集的图片组和图片数据。

### 基本信息

- **API版本**: 1.0.0
- **基础URL**: `http://192.10.222.123:8001/api/v1/external`
- **数据格式**: JSON
- **字符编码**: UTF-8
- **访问权限**: 只读（Read-Only）

### 服务器信息

- **后端API服务**: `http://192.10.222.123:8001`
- **MinIO文件服务**: `http://192.10.222.123:9000`
- **MinIO管理界面**: `http://192.10.222.123:9001`

## 认证

当前版本的外部API不需要认证，可直接访问。所有接口均为只读接口，不会修改系统数据。

## 通用响应格式

### 成功响应

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "size": 20,
  "total_pages": 5,
  "has_next": true,
  "has_prev": false
}
```

### 错误响应

```json
{
  "detail": "错误描述信息"
}
```

### HTTP状态码

- `200`: 请求成功
- `404`: 资源不存在
- `422`: 请求参数错误
- `500`: 服务器内部错误

## API接口列表

### 1. 获取图片组列表

**接口地址**: `GET /image-groups`

**描述**: 获取系统中所有包含图片的图片组列表，支持分页和搜索。

**请求参数**:

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|--------|------|------|--------|------|
| page | int | 否 | 1 | 页码，从1开始 |
| size | int | 否 | 20 | 每页数量，最大100 |
| search | string | 否 | - | 搜索关键词，支持名称、描述、关键词搜索 |

**请求示例**:

```bash
GET http://192.10.222.123:8001/api/v1/external/image-groups?page=1&size=20&search=风景
```

**响应示例**:

```json
{
  "data": [
    {
      "id": 1,
      "name": "风景图片组",
      "description": "收集的各种风景图片",
      "search_keyword": "风景,自然,山水",
      "source_website": "unsplash.com",
      "image_count": 45,
      "created_at": "2024-01-15T10:30:00",
      "updated_at": "2024-01-20T15:45:00",
      "cover_image": "http://192.10.222.123:9000/images/landscape_001.jpg"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20,
  "total_pages": 1,
  "has_next": false,
  "has_prev": false
}
```

### 2. 获取图片组详情

**接口地址**: `GET /image-groups/{group_id}`

**描述**: 获取指定图片组的详细信息。

**路径参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| group_id | int | 是 | 图片组ID |

**请求示例**:

```bash
GET http://192.10.222.123:8001/api/v1/external/image-groups/1
```

**响应示例**:

```json
{
  "id": 1,
  "name": "风景图片组",
  "description": "收集的各种风景图片",
  "search_keyword": "风景,自然,山水",
  "source_website": "unsplash.com",
  "image_count": 45,
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-20T15:45:00",
  "cover_image": "http://192.10.222.123:9000/images/landscape_001.jpg"
}
```

### 3. 获取图片组中的图片列表

**接口地址**: `GET /image-groups/{group_id}/images`

**描述**: 获取指定图片组中的所有图片，支持分页。

**路径参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| group_id | int | 是 | 图片组ID |

**请求参数**:

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|--------|------|------|--------|------|
| page | int | 否 | 1 | 页码，从1开始 |
| size | int | 否 | 50 | 每页数量，最大200 |

**请求示例**:

```bash
GET http://192.10.222.123:8001/api/v1/external/image-groups/1/images?page=1&size=50
```

**响应示例**:

```json
{
  "data": [
    {
      "id": 101,
      "filename": "landscape_001.jpg",
      "minio_url": "http://192.10.222.123:9000/images/landscape_001.jpg",
      "original_url": "https://unsplash.com/photos/abc123",
      "width": 1920,
      "height": 1080,
      "file_size": 245760,
      "format": "JPEG",
      "source_website": "unsplash.com",
      "group_id": 1,
      "created_at": "2024-01-15T10:35:00"
    }
  ],
  "total": 45,
  "page": 1,
  "size": 50,
  "total_pages": 1,
  "has_next": false,
  "has_prev": false,
  "group_info": {
    "id": 1,
    "name": "风景图片组",
    "description": "收集的各种风景图片"
  }
}
```

### 4. 获取单张图片详情

**接口地址**: `GET /images/{image_id}`

**描述**: 获取单张图片的详细信息。

**路径参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| image_id | int | 是 | 图片ID |

**请求示例**:

```bash
GET http://192.10.222.123:8001/api/v1/external/images/101
```

**响应示例**:

```json
{
  "id": 101,
  "filename": "landscape_001.jpg",
  "minio_url": "http://192.10.222.123:9000/images/landscape_001.jpg",
  "original_url": "https://unsplash.com/photos/abc123",
  "width": 1920,
  "height": 1080,
  "file_size": 245760,
  "format": "JPEG",
  "source_website": "unsplash.com",
  "group_id": 1,
  "created_at": "2024-01-15T10:35:00",
  "group_info": {
    "id": 1,
    "name": "风景图片组",
    "description": "收集的各种风景图片"
  }
}
```

### 5. 获取系统统计信息

**接口地址**: `GET /stats`

**描述**: 获取系统的统计信息，包括图片组数量、图片数量等。

**请求示例**:

```bash
GET http://192.10.222.123:8001/api/v1/external/stats
```

**响应示例**:

```json
{
  "total_groups": 25,
  "total_images": 1250,
  "sources_stats": [
    {
      "source": "unsplash.com",
      "count": 800
    },
    {
      "source": "pixabay.com",
      "count": 450
    }
  ],
  "api_version": "1.0.0",
  "description": "ArcIns ImageToolkit External API"
}
```

## 数据字段说明

### 图片组字段

| 字段名 | 类型 | 描述 |
|--------|------|------|
| id | int | 图片组唯一标识 |
| name | string | 图片组名称 |
| description | string | 图片组描述 |
| search_keyword | string | 搜索关键词，逗号分隔 |
| source_website | string | 来源网站 |
| image_count | int | 图片数量 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |
| cover_image | string | 封面图片URL |

### 图片字段

| 字段名 | 类型 | 描述 |
|--------|------|------|
| id | int | 图片唯一标识 |
| filename | string | 文件名 |
| minio_url | string | MinIO存储URL（可直接访问） |
| original_url | string | 原始图片URL |
| width | int | 图片宽度（像素） |
| height | int | 图片高度（像素） |
| file_size | int | 文件大小（字节） |
| format | string | 图片格式（JPEG、PNG等） |
| source_website | string | 来源网站 |
| group_id | int | 所属图片组ID |
| created_at | datetime | 创建时间 |

## 使用注意事项

### 1. 访问限制

- 所有接口均为只读，不支持数据修改
- 仅返回已成功上传到MinIO的图片
- 支持局域网内访问，外网无法访问

### 2. 性能建议

- 建议使用分页查询，避免一次性获取大量数据
- 图片列表接口建议每页不超过100张图片
- 可以通过搜索功能精确定位需要的图片组

### 3. 图片访问

- `minio_url`字段提供的URL可以直接在浏览器中访问
- MinIO服务配置了公共读取策略，无需认证
- 图片URL格式：`http://192.10.222.123:9000/images/{filename}`

### 4. 错误处理

- 请检查HTTP状态码判断请求是否成功
- 404错误表示请求的资源不存在
- 422错误表示请求参数有误
- 500错误表示服务器内部错误，请联系管理员

## 示例代码

详细的调用示例请参考同目录下的示例脚本文件。

## 联系方式

如有问题或建议，请联系系统管理员。