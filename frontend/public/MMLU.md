## 概念解释  
  
MMLU（Massive Multitask Language Understanding）是一个大规模多任务语言理解评估基准，用于衡量大语言模型在跨领域知识获取和推理方面的能力。该基准由 Hendrycks 等人于 2021 年提出。  
  
MMLU 包含 57 个学科任务，涵盖数学、历史、法律、医学、计算机科学等领域，共 15,908 道四选一选择题。题目难度从小学水平延伸至专业水平。MMLU 采用固定格式的多选题格式，每个题目提供 A、B、C、D 四个选项。  
  
MMLU 支持两种评估设置：零样本（zero-shot）和少样本（few-shot）。零样本设置下，模型仅接收问题输入，不提供任何示例；少样本设置下，模型在回答问题前会接收到若干格式化的示例问答对。模型的多任务准确率定义为全局分类准确率：  
  
$$Accuracy = \frac{\text{Number of correct answers}}{\text{Total number of questions}} \times 100\%$$  
  
该基准的两个核心设计目标为：(1) 广泛的学科覆盖——通过从本科至专业级别的任务评估模型的世界知识和领域迁移能力；(2) 细粒度诊断——通过异质性任务分布检测模型在不同领域表现出的性能差异。  
  
## 参考实现示例  
  
以下代码展示了如何使用 Hugging Face `datasets` 库加载 MMLU 数据集，并对模型进行零样本评估。  
  
```python  
import torch  
from datasets import load_dataset  
from transformers import AutoModelForCausalLM, AutoTokenizer  
  
# 加载 MMLU 数据集（以高中数学子集为例）  
dataset = load_dataset("cais/mmlu", "high_school_mathematics", split="test")  
  
# 加载预训练模型和分词器  
model_name = "gpt2"  
tokenizer = AutoTokenizer.from_pretrained(model_name)  
tokenizer.pad_token = tokenizer.eos_token  
model = AutoModelForCausalLM.from_pretrained(model_name)  
model.eval()  
  
def format_prompt(question, choices):  
    """格式化为多选题提示"""  
    prompt = f"{question}\n"  
    for i, choice in enumerate(choices):  
        prompt += f"{chr(65 + i)}. {choice}\n"  
    prompt += "\nAnswer:"  
    return prompt  
  
def evaluate_sample(question, choices, correct_answer):  
    """评估单个样本"""  
    prompt = format_prompt(question, choices)  
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)  
    
    with torch.no_grad():  
        outputs = model(**inputs)  
        logits = outputs.logits[0, -1, :]  
    
    # 提取 A/B/C/D 选项的 logit  
    option_tokens = [tokenizer.encode(ch, add_special_tokens=False)[0] for ch in ["A", "B", "C", "D"]]  
    option_logits = [logits[token].item() for token in option_tokens]  
    predicted = option_tokens[torch.argmax(torch.tensor(option_logits))]  
    predicted_letter = tokenizer.decode([predicted])  
    
    return predicted_letter == correct_answer  
  
# 执行评估  
correct = 0  
total = min(100, len(dataset))  # 取前100个样本  
  
for i in range(total):  
    sample = dataset[i]  
    is_correct = evaluate_sample(  
        sample["question"],  
        sample["choices"],  
        sample["answer"]  
    )  
    if is_correct:  
        correct += 1  
  
print(f"Accuracy: {correct / total:.2%}")  
```  
  
## 应用场景  
  
1. **LLM 性能横向对比**：在标准化框架下比较不同大语言模型（如 GPT-4o、Claude 3、Llama 3 等）的跨领域知识掌握能力。  
  
2. **模型微调效果评估**：在领域微调过程中，使用 MMLU 作为验证指标，量化模型在通用知识保留和特定领域性能提升之间的权衡。  
  
## 扩展：MMLU-Pro  
  
MMLU-Pro 是针对原始 MMLU 基准局限性设计的增强版本。原始 MMLU 存在两个主要问题：知识回忆占主导而真实推理不足，以及存在琐碎或含噪问题。  
  
MMLU-Pro 的关键改进包括：  
- 将每道题的选项从 4 个扩展至 10 个，将随机猜测准确率从 25% 降低至 10%  
- 移除琐碎问题，聚焦于大学水平的、需要多步推理的题目  
- 将 57 个原始类别压缩为 14 个更广泛的学科领域  
- 链式思维（Chain-of-Thought）提示在 MMLU-Pro 上对 GPT-4o 准确率提升高达 19.1%，而在原始 MMLU 上仅提升 1.5%  
  
## 常见误区  
  
**误区一：MMLU 高分意味着模型具备深层推理能力。** MMLU 中的大量题目依赖知识记忆而非复杂推理，因此高分主要反映模型的知识广度，而非严格的逻辑推理能力。MMLU-Pro 的提出即旨在解决这一问题。  
  
**误区二：少样本设置一定优于零样本设置。** 并非所有模型和任务都遵循该规律。在某些基准和检索策略下，少样本设置的实际表现可能低于零样本设置。少样本提示的有效性取决于示例的选择质量和模型对上下文示例的利用能力。  