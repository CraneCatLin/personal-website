fs和深度测试之间  
  
启用：  
```c++  
glEnable(GL_STENCIL_TEST);  
```  
清除：  
```c++  
glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);  
```  
掩码：  
`glStencilMask(0x00)`  
这里的数字是8位，即一个模板值，在写入时与写入值按位与->0x00等价于只读，默认0xFF  