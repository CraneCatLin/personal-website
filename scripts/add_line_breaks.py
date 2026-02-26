#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import glob


def process_markdown_files(root_dir):
    """
    在指定目录及其子目录中的所有 Markdown 文件的每行末尾添加两个空格（如果尚未存在）
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

            # 分割成行
            lines = content.splitlines()

            # 在每行末尾添加两个空格（如果尚未存在）
            processed_lines = []
            for i, line in enumerate(lines):
                # 如果是最后一行且为空行，则不添加空格
                if i == len(lines) - 1 and line.strip() == "":
                    processed_lines.append(line)
                else:
                    # 检查行末是否已经以两个空格结尾
                    if not line.endswith("  "):
                        # 添加两个空格到行尾
                        processed_lines.append(line + "  ")
                    else:
                        # 已经有兩個空格，保持原樣
                        processed_lines.append(line)

            # 重新组合内容
            processed_content = "\n".join(processed_lines)

            # 写回文件
            with open(file_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(processed_content)

            print(f"已处理: {os.path.relpath(file_path, root_dir)}")

        except Exception as e:
            print(f"处理文件 {file_path} 时出错: {str(e)}")

    print("所有文件处理完成!")


if __name__ == "__main__":
    # 获取脚本所在目录的父目录，然后进入 frontend/public
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(script_dir)  # 上一级目录
    frontend_public_dir = os.path.join(parent_dir, "frontend", "public")

    if not os.path.exists(frontend_public_dir):
        print(f"错误: 找不到目录 {frontend_public_dir}")
        exit(1)

    print("正在处理 Markdown 文件，在每行末尾添加两个空格（如果尚未存在）...")
    process_markdown_files(frontend_public_dir)
