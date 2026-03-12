写着玩，练手(?)  
  
# 项目进展/步骤  
- 创建仓库  
- 配置所需库，readme配置方法  
- Window类  
- 测试跑通了环境，主要是vcpkg没怎么用过，配置指定编译器卡手  
- spdlog日志模块，测试功能正常  
-   
  
# 问题与解决  
## 配置相关  
引用的glm等库时直接git clone，形成了嵌套git仓库  
解决方法是删除.git隐藏文件夹使库失去git仓库属性  
  
vcpkg需要powershell 7  
  
vcpkg安装调用编译器与项目保持一致  
  
  
  
  
# EXP  
doxygen写给头文件  
  
使用 `noexcept` 可以让编译器在 STL 容器等场景中优先选择移动而非拷贝，提升性能。  
  
**`m_` = member（成员）**，用于标识**类的成员变量**，以区分局部变量、参数和全局变量。  
  
vcpkg.json管理依赖  