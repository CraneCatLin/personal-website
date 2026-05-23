参考 [Jay Alammar](https://jalammar.github.io/)的*The Illustrated Transformer*  
https://jalammar.github.io/visualizing-neural-machine-translation-mechanics-of-seq2seq-models-with-attention/  
前置attention：[[attention]]  
  
  
一个transformer内有一个编码组件和解码组件，各由等数量编解码器组成  
  
每个编码器由一个前馈神经网络(feed forward neural network, ffnn)和一个自注意力（self-attention）组件组成  
每个解码器由一个ffnn，一个编码器注意力层，一个自注意力层组成  
数据流动顺序以及组件图示如下  
![Transformer_decoder](./rcs/Transformer_decoder.png)  
