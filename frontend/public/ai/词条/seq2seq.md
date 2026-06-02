rnn用于seq2seq编解码  
允许任意长输入输出  
  
  
参考 [Jay Alammar](https://jalammar.github.io/)的  
*Visualizing A Neural Machine Translation Model (Mechanics of Seq2seq Models With Attention)  
基于attention机制的seq2seq可视化*  
https://jalammar.github.io/visualizing-neural-machine-translation-mechanics-of-seq2seq-models-with-attention/  
  
文本通过word embedding转为语义向量，作为输入序列  
  
输入序列经encoder变为上下文context，表现为vector等  
context经decoder成输出序列  
  
encoder与decoder均为RNN  
  
流程：  
![seq2seq_5](seq2seq_5.mp4)  
![seq2seq_6](seq2seq_6.mp4)  
在 encoder 中，输入序列的每个时间步依次送入 RNN，当前时刻的隐藏状态由前一时刻的隐藏状态与当前输入共同计算得到。  
  
输入序列处理完毕后，最终隐藏状态（即context）被传递给 decoder。decoder 使用该上下文向量作为初始隐藏状态，逐步生成输出序列。  
  