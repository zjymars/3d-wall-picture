#!/bin/bash

# ArcIns ImageToolkit 外部API调用示例 - cURL版本
#
# 本脚本演示如何使用cURL命令调用ArcIns ImageToolkit的外部API接口，
# 获取图片组和图片数据。
#
# 使用方法:
#   chmod +x cURL调用示例.sh
#   ./cURL调用示例.sh
#
# 或者直接复制其中的cURL命令在终端中执行

# API基础配置
BASE_URL="http://192.10.222.123:8001/api/v1/external"
HEADERS="-H 'Content-Type: application/json' -H 'Accept: application/json'"

# 颜色输出函数
print_header() {
    echo -e "\n\033[1;34m=== $1 ===\033[0m"
}

print_success() {
    echo -e "\033[1;32m✓ $1\033[0m"
}

print_error() {
    echo -e "\033[1;31m✗ $1\033[0m"
}

print_info() {
    echo -e "\033[1;33m→ $1\033[0m"
}

# 检查服务器连接
check_server() {
    print_header "检查服务器连接"
    
    if curl -s --connect-timeout 5 "$BASE_URL/stats" > /dev/null; then
        print_success "服务器连接正常"
        return 0
    else
        print_error "无法连接到服务器: $BASE_URL"
        print_info "请确保:"
        echo "  1. 后端服务正在运行"
        echo "  2. 网络连接正常"
        echo "  3. API地址正确"
        return 1
    fi
}

# 1. 获取系统统计信息
get_stats() {
    print_header "获取系统统计信息"
    
    print_info "请求: GET $BASE_URL/stats"
    
    response=$(curl -s $HEADERS "$BASE_URL/stats")
    
    if [ $? -eq 0 ]; then
        print_success "获取统计信息成功"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        print_error "获取统计信息失败"
    fi
}

# 2. 获取图片组列表
get_image_groups() {
    print_header "获取图片组列表"
    
    # 基本查询
    print_info "请求: GET $BASE_URL/image-groups?page=1&size=5"
    
    response=$(curl -s $HEADERS "$BASE_URL/image-groups?page=1&size=5")
    
    if [ $? -eq 0 ]; then
        print_success "获取图片组列表成功"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
        
        # 提取第一个图片组ID供后续使用
        FIRST_GROUP_ID=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data'][0]['id'] if data.get('data') else '')" 2>/dev/null)
        
        if [ -n "$FIRST_GROUP_ID" ]; then
            echo -e "\n提取到第一个图片组ID: $FIRST_GROUP_ID"
        fi
    else
        print_error "获取图片组列表失败"
    fi
}

# 3. 搜索图片组
search_image_groups() {
    print_header "搜索图片组"
    
    local search_keyword="风景"
    print_info "请求: GET $BASE_URL/image-groups?search=$search_keyword"
    
    response=$(curl -s $HEADERS "$BASE_URL/image-groups?search=$search_keyword")
    
    if [ $? -eq 0 ]; then
        print_success "搜索图片组成功"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        print_error "搜索图片组失败"
    fi
}

# 4. 获取图片组详情
get_image_group_detail() {
    if [ -z "$FIRST_GROUP_ID" ]; then
        print_error "没有可用的图片组ID，跳过获取详情"
        return
    fi
    
    print_header "获取图片组详情"
    
    print_info "请求: GET $BASE_URL/image-groups/$FIRST_GROUP_ID"
    
    response=$(curl -s $HEADERS "$BASE_URL/image-groups/$FIRST_GROUP_ID")
    
    if [ $? -eq 0 ]; then
        print_success "获取图片组详情成功"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        print_error "获取图片组详情失败"
    fi
}

# 5. 获取图片组中的图片列表
get_group_images() {
    if [ -z "$FIRST_GROUP_ID" ]; then
        print_error "没有可用的图片组ID，跳过获取图片列表"
        return
    fi
    
    print_header "获取图片组中的图片列表"
    
    print_info "请求: GET $BASE_URL/image-groups/$FIRST_GROUP_ID/images?page=1&size=3"
    
    response=$(curl -s $HEADERS "$BASE_URL/image-groups/$FIRST_GROUP_ID/images?page=1&size=3")
    
    if [ $? -eq 0 ]; then
        print_success "获取图片列表成功"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
        
        # 提取第一张图片ID供后续使用
        FIRST_IMAGE_ID=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data'][0]['id'] if data.get('data') else '')" 2>/dev/null)
        
        if [ -n "$FIRST_IMAGE_ID" ]; then
            echo -e "\n提取到第一张图片ID: $FIRST_IMAGE_ID"
        fi
    else
        print_error "获取图片列表失败"
    fi
}

# 6. 获取单张图片详情
get_image_detail() {
    if [ -z "$FIRST_IMAGE_ID" ]; then
        print_error "没有可用的图片ID，跳过获取图片详情"
        return
    fi
    
    print_header "获取单张图片详情"
    
    print_info "请求: GET $BASE_URL/images/$FIRST_IMAGE_ID"
    
    response=$(curl -s $HEADERS "$BASE_URL/images/$FIRST_IMAGE_ID")
    
    if [ $? -eq 0 ]; then
        print_success "获取图片详情成功"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
        
        # 提取图片URL
        IMAGE_URL=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('minio_url', ''))" 2>/dev/null)
        
        if [ -n "$IMAGE_URL" ]; then
            echo -e "\n图片URL: $IMAGE_URL"
        fi
    else
        print_error "获取图片详情失败"
    fi
}

# 7. 下载图片示例
download_image_example() {
    if [ -z "$IMAGE_URL" ]; then
        print_error "没有可用的图片URL，跳过下载示例"
        return
    fi
    
    print_header "图片下载示例"
    
    print_info "图片URL: $IMAGE_URL"
    print_info "下载命令示例:"
    echo "curl -o 'downloaded_image.jpg' '$IMAGE_URL'"
    
    # 实际下载（可选，取消注释以执行）
    # print_info "开始下载图片..."
    # if curl -o "downloaded_image.jpg" "$IMAGE_URL"; then
    #     print_success "图片下载成功: downloaded_image.jpg"
    # else
    #     print_error "图片下载失败"
    # fi
}

# 8. 错误处理示例
error_handling_examples() {
    print_header "错误处理示例"
    
    # 测试不存在的图片组
    print_info "测试不存在的图片组 (ID: 99999)"
    response=$(curl -s -w "HTTP_CODE:%{http_code}" $HEADERS "$BASE_URL/image-groups/99999")
    http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed 's/HTTP_CODE:[0-9]*$//')
    
    echo "HTTP状态码: $http_code"
    if [ "$http_code" = "404" ]; then
        print_success "正确返回404错误"
        echo "响应内容: $response_body"
    else
        print_error "未返回预期的404错误"
    fi
    
    # 测试无效参数
    print_info "测试无效参数 (page=0)"
    response=$(curl -s -w "HTTP_CODE:%{http_code}" $HEADERS "$BASE_URL/image-groups?page=0")
    http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed 's/HTTP_CODE:[0-9]*$//')
    
    echo "HTTP状态码: $http_code"
    if [ "$http_code" = "422" ]; then
        print_success "正确返回422参数错误"
        echo "响应内容: $response_body"
    else
        print_info "返回状态码: $http_code"
        echo "响应内容: $response_body"
    fi
}

# 9. 性能测试示例
performance_test() {
    print_header "性能测试示例"
    
    print_info "测试API响应时间..."
    
    # 测试统计接口响应时间
    start_time=$(date +%s%N)
    curl -s $HEADERS "$BASE_URL/stats" > /dev/null
    end_time=$(date +%s%N)
    duration=$((($end_time - $start_time) / 1000000))
    
    print_success "统计接口响应时间: ${duration}ms"
    
    # 测试图片组列表接口响应时间
    start_time=$(date +%s%N)
    curl -s $HEADERS "$BASE_URL/image-groups?page=1&size=10" > /dev/null
    end_time=$(date +%s%N)
    duration=$((($end_time - $start_time) / 1000000))
    
    print_success "图片组列表接口响应时间: ${duration}ms"
}

# 10. 常用cURL命令集合
show_curl_commands() {
    print_header "常用cURL命令集合"
    
    echo "# 1. 获取系统统计信息"
    echo "curl -X GET '$BASE_URL/stats' \\"
    echo "  -H 'Accept: application/json'"
    echo ""
    
    echo "# 2. 获取图片组列表（分页）"
    echo "curl -X GET '$BASE_URL/image-groups?page=1&size=20' \\"
    echo "  -H 'Accept: application/json'"
    echo ""
    
    echo "# 3. 搜索图片组"
    echo "curl -X GET '$BASE_URL/image-groups?search=风景&page=1&size=10' \\"
    echo "  -H 'Accept: application/json'"
    echo ""
    
    echo "# 4. 获取指定图片组详情"
    echo "curl -X GET '$BASE_URL/image-groups/1' \\"
    echo "  -H 'Accept: application/json'"
    echo ""
    
    echo "# 5. 获取图片组中的图片列表"
    echo "curl -X GET '$BASE_URL/image-groups/1/images?page=1&size=50' \\"
    echo "  -H 'Accept: application/json'"
    echo ""
    
    echo "# 6. 获取单张图片详情"
    echo "curl -X GET '$BASE_URL/images/101' \\"
    echo "  -H 'Accept: application/json'"
    echo ""
    
    echo "# 7. 下载图片"
    echo "curl -o 'image.jpg' 'http://192.10.222.123:9000/images/filename.jpg'"
    echo ""
    
    echo "# 8. 获取响应头信息"
    echo "curl -I '$BASE_URL/stats'"
    echo ""
    
    echo "# 9. 详细输出（包含请求和响应头）"
    echo "curl -v '$BASE_URL/stats'"
    echo ""
    
    echo "# 10. 静默模式但显示错误"
    echo "curl -sS '$BASE_URL/stats'"
}

# 主函数
main() {
    echo "ArcIns ImageToolkit 外部API cURL调用示例"
    echo "========================================"
    
    # 检查依赖
    if ! command -v curl &> /dev/null; then
        print_error "curl 命令未找到，请先安装 curl"
        exit 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        print_info "python3 未找到，JSON格式化将不可用"
    fi
    
    # 检查服务器连接
    if ! check_server; then
        exit 1
    fi
    
    # 执行API调用演示
    get_stats
    get_image_groups
    search_image_groups
    get_image_group_detail
    get_group_images
    get_image_detail
    download_image_example
    error_handling_examples
    performance_test
    show_curl_commands
    
    print_header "演示完成"
    print_success "所有API调用演示已完成！"
    echo ""
    print_info "您可以:"
    echo "  1. 修改脚本中的参数来测试不同功能"
    echo "  2. 复制上面的cURL命令直接使用"
    echo "  3. 根据需要添加更多的错误处理"
    echo "  4. 集成到您的自动化脚本中"
}

# 如果脚本被直接执行
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi