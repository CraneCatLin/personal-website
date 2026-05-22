参考 [Jay Alammar](https://jalammar.github.io/)的  
*Visualizing A Neural Machine Translation Model (Mechanics of Seq2seq Models With Attention)  
基于attention机制的seq2seq可视化*  
https://jalammar.github.io/visualizing-neural-machine-translation-mechanics-of-seq2seq-models-with-attention/  
以及知乎 https://zhuanlan.zhihu.com/p/394166679  
  
前置seq2seq见[[seq2seq]]  
  
  
此处缩写隐藏状态向量记为HSV  
  
  
attention相较seq2seq，改进如下：  
  
1）在 Attention 模型中，encoder 将每一步的 hidden state 信息传递给 decoder ，而非像之前只传递最后一步的 hidden state  
  
2）带有 attention 机制的 decoder 在**输出每个词之前**增加了一步额外处理，目的是聚焦输入序列中与当前解码时刻最相关的部分。  
在此称此步为Attention step，具体而言，decoder 会：  
1. 读取 encoder 在所有时间步产生的 hidden states（每个 hidden state 对应输入序列中的某个词）；  
2. 对每个 hidden state 计算一个分数（评分方式因具体 attention 实现而异）；  
3. 对这些分数进行 softmax 归一化，得到注意力权重；  
4. 将每个 hidden state 乘以对应的权重，放大重要部分的信号，抑制无关部分；  
5. 将所有加权后的 hidden states 逐元素求和，得到最终的context vector，用于当前时刻的输出生成。  
![attention_decoder](./resources/attention_process.mp4)  
  
  
总体来说，第一步中decoder：  
1. 将一个起始信号（例如特定字符串的embedding）与一个初始化的HSV（例如零向量，下图$h_{init}$）传给decoder  
2. RNN将这两个向量处理为新的HSV（下图$h_4$）和一个输出向量（副产物，直接丢弃）  
3. 完成上述attention step。在这里就是encoder 传入的HSV与$h_4$按照上述步骤处理。处理得到新的context vector（图中为$c_4$）  
4. $h_4$和$c_4$拼接出一个向量，输入decoder的输出层，例如一个前馈神经网络，得到output，即这步真正的输出  
在后续步骤中，输入变成上一步的output（对应起始信号）和$h_4$(对应初始HSV)，重复直到处理完所有的向量。  
![attention_tensor_dance](./resources/attention_tensor_dance.mp4)  
  
  
注意，Attention step中所用的encoder的HSV是全部的，encoder所有时间步的HSV  