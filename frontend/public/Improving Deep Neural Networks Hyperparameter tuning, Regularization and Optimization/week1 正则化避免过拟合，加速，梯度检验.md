数据分训练集，验证集，测试集  
验证集用于选取最优方法，测试集用于无偏估计具体性能，二者相对小数据量即可实现  
三个数据集需要来自统同一分布  
  
  
## 偏差bias与方差 variance  
偏差：训练集的准确率  
方差：训练集准确率与验证集准确率的差  
  
高偏差即欠拟合（偏离训练集）  
低偏差高方差即过拟合（过于符合训练集但不能适应其他数据集）  
低偏差低方差即合适的拟合  
  
高方差可以通过正则化或者扩大训练集改善  
  
## 正则化 regularization  
有利于减小方差、避免过拟合  
标准成本函数为  
  
$$J(w, b) = \frac{1}{m} \sum_{i=1}^m \mathcal{L}(\hat{y}^{[l](i)}, y^{(i)}) $$  
#### L2正则化  
  
$$J(w^{[1]},b^{[1]},……,w^{[L]}, b^{[L]}) = \frac{1}{m} \sum_{i=1}^m \mathcal{L}(\hat{y}^{(i)}, y^{(i)}) +\frac{\lambda}{2m}\sum^{L}_{l=1}\|w^{[l]}\|^2_2$$  
这里只处理w不处理b，按我理解是完全展开各隐藏层后，X的系数只有$w^{[l]}$，$b^{[l]}$起到一个偏移量的作用。另外处理w已经足够大且足够限制结果的拟合程度，足以防止过拟合，b正则化的成本没有必要  
  
系数里的$\frac{\lambda}{2m}$，$\lambda$是超参数，分母的2是为了求导后式子简洁而加的系数，并不影响实际效果  
对于一维向量，L2范数即求向量模长（转置内积或者分量平方求和）  
对于矩阵W，计算方法相同（分量平方求和），但改称Frobenius范数  
  
加上L2正则化项后，反向传播得到的dw：$dw^{[l]}=dw_{origin+}\frac{\lambda}{m}w^{[l]}$  
表现到$w^{[l]}$即  
  
$$w^{[l]}=w^{[l]}-\alpha(dw_{origin}+\frac{\lambda}{m}w^{[l]})=(1-\frac{\alpha \lambda}{m})w^{[l]}-\alpha dw_{origin}$$  
相当于对$w^{[l]}$乘以一个小于1的参数。由此L2正则化称为权重衰减。  
  
#### L1正则化  
  
$$J(w^{[l]}, b^{[l]}) = \frac{1}{m} \sum_{i=1}^m \mathcal{L}(\hat{y}^{(i)}, y^{(i)}) +\frac{\lambda}{m}\sum^{L}_{l=1}\|\omega^{[l]}\|_1$$  
思想与L2同理  
L1范数即分量求和  
  
L1正则化会导致稀疏解，即比L2正则化得到的$\omega$容易含有更多的0，原因参考文末“L1正则化稀疏解证明”  
#### 注意事项  
python中写lambd代替lambda，防止与关键字冲突  
  
#### 正则化防止过拟合  
增大$\lambda$时，J增大，使得w减小，即缩小，使得$z=wa+b$的z变小，激活函数在z取值范围很小时趋于线性，进而使整体更趋于线性，减小过拟合的可能  
  
#### dropout 随机失活 正则化  
此处为inverted dropout反向随机失活  
代码实现可以通过设定概率的random生成01向量掩码然后在对应层与参数相乘  
假如原本的结果期望是a，则随机失活后的期望是$p*a+(1-p)*0=p*a$，为保持期望（平均值）不变，需要除以0.8，即除以失活存活概率keep-prob  
各层的keep-prob可以不同，取决于该层导致过拟合的可能性（例如隐藏单元的数量）  
  
  
  
## L1正则化稀疏解证明  
#### 命题  
L1正则化惩罚项 $\|\omega\|_1$ 导致稀疏解（即最优解中大量分量为0）。  
  
#### 次梯度定义  
对于一个凸函数 $f: \mathbb{R}^n \rightarrow \mathbb{R}$，在点 $x_0$ 处的次梯度 $g \in \mathbb{R}^n$ 定义为满足以下不等式的任意向量：  
  
$$  
f(x) \geq f(x_0) + g^T (x - x_0), \quad \forall x \in \text{dom}(f)  
$$  
所有满足该条件的次梯度 $g$ 构成的集合称为次微分，记为 $\partial f(x_0)$：  
  
$$  
\partial f(x_0) = \{ g \in \mathbb{R}^n : f(x) \geq f(x_0) + g^T (x - x_0), \forall x \in \text{dom}(f) \}  
$$  
**直观解释：**  
次梯度 $g$ 是在点 $x_0$ 处画出的某条直线的斜率（或超平面法向量），这条直线（或超平面）需要**始终位于函数图像的下方**（对于凸函数而言）。  
  
次梯度一个显然的性质：在可导处，次梯度等于导数  
次梯度可以用于梯度下降中不可导处替代梯度  
#### 证明  
考虑目标函数 $J(\omega) = \text{Loss}(\omega) + \lambda \|\omega\|_1$，其中 $\lambda > 0$。  
  
**1. 次梯度定义**  
$|\omega_i|$ 在 $\omega_i = 0$ 处不可导，其次梯度为：  
  
$$  
\partial |\omega_i| =   
\begin{cases}   
\{1\}, & \omega_i > 0 \\  
\{-1\}, & \omega_i < 0 \\  
[-1, 1], & \omega_i = 0  
\end{cases}  
$$  
  
**2. 最优性条件**  
$\omega^*$ 是全局最优解的一阶必要条件为：  
  
$$  
0 \in \nabla_{\omega} \text{Loss}(\omega^*) + \lambda \cdot \partial \|\omega^*\|_1  
$$  
即对于每个分量 $i$，存在 $g_i \in \partial |\omega_i^*|$，使得：  
  
$$  
\frac{\partial \text{Loss}}{\partial \omega_i}(\omega^*) + \lambda g_i = 0  
$$  
  
**3. 零解存在的充分条件**  
考察 $\omega_i = 0$ 的情形。设 $\delta_i = \frac{\partial \text{Loss}}{\partial \omega_i}(0)$，则最优性条件要求存在 $g_i \in [-1, 1]$ 满足：  
  
$$  
\delta_i + \lambda g_i = 0 \quad \Longleftrightarrow \quad g_i = -\frac{\delta_i}{\lambda}  
$$  
这样的 $g_i$ 存在当且仅当 $|g_i| \leq 1$，即：  
  
$$  
|\delta_i| \leq \lambda  
$$  
  
**4. 结论**  
当原始损失函数在 $\omega_i=0$ 处的梯度绝对值 $|\delta_i|$ 不超过正则化强度 $\lambda$ 时，$\omega_i = 0$ 满足最优性条件。由于 $\lambda > 0$，对于不重要的特征（$|\delta_i|$ 较小），该条件自动成立，因此 $\omega_i=0$ 是局部最优解，且优化算法将收敛于此不可导点。  
  
  
  
## 其他防止过拟合的方法  
#### 简易扩充数据集  
在数据集不够大而易产生过拟合时，可以通过翻转、裁剪等简单方法创建略有不同的图片扩充数据集  
#### early stopping  
有时J-w图像是J先下降后上升，因而有时提前结束会取得较好结果  
相当于L2正则化的优点是不需要多次尝试较好的$\lambda$而只需一次  
  
## 归一化输入加速训练  
  
$$x=\frac{x-\mu}{\sigma}$$  
减小J对w、b的梯度，即在学习率不需要太小的情况下更容易达到J最小值，加速训练  
  
## 梯度爆炸/消失  
初始的x在经过大量w参数后，大量w大于1/小于1累积的效果会导致$\hat{y}$极大或极小，进而导致梯度极大/极小  
## 随机初始化避免梯度爆炸  
  
$$W^{[l]}=np.random.randn(W.shape())*np.sqrt(\frac{1}{n^{[l-1]}})$$  
## 梯度数值估计与检验  
使用双边数值估计，  
  
$$f'(\theta)=\lim_{\epsilon \to 0}\frac{f(\theta+\epsilon)-f(\theta-\epsilon)}{2\epsilon}$$  
用这个公式与计算梯度做差检验  
  
$$\epsilon=\frac{\|d\theta_{approx}-d\theta\|_2}{\|d\theta_{approx}\|_2+\|d\theta\|_2}$$  
训练的梯度下降过程中不要执行检验，仅在调试时检验减少耗时  
梯度检验和dropout不能同时使用，后者会影响J  