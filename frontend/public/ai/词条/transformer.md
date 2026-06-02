参考 [Jay Alammar](https://jalammar.github.io/)的*The Illustrated Transformer*  
https://jalammar.github.io/visualizing-neural-machine-translation-mechanics-of-seq2seq-models-with-attention/  
以及知乎 https://zhuanlan.zhihu.com/p/219714713  
  
前置attention：[[attention]]  
  
# 构成  
一个transformer内有一个编码组件和解码组件，各由等数量编解码器组成  
  
每个编码器由一个前馈神经网络(feed forward neural network, ffnn)和一个自注意力（self-attention）组件组成  
每个解码器由一个ffnn，一个编码器注意力层，一个自注意力层组成  
数据流动顺序以及组件图示如下  
![Transformer_decoder](Transformer_decoder.png)  
  
不同编码器的ffnn参数可以不一样  
  
  
# 流程  
## embedding  
一个句子拆成若干token，每个token经embedding算法转为语义向量；一个句子就变成一个向量列表  
## encoder  
整体数据流：  
  
$$  
\mathbf{x}_{\text{out}} = \mathrm{LayerNorm}\big(\mathbf{x} + \mathrm{Dropout}(\mathrm{FFN}(\mathbf{x}_{\text{attn}}))\big)  
$$  
编码器每次接受一个向量列表；最底部的编码器接受的就是embedding的直接产物  
![encoder_with_tensors](encoder_with_tensors_2.png)  
多个向量都会逐层通过encoder  
#### feed forward neural network  
ffnn部分是可以并行的  
ffnn是Position-wise（逐位置）的，即对序列中每一个位置的向量，都用同一组参数独立做一次相同的变换，不同位置之间不交互。  
  
对序列中某个位置的输入向量 $\mathbf{x} \in \mathbb{R}^{d_{\text{model}}}$，标准 FFN 执行两步线性变换，中间夹一个非线性激活函数：  
  
$$\mathrm{FFN}(\mathbf{x}) = \mathbf{W}_2 \, \sigma(\mathbf{W}_1 \mathbf{x} + \mathbf{b}_1) + \mathbf{b}_2$$  
  
- ffnn引入了非线性：自注意力本质上是对 Value 向量的加权求和，属于线性变换 + 组合权重。若没有 FFN，堆叠多层自注意力也只能实现有限的线性混合。FFN 中的非线性激活（ReLU/GELU 等）使得整个层可以学习复杂的非线性映射，是 Transformer 强大建模能力的重要来源。  
- ffnn的参数量巨大，占transformer 的大头，作为主要记忆  
#### self-attention  
总结来说就是个加权表达过程，注意力分数就是权重  
###### QKV向量  
对于向量（对应一个token），我们创建一个Query向量，一个Key向量和一个Value向量  
具体方法为嵌入向量与三个不同矩阵相乘，如$x_1 W^Q=q_1$  
![transformer_self_attention_vectors](transformer_self_attention_vectors.png)  
通常QKV向量长度小于嵌入向量，例如文中嵌入向量512，QKV为64  
$W^Q$$W^K$$W^V$这些矩阵会在训练过程中优化  
###### 注意力分数  
对token A编码时，需计算所有单词（包括A）对A的注意力分数，如B对A注意力分数为A query与B key向量点积的结果  
  
###### 归一化分数  
将所有分数除以一个值，默认是key向量维度的平方根  
再通过softmax归一化所有分数  
  
- 同除的原因：  
	softmax并不是线性函数：它用指数放大了输入之间的差异。当点积的值很大时（比如维度 $d_k$ 较大时，Q·K 的方差接近 $d_k$），softmax会输出极端接近 one-hot 的分布，导致梯度极小，训练困难。  
	除以 $\sqrt{d_k}$ 是为了将方差缩放回 1，使 softmax 保持合理的“温度”，梯度更稳定。默认用平方根是因为 Q·K 的方差正比于 $d_k$，所以除以标准差 $\sqrt{d_k}$ 是自然的选择。  
###### 加权  
每个token的value向量乘以注意力分数后求和，得到self-attention对于当前输入token的输出  
![self-attention-output](self-attention-output.png)  
  
###### 矩阵运算实现并行化  
如图  
![self-attention-matrix-calculation|500](self-attention-matrix-calculation.png)  
![self-attention-matrix-calculation-2](self-attention-matrix-calculation-2.png)  
  
###### 多头注意力  
上述过程中，一个编码器内只有一组$W^Q$$W^K$$W^V$矩阵  
为了提升对于其他位置的关注能力，增加多头（注意力头，attention head）机制，即使用多组$W^Q$$W^K$$W^V$矩阵，那么最后的输出z就有对应个数  
为了把多个z矩阵压缩为最终应输出的单个z矩阵，采用拼接后乘以一个$W^O$矩阵的方式。  
例如z矩阵是2\*4，有8组也就是生成8个$z_i$矩阵，那么就是拼成2\*32的矩阵然后乘以32\*4的$W^O$  
$W^O$矩阵也是随着整个模型一起训练的  
图示如下  
![transformer_multi-headed_self-attention-recap][./rcs/transformer_multi-headed_self-attention-recap.png]  
实现效果可能是每个注意力头关注少数几个token，合并得到当前词较为全面的联系表  
  
###### 位置编码  
通过特定函数将token在句子的位置编码成和嵌入向量一样维度的向量。  
嵌入向量加上位置向量,这样可以表示出token 的位置、token间的距离  
这个步骤在self-attention之前，也就是图里的Embedding with time signal（下文decoder部分的图）  
具体计算函数依实际情况而定  
  
#### 残差结构  
每个编码器中的每个子层（Self-Attention，ffnn）在其周围都有残差连接与层归一化（layer normalization）操作。  
self-attention层的残差连接与层归一化如下  
![transformer_resideual_layer_norm_2|500](transformer_resideual_layer_norm_2.png)  
  
  
## decoder  
#### 解码器交叉注意力与解码器自注意力  
编码器首先处理输入序列。 然后，顶部编码器的输出转换为注意向量Key和Value的集合，这里用的 (W^K) 和 (W^V)是解码器单独的，与编码器的没关系  
第一个token被处理时，输入解码器的是KV以及一个特定token（标注开始），多层处理后生成最终结果的token；  
其后的token同样输入KV，特定token则由*上一时间步编码器的输出token加上位置向量*代替  
最后一个输出应当为\<eos\>这样的表示结束的特殊token  
![transformer_decoding_1](transformer_decoding_1.gif)  
![transformer_decoding_2](transformer_decoding_2.gif)  
具体来说每一层decoder中：  
- self-attention部分：与单层encoder基本相同，但是在softmax之前要把未来位置的注意力分数设置为负无穷以确保只能解码器只能看见前面的token  
- encoder-decoder attention 部分：Query来自解码器本身，具体是解码器自注意力子层的输出（经过残差与层归一化）；Key和 Value 来自编码器堆栈的最终输出，即整个输入序列经过所有编码器层后的表示。  
#### 最终线性层与Softmax层（The Final Linear and Softmax Layer）  
线性层是一个简单的全连接神经网络，它将解码器堆栈产生的向量投影到logits向量，后者对应词汇表的大小。  
然后，softmax层将这些分数归一化，选择具有最高概率的单元，然后该单元对应的词将作为该时间步的输出。  