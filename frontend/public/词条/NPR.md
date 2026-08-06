# 非真实感渲染（NPR）  
  
## 概念解释  
  
非真实感渲染（Non-Photorealistic Rendering, NPR）是计算机图形学的一个分支，旨在模拟艺术式绘制风格，而非追求物理真实的影像再现。NPR 受油画、素描、技术图纸和动画卡通的影响，输出风格包括铅笔素描、水彩、油画、卡通渲染等。  
  
NPR 的核心设计思想包含三个层面：  
  
- **抽象（Abstraction）** ：移除不重要的细节，简化视觉信息。  
- **模糊（Ambiguity）** ：有意移除重要细节，创造艺术化的表达空间。  
- **强调（Emphasis）** ：突出场景中的重要信息。  
  
NPR 算法按处理空间可分为两类：  
- **模型空间（Model Space）** ：直接操作三维几何数据，可访问场景的完整三维形状信息。  
- **图像空间（Image Space）** ：对渲染后的二维图像进行后处理。  
  
NPR 的核心挑战之一是时间一致性（Temporal Coherence），即相邻帧之间渲染结果的平滑过渡，避免视觉闪烁。  
  
## 参考实现示例  
  
### 卡通着色（Toon Shading）  
  
卡通着色通过降低色阶数量模拟赛璐璐画风。核心操作是将连续光照值量化到有限个离散色阶。  
  
```glsl  
// 片元着色器 - 三阶卡通着色  
uniform vec3 baseColor;  
uniform vec3 shadeColor1;  
uniform vec3 shadeColor2;  
uniform float baseStep;   // 一阶着色阈值  
uniform float shadeStep;  // 二阶着色阈值  
  
void main() {  
    // 计算漫反射强度，取值范围 [0, 1]  
    float diffuse = max(0.0, dot(normal, lightDir));  
    
    vec3 finalColor;  
    if (diffuse > baseStep) {  
        finalColor = baseColor;       // 亮部  
    } else if (diffuse > shadeStep) {  
        finalColor = shadeColor1;     // 中间调  
    } else {  
        finalColor = shadeColor2;     // 暗部  
    }  
    
    gl_FragColor = vec4(finalColor, 1.0);  
}  
```  
  
色阶数量 $k$ 与量化步长 $\Delta = 1/k$ 的关系为：漫反射强度 $d \in [0,1]$ 映射到色阶索引 $i = \lfloor d / \Delta \rfloor$，最终颜色 $C = \sum_{i=0}^{k-1} \mathbf{1}_{i \leq d/\Delta < i+1} \cdot C_i$。  
  
### 轮廓线渲染（膨胀描边法）  
  
使用两个渲染通道（Pass）：第一通道渲染背面并沿法线方向扩张顶点，第二通道正常渲染正面，两通道叠加形成描边。  
  
```glsl  
// 顶点着色器 - 描边通道（Pass 0）  
uniform float outlineWidth;  
  
void main() {  
    // 沿法线方向扩张顶点  
    vec3 expandedPos = position + normal * outlineWidth;  
    gl_Position = projectionMatrix * modelViewMatrix * vec4(expandedPos, 1.0);  
}  
```  
  
```glsl  
// 片元着色器 - 描边通道  
uniform vec3 outlineColor;  
  
void main() {  
    gl_FragColor = vec4(outlineColor, 1.0);  
}  
```  
  
第二通道使用正常渲染（包含卡通着色），由于正面模型尺寸小于扩张后的背面模型，未被正面覆盖的边缘区域保留描边颜色。该方法的时间复杂度为 $O(n)$，其中 $n$ 为顶点数，空间复杂度为 $O(n)$。  
  
### 基于法线-视线点积的轮廓检测  
  
在单次渲染中通过计算表面法线与视线方向的点积检测轮廓：  
  
```glsl  
// 片元着色器 - 轮廓检测  
uniform vec3 outlineColor;  
uniform vec3 baseColor;  
uniform float threshold;  
  
void main() {  
    vec3 viewDir = normalize(cameraPos - worldPos);  
    float edge = abs(dot(normal, viewDir));  
    
    // 点积接近 0 的位置为轮廓  
    if (edge < threshold) {  
        gl_FragColor = vec4(outlineColor, 1.0);  
    } else {  
        gl_FragColor = vec4(baseColor, 1.0);  
    }  
}  
```  
  
## 应用场景  
  
1. **游戏与动画**：卡通渲染（Cel-shading）在电子游戏和动画电影中广泛使用，模拟手绘动画风格。典型案例如《塞尔达传说：旷野之息》《无主之地》等。  
  
2. **科学可视化**：通过抽象和强调关键信息，降低认知负荷，帮助观察者快速理解复杂数据中的核心特征。技术插图、医学可视化等领域均有应用。  
  
3. **增强现实（AR）** ：NPR 将真实与虚拟世界统一为风格化表达，使二者在视觉上不可区分，隐藏不必要的细节并强调场景中的重要信息。  
  
## 常见误区  
  
**误区：NPR 比真实感渲染（Photorealistic Rendering）更简单或计算量更小。**  
  
NPR 并非简单渲染的替代方案，而是具有独立复杂性的技术体系。实时 NPR 同样面临高性能计算挑战，部分风格化算法（如基于笔触的渲染、风格化线条绘制）的计算开销可能高于传统真实感渲染。许多 NPR 算法需要额外处理时间一致性、线条跟踪和风格化纹理合成等复杂问题。  
  
**误区：NPR 只适用于卡通风格。**  
  
NPR 涵盖广泛的视觉风格，包括素描、水彩、油画、墨绘、技术插图、漫画等。卡通渲染仅是 NPR 的一个子集。  