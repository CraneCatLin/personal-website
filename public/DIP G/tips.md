一些名词解释  
  
## 对比度  
描述图像中不同灰度值之间差异的程度  
有多种计算方式  
#### 韦伯对比度 (Weber Contrast)  
适用于**小目标叠加在大片均匀背景上**的情况（如文本阅读）  
$$C_w = \frac{L_t - L_b}{L_b} = \frac{\Delta L}{L_b}$$  
 $L_t$：目标区域的亮度  
 $L_b$：背景区域的亮度  
 $\Delta L$：目标与背景的亮度差  
  
#### 米歇尔森对比度 (Michelson Contrast)  
用于评估**周期性图案、显示器或具有明暗交替结构**的整体对比度。  
$$C_m = \frac{L_{\text{max}} - L_{\text{min}}}{L_{\text{max}} + L_{\text{min}}}$$  
  
 $L_max$：图像或区域中的最大亮度  
 $L_min$：图像或区域中的最小亮度  
#### RMS对比度 (Root Mean Square Contrast)  
用于**自然图像分析**和**图像质量评估**。  
$$C_{\text{rms}} = \sqrt{ \frac{1}{MN} \sum_{i=1}^{M} \sum_{j=1}^{N} (I(i,j) - \bar{I})^2 }$$  
 $I(i,j)$：像素在位置(i,j)的强度（归一化后，如0~1）  
 $Ī$：整幅图像的平均强度  
 $M,N$：图像的尺寸  
