import os
import glob
import re


def process_markdown_files(root_dir):
    """
    在指定目录及其子目录中的所有 Markdown 文件中，
    将包含大小信息的标准 Markdown 图片链接 ![注释](路径 =大小) 替换为 ![注释|大小](路径)
    """
    # 查找所有 .md 文件
    pattern = os.path.join(root_dir, "**", "*.md")
    md_files = glob.glob(pattern, recursive=True)

    print(f"找到 {len(md_files)} 个 Markdown 文件")

    # 处理每个文件
    for file_path in md_files:
        try:
            # 读取文件内容
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 定义匹配带大小信息的 Markdown 图片链接的正则表达式
            # 匹配 ![注释](路径 =大小) 格式
            markdown_img_pattern = (
                r"!\[([^\]]*)\]\(([^)]*?)\s*=(\d+(?:\s*x\s*\d+)?)\s*\)"
            )

            def replace_image_link(match):
                full_match = match.group(0)
                alt_text = match.group(1)  # 注释部分
                link_path = match.group(2)  # 路径部分
                size_info = match.group(3).replace(" ", "")  # 大小信息，去除空格

                # 构造新的 Markdown 图片链接格式
                return f"![{alt_text}|{size_info}]({link_path.strip()})"

            # 替换所有匹配的图片链接
            processed_content = re.sub(
                markdown_img_pattern, replace_image_link, content
            )

            # 写回文件（只有在内容发生变化时才写入）
            if processed_content != content:
                with open(file_path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(processed_content)
                print(f"已处理: {os.path.relpath(file_path, root_dir)}")
            else:
                print(f"无需更改: {os.path.relpath(file_path, root_dir)}")

        except Exception as e:
            print(f"处理文件 {file_path} 时出错: {str(e)}")

    print("所有文件处理完成!")


if __name__ == "__main__":
    # 获取脚本所在目录作为根目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, "public")

    if not os.path.exists(public_dir):
        print(f"错误: 找不到目录 {public_dir}")
        exit(1)

    print(
        "正在处理 Markdown 文件，将 ![注释](路径 =大小) 转换为 ![注释|大小](路径) 格式..."
    )
    process_markdown_files(public_dir)
