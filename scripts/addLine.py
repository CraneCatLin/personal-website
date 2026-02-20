# scripts/check_formula_spacing.py
import os
import re


def check_and_fix_markdown_formulas(directory_path):
    """
    检查指定目录下的所有 Markdown 文件，确保 $$...$$ 类型的公式前有空行
    """
    # 遍历目录中的所有 Markdown 文件
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(".md"):
                file_path = os.path.join(root, file)
                changed = fix_latex_formulas(file_path)
                if changed:
                    print(f"已更新: {file_path}")
                else:
                    print(f"无需修改: {file_path}")


def fix_latex_formulas(file_path):
    """
    检查并修复单个 Markdown 文件中的 LaTeX 公式前的空行
    返回值: 是否进行了修改
    """
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    modified = False
    new_lines = []

    # 跟踪是否在公式块内部
    in_formula_block = False

    for i, line in enumerate(lines):
        # 检查当前行是否包含独占一行的 $$ 标记
        stripped_line = line.strip()

        # 检查是否是 $$ 标记（开始或结束）
        if re.match(r"^\s*\$\$\s*$", stripped_line):  # 纯 $$ 的行
            if not in_formula_block:
                # 这是公式块的开始
                # 检查上一行是否为空
                if i > 0 and new_lines[-1].strip():  # 上一行不为空
                    # 在当前行前插入空行
                    new_lines.append("\n")
                    modified = True
                in_formula_block = True
            else:
                # 这是公式块的结束
                in_formula_block = False

        # 如果不是纯 $$ 行，而是包含 $$ 的公式行
        elif re.match(r"^\s*\$\$.*\$\$", stripped_line) and not re.match(
            r"^\s*\$\$\s*$", stripped_line
        ):
            # 这是一行内完整包含 $$...$$ 的公式（非多行块）
            if not in_formula_block:
                # 检查上一行是否为空
                if i > 0 and new_lines[-1].strip():  # 上一行不为空
                    # 在当前行前插入空行
                    new_lines.append("\n")
                    modified = True

        new_lines.append(line)

    # 如果内容被修改，写回文件
    if modified:
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

    return modified


def main():
    """
    主函数，处理 public 文件夹下的所有 Markdown 文件
    """
    # 使用相对路径，从项目根目录开始
    public_path = os.path.join("frontend", "public")

    if os.path.exists(public_path):
        print(f"开始处理目录: {public_path}")
        check_and_fix_markdown_formulas(public_path)
        print("处理完成！")
    else:
        print(f"目录不存在: {public_path}")

        # 尝试绝对路径
        abs_public_path = os.path.join(
            "c:", "Users", "20194", "Documents", "WebsiteNote", "frontend", "public"
        )
        if os.path.exists(abs_public_path):
            print(f"开始处理目录: {abs_public_path}")
            check_and_fix_markdown_formulas(abs_public_path)
            print("处理完成！")
        else:
            print(f"也未找到绝对路径: {abs_public_path}")


if __name__ == "__main__":
    main()
