import os
import re


def replace_in_markdown_files(directory):
    """
    在指定目录及其子目录中查找所有markdown文件，
    并将其中的"gather"替换为"aligned"
    """
    # 获取目录下所有的.md文件
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(".md"):
                file_path = os.path.join(root, file)

                # 读取文件内容
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # 替换 "gather" 为 "aligned"
                # 使用正则表达式进行替换，保持大小写敏感
                updated_content = re.sub(r"\baligned\b", "gathered", content)

                # 如果内容发生了变化，写回文件
                if content != updated_content:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(updated_content)
                    print(f"已更新: {file_path}")
                else:
                    print(f"无变化: {file_path}")


if __name__ == "__main__":
    # 设置public目录路径
    script_dir = os.path.dirname(
        os.path.abspath(__file__)
    )  # 获取当前脚本所在的目录 (scripts/)
    project_root = os.path.dirname(script_dir)  # 获取项目根目录 (WebsiteNote/)
    public_dir = os.path.join(
        project_root, "frontend", "public"
    )  # 构建到public目录的路径

    if os.path.exists(public_dir):
        replace_in_markdown_files(public_dir)
        print("替换完成！")
    else:
        print(f"目录不存在: {public_dir}")
