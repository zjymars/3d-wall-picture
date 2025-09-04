#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ArcIns ImageToolkit 外部API调用示例 - Python版本

本脚本演示如何使用Python调用ArcIns ImageToolkit的外部API接口，
获取图片组和图片数据。

依赖库:
    pip install requests

使用方法:
    python Python调用示例.py
"""

import requests
import json
from typing import Dict, List, Optional
from datetime import datetime


class ArcInsImageToolkitAPI:
    """ArcIns ImageToolkit 外部API客户端"""
    
    def __init__(self, base_url: str = "http://192.10.222.123:8001/api/v1/external"):
        """
        初始化API客户端
        
        Args:
            base_url: API基础URL
        """
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def _make_request(self, method: str, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """
        发送HTTP请求
        
        Args:
            method: HTTP方法
            endpoint: API端点
            params: 请求参数
            
        Returns:
            响应数据
            
        Raises:
            requests.RequestException: 请求失败
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"请求失败: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json().get('detail', '未知错误')
                    print(f"错误详情: {error_detail}")
                except:
                    print(f"HTTP状态码: {e.response.status_code}")
            raise
    
    def get_image_groups(self, page: int = 1, size: int = 20, search: Optional[str] = None) -> Dict:
        """
        获取图片组列表
        
        Args:
            page: 页码，从1开始
            size: 每页数量，最大100
            search: 搜索关键词
            
        Returns:
            图片组列表数据
        """
        params = {'page': page, 'size': size}
        if search:
            params['search'] = search
            
        return self._make_request('GET', '/image-groups', params)
    
    def get_image_group(self, group_id: int) -> Dict:
        """
        获取图片组详情
        
        Args:
            group_id: 图片组ID
            
        Returns:
            图片组详细信息
        """
        return self._make_request('GET', f'/image-groups/{group_id}')
    
    def get_group_images(self, group_id: int, page: int = 1, size: int = 50) -> Dict:
        """
        获取图片组中的图片列表
        
        Args:
            group_id: 图片组ID
            page: 页码，从1开始
            size: 每页数量，最大200
            
        Returns:
            图片列表数据
        """
        params = {'page': page, 'size': size}
        return self._make_request('GET', f'/image-groups/{group_id}/images', params)
    
    def get_image(self, image_id: int) -> Dict:
        """
        获取单张图片详情
        
        Args:
            image_id: 图片ID
            
        Returns:
            图片详细信息
        """
        return self._make_request('GET', f'/images/{image_id}')
    
    def get_stats(self) -> Dict:
        """
        获取系统统计信息
        
        Returns:
            系统统计数据
        """
        return self._make_request('GET', '/stats')
    
    def download_image(self, image_url: str, save_path: str) -> bool:
        """
        下载图片到本地
        
        Args:
            image_url: 图片URL
            save_path: 保存路径
            
        Returns:
            是否下载成功
        """
        try:
            response = requests.get(image_url, stream=True)
            response.raise_for_status()
            
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"图片已保存到: {save_path}")
            return True
        except Exception as e:
            print(f"下载图片失败: {e}")
            return False


def print_separator(title: str):
    """打印分隔线"""
    print("\n" + "=" * 60)
    print(f" {title} ")
    print("=" * 60)


def format_file_size(size_bytes: int) -> str:
    """格式化文件大小"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def main():
    """主函数 - 演示API调用"""
    # 创建API客户端
    api = ArcInsImageToolkitAPI()
    
    try:
        # 1. 获取系统统计信息
        print_separator("系统统计信息")
        stats = api.get_stats()
        print(f"API版本: {stats['api_version']}")
        print(f"系统描述: {stats['description']}")
        print(f"图片组总数: {stats['total_groups']}")
        print(f"图片总数: {stats['total_images']}")
        
        if stats['sources_stats']:
            print("\n来源网站统计:")
            for source in stats['sources_stats']:
                print(f"  - {source['source']}: {source['count']} 张图片")
        
        # 2. 获取图片组列表
        print_separator("图片组列表")
        groups_response = api.get_image_groups(page=1, size=5)
        
        print(f"总共 {groups_response['total']} 个图片组")
        print(f"当前第 {groups_response['page']} 页，共 {groups_response['total_pages']} 页")
        
        if groups_response['data']:
            print("\n图片组列表:")
            for group in groups_response['data']:
                print(f"\n  ID: {group['id']}")
                print(f"  名称: {group['name']}")
                print(f"  描述: {group['description']}")
                print(f"  关键词: {group['search_keyword']}")
                print(f"  来源: {group['source_website']}")
                print(f"  图片数量: {group['image_count']}")
                print(f"  创建时间: {group['created_at']}")
                if group['cover_image']:
                    print(f"  封面图片: {group['cover_image']}")
        
        # 3. 获取第一个图片组的详细信息
        if groups_response['data']:
            first_group = groups_response['data'][0]
            group_id = first_group['id']
            
            print_separator(f"图片组详情 - {first_group['name']}")
            group_detail = api.get_image_group(group_id)
            
            print(f"图片组ID: {group_detail['id']}")
            print(f"名称: {group_detail['name']}")
            print(f"描述: {group_detail['description']}")
            print(f"搜索关键词: {group_detail['search_keyword']}")
            print(f"来源网站: {group_detail['source_website']}")
            print(f"图片数量: {group_detail['image_count']}")
            print(f"创建时间: {group_detail['created_at']}")
            print(f"更新时间: {group_detail['updated_at']}")
            
            # 4. 获取该图片组中的图片列表
            print_separator(f"图片列表 - {first_group['name']}")
            images_response = api.get_group_images(group_id, page=1, size=3)
            
            print(f"该组共有 {images_response['total']} 张图片")
            print(f"当前第 {images_response['page']} 页，共 {images_response['total_pages']} 页")
            
            if images_response['data']:
                print("\n图片列表:")
                for image in images_response['data']:
                    print(f"\n  图片ID: {image['id']}")
                    print(f"  文件名: {image['filename']}")
                    print(f"  尺寸: {image['width']} x {image['height']}")
                    print(f"  文件大小: {format_file_size(image['file_size'])}")
                    print(f"  格式: {image['format']}")
                    print(f"  MinIO URL: {image['minio_url']}")
                    print(f"  原始URL: {image['original_url']}")
                    print(f"  来源网站: {image['source_website']}")
                    print(f"  创建时间: {image['created_at']}")
                
                # 5. 获取第一张图片的详细信息
                first_image = images_response['data'][0]
                image_id = first_image['id']
                
                print_separator(f"图片详情 - {first_image['filename']}")
                image_detail = api.get_image(image_id)
                
                print(f"图片ID: {image_detail['id']}")
                print(f"文件名: {image_detail['filename']}")
                print(f"尺寸: {image_detail['width']} x {image_detail['height']}")
                print(f"文件大小: {format_file_size(image_detail['file_size'])}")
                print(f"格式: {image_detail['format']}")
                print(f"MinIO URL: {image_detail['minio_url']}")
                print(f"原始URL: {image_detail['original_url']}")
                print(f"来源网站: {image_detail['source_website']}")
                print(f"所属图片组: {image_detail['group_info']['name']}")
                print(f"创建时间: {image_detail['created_at']}")
                
                # 6. 演示图片下载（可选）
                print_separator("图片下载演示")
                print(f"图片URL: {image_detail['minio_url']}")
                print("提示: 您可以直接在浏览器中访问上述URL查看图片")
                print("或者使用 api.download_image() 方法下载到本地")
                
                # 取消注释下面的代码来实际下载图片
                # download_path = f"downloaded_{image_detail['filename']}"
                # if api.download_image(image_detail['minio_url'], download_path):
                #     print(f"图片已下载到: {download_path}")
        
        # 7. 演示搜索功能
        print_separator("搜索演示")
        search_keyword = "风景"  # 可以修改为其他关键词
        search_results = api.get_image_groups(page=1, size=10, search=search_keyword)
        
        print(f"搜索关键词: '{search_keyword}'")
        print(f"找到 {search_results['total']} 个相关图片组")
        
        if search_results['data']:
            print("\n搜索结果:")
            for group in search_results['data']:
                print(f"  - {group['name']} ({group['image_count']} 张图片)")
        else:
            print("未找到相关图片组")
        
        print_separator("演示完成")
        print("所有API调用演示已完成！")
        print("\n您可以修改本脚本中的参数来测试不同的功能：")
        print("- 修改页码和每页数量")
        print("- 修改搜索关键词")
        print("- 取消注释图片下载代码")
        print("- 添加错误处理和重试逻辑")
        
    except requests.RequestException as e:
        print(f"\n❌ API调用失败: {e}")
        print("\n请检查:")
        print("1. 服务器是否正在运行")
        print("2. 网络连接是否正常")
        print("3. API地址是否正确")
    except Exception as e:
        print(f"\n❌ 程序执行出错: {e}")


if __name__ == "__main__":
    main()