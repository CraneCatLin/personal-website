一般性数据 standard NN  
图像二维数据 CNN  
音频文字一维数据（时间序列类） RNN  
复杂混合数据 hybrid / customed NN  
  
## 符号表示  
样本：$(x,y)$，x是一个$n_x$维的$n_x * 1$的（列）向量，y是0或1，表示样本的性质  
带序号的样本：$(x^{(i)},y^{(i)})$，i用于区分样本  
   
样本数通常用m表示   
  
  
## 二分分类 binary classification  
结果为1/0的问题  
#### logistic回归（regression）  
训练需要计算损失函数的梯度，这是一个连续问题，所以把离散0/1改为概率值  
将向量x映射成一个0-1之间的概率值：  
采用线性式，即$z= w^T x+b$，再通过sigmoid函数映射到0-1区间  
$$sigmoid: \sigma(z)=\frac{1}{1+e^{-z}}$$  
此时训练目的为获取正确的w和b  
  
设置损失函数loss func L，使其缩小即求得合适的参数，衡量单个样本的差距  
此处使用  
$$L(\hat{y},y)=-(y\log\hat{y}+(1-y)\log(1-\hat{y}))$$
（即把二分分类问题看作伯努利分布，然后取对数极大似然函数$P(y|x)$）
  
设置成本函数cost func J，衡量全体样本总差距，即对L求和平均  
$$J(w, b) = \frac{1}{m} \sum_{i=1}^m \mathcal{L}(\hat{y}^{(i)}, y^{(i)}) = -\frac{1}{m} \sum_{i=1}^m y^{(i)} \log \hat{y}^{(i)} + (1 - y^{(i)}) \log(1 - \hat{y}^{(i)})$$



logistic优点：凸函数，不会像非凸函数一样有多个极小值  
  
下记$a=\hat{y}=\sigma(z)$  
#### 梯度下降法  
  
为表示方便，下将所有偏导/导数等等简记，如  
$$\frac{\partial{J(w,b)}}{\partial{w}} \to dw$$  
即逐步迭代逼近最小值  
**迭代方法**:  
  
$$w: =w-\alpha dw$$  
其他参数同理，此处$\alpha$表示学习率  
  
根据求导链式法则求出dw，db即可，其中通过展开向量内积可以把w和x写成若干个值，看作若干参数  
$$ \frac{\partial J}{\partial w} = \frac{1}{m}X(A-Y)^T$$

$$ \frac{\partial J}{\partial b} = \frac{1}{m} \sum_{i=1}^m (a^{(i)}-y^{(i)})$$
#### 向量化，广播
循环转为矩阵运算代码提速

样本合并可以列堆叠（通常，即每个样本一列）或者行堆叠
列堆叠时，$X为n_x*m$，$Y为1* m$  
（python默认是列向量）

axis 参数决定运算的轴向
利用reshape可以改变向量的形状

numpy处理不同大小矩阵运算，且其中一个为行/列向量时时会自动通过复制扩充小矩阵至大矩阵大小再运算

numpy中定义/创建量时，如果提供单个数会默认给出一般数组，给出明确两个数才会给出行列向量等。保险手段包括断言assert、reshape等

模块化加单元测试

