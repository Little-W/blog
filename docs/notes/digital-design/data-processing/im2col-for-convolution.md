---
title: im2col：把卷积变成矩阵乘法时的数据布局
sidebar_position: 2
slug: /notes/digital-design/im2col-for-convolution
---

# im2col：把卷积变成矩阵乘法时的数据布局

im2col 是一种卷积实现策略：把输入特征图中每个卷积窗口展开为矩阵的一行（或一列），再把卷积转化为 GEMM。这样可以复用成熟的矩阵乘内核、SIMD 指令或 NPU 矩阵单元；代价是额外的工作区和内存搬运。

## 从卷积到矩阵乘

设输入为 `H_in × W_in × C_in`，卷积核为 `K_h × K_w`，组数为 `G`，每组输入通道数为 `C_per_group`。在 NCHW/NHWC 的外层批次维之外，每一个输出坐标 `(oy, ox)` 对应一个感受野。

把感受野按 `ky → kx → channel` 的固定顺序排成一行：

```text
[x(0,0,0), x(0,0,1), ..., x(Kh-1,Kw-1,C_per_group-1)]
```

对于分组卷积，矩阵行数与列数可写为：

```text
rows = H_out * W_out * G
cols = K_h * K_w * C_per_group
```

对应组的权重也按同一列顺序拉平。于是每个输出通道的卷积就是一行 im2col 数据和一行权重的点积，多个输出通道可一起交给 GEMM。

## 输出尺寸与索引

在 stride 为 `S_h, S_w`、padding 为 `P_h, P_w`、dilation 为 `D_h, D_w` 时，有效卷积核尺寸是：

```text
K_eff_h = (K_h - 1) * D_h + 1
K_eff_w = (K_w - 1) * D_w + 1

H_out = floor((H_in + 2 * P_h - K_eff_h) / S_h) + 1
W_out = floor((W_in + 2 * P_w - K_eff_w) / S_w) + 1
```

输出坐标 `(oy, ox)` 对应输入窗口左上角：

```text
base_y = oy * S_h - P_h
base_x = ox * S_w - P_w

in_y = base_y + ky * D_h
in_x = base_x + kx * D_w
```

分组卷积需要额外处理通道偏移：第 `g` 组读取 `g * C_per_group` 开始的通道，并只与该组的权重相乘。遗漏这个偏移时，单组测试通常能通过，多组测试会整体错位。

## 数据布局先统一，再谈优化

im2col 的常见 bug 不是算术错误，而是生产者和 GEMM 消费者对 layout 的理解不同。实现前应固定并写入接口文档：

- 输入是 NHWC 还是 NCHW；
- im2col 的行是输出位置还是输出通道；
- 一行内的顺序是 `ky/kx/channel` 还是其他排列；
- groups 如何分块，权重是否预先重排；
- 每行的真实列数和用于对齐的 stride 是否不同。

建议让 `lhs_stride_bytes` 独立于逻辑列数：逻辑列数是 `K_h * K_w * C_per_group`，物理行步长可向 4、8、16 或更大的向量宽度对齐。这样能让加载更规整，同时不会让调用方误把 padding 当作有效数据。

## 整数编码时，padding 的值不是总为零

这是实现整数编码卷积时最容易忽略的条件。若输入张量使用整数编码，数学上的零对应 `input_zero_point`，而不一定是字面值 `0`。

- 若 GEMM 前已经把输入减去 zero point，落在输入范围外的位置可写数学零（即变换后的字面 `0`）。
- 若 im2col 保留原始整数编码字节，落在输入范围外的位置应填 `input_zero_point`。

两种定义方式都可使用，但 im2col、权重偏移、累加与 requantization 必须采用同一方式。混用“原始输入”和“已减 zero point 的 padding”会在图像边缘产生系统性偏差。

## 性能取舍

完整展开会产生大临时矩阵，尤其是大分辨率、`3×3` 以上卷积和多通道输入。常见优化按优先级如下：

1. **分块展开**：只生成若干输出行，和 GEMM 双缓冲交替执行，降低峰值内存。
2. **专用小核路径**：`1×1` 卷积通常可以直接视为矩阵乘；depthwise convolution 也常直接遍历输入，避免无意义展开。
3. **预重排权重**：让权重布局符合向量加载或矩阵单元要求，避免在热路径重复重排。
4. **对齐与批处理**：按目标 SIMD/NPU 的 tile 大小补齐通道和行步长，同时明确尾部元素的掩码或填充值。

不能只看 GEMM 的峰值算力：如果 im2col 的生成与读写带宽占了主要时间，直接卷积核或 implicit-GEMM 往往更合适。

## 最小测试矩阵

一个可用的 im2col 实现至少应覆盖：

- `padding = 0/1/2`、`stride = 1/2`、`dilation = 1/2`；
- `groups = 1/2/4`，并验证每组通道偏移；
- 左上、右下等落在输入范围外的窗口；
- `1×1`、全覆盖核和不规则通道数；
- 有/无对齐填充的行步长；
- 非零 input zero point 的整数编码输入。

最可靠的参考结果是朴素卷积：对相同输入、权重、bias 和整数编码参数逐元素比较最终输出，而不只比较展开后的中间矩阵。这样能同时发现索引、组偏移、padding 与后处理定义不一致的问题。
