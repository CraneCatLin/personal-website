const { Plugin, Notice } = require('obsidian');
const { exec } = require('child_process');
const path = require('path');

// ========== 通用配置 ==========
// 在 Obsidian 插件目录中，脚本的相对路径是从项目根目录计算的
const SCRIPT_RELATIVE_PATH = "./WebsiteNote/update.ps1";

module.exports = class RunSubmitScriptPlugin extends Plugin {
    async onload() {
        console.log('载入 RunSubmitScriptPlugin');

        // 左侧边栏图标按钮
        this.addRibbonIcon('terminal', '执行提交脚本', () => {
            this.runScript();
        });

        // 命令面板命令（可在设置里绑定快捷键）
        this.addCommand({
            id: 'update-script',
            name: 'Update Script',
            callback: () => this.runScript()
        });
    }

    runScript() {
        new Notice('正在打开终端窗口执行脚本...');

        try {
            // 方法1: 尝试通过 vault 路径获取仓库根目录
            const vaultPath = this.app.vault.adapter.basePath;

            // 调试输出当前插件位置
            console.log('Vault路径:', vaultPath);
            console.log('插件位置:', __dirname);

            // 重新计算正确的相对路径: 
            // vaultPath = c:\Users\20194\Documents\WebsiteNote\frontend\public
            // 项目根目录 = c:\Users\20194\Documents\WebsiteNote
            // 所以需要向上返回3级: ../../..
            const vaultToRoot = path.resolve(vaultPath, '../../..');

            // 构造完整的脚本路径
            const scriptFullPath = path.resolve(vaultToRoot, SCRIPT_RELATIVE_PATH);

            console.log('计算的项目根目录:', vaultToRoot);
            console.log('脚本完整路径:', scriptFullPath);

            // 检查脚本文件是否存在
            const fs = require('fs');
            if (!fs.existsSync(scriptFullPath)) {
                new Notice(`找不到脚本文件: ${scriptFullPath}`);
                console.error('脚本文件不存在:', scriptFullPath);
                return;
            }

            // 用 start 命令打开一个新的 PowerShell 窗口
            const command = `start "执行脚本" powershell -NoExit -ExecutionPolicy Bypass -File "${scriptFullPath}"`;

            exec(command, { cwd: vaultToRoot }, (error) => {
                if (error) {
                    new Notice(`无法打开终端: ${error.message}`);
                    console.error(error);
                }
            });

        } catch (error) {
            new Notice(`路径计算错误: ${error.message}`);
            console.error('路径计算错误:', error);
        }
    }

    onunload() {
        console.log('卸载 RunSubmitScriptPlugin');
    }
};