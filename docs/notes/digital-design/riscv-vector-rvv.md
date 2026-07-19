---
title: RISC-V Vector（RVV）：VL 配置与分段处理
sidebar_position: 7
---

# RISC-V Vector（RVV）：VL 配置与分段处理

RISC-V Vector Extension（RVV）以当前向量长度 `vl` 定义一次向量指令处理的元素数。程序以待处理元素数（AVL）配置 `vsetvli`；该指令写入 `vtype` 并返回本次的 `vl`。随后向量指令只访问元素序号 `[0, vl)`，软件按 `vl` 更新地址和剩余元素数，直至 AVL 为零。该写法不依赖特定的 `VLEN`，同一程序可在不同向量寄存器宽度的实现上执行。

## 程序员可见状态

RVV 增加 32 个向量寄存器 `v0`–`v31`。每个寄存器宽度为实现定义的 `VLEN` 位；支持的最大元素宽度为 `ELEN`。向量类型与执行长度通过以下状态共同描述：

| 名称 | 作用 |
| --- | --- |
| `vtype` | SEW、LMUL、tail/mask 策略与非法配置标志 |
| `vl` | 当前实际向量长度 |
| `vlenb` | 单个向量寄存器的字节数，等于 `VLEN / 8` |
| `vstart` | 可恢复向量指令的起始元素索引 |
| `vxrm` / `vxsat` | 定点舍入模式 / 饱和标志 |

`SEW` 是元素宽度，`LMUL` 决定一个逻辑向量值使用多少个物理寄存器；因此最大元素数近似为 `VLMAX = LMUL × VLEN / SEW`。寄存器分组会影响可用寄存器编号和寄存器压力，不能只看单条指令。

## `vsetvli`：配置元素类型与当前长度

进入每一段处理前，使用 `vsetvli` 配置元素类型并得到当前长度：

```riscv
# a0 = 还剩余的元素数；t0 = 本轮 vl
vsetvli t0, a0, e32, m1, ta, ma
```

- `e32`：元素宽度为 32 位；
- `m1`：一个逻辑向量使用一个物理向量寄存器；
- `ta` / `ma`：tail-agnostic / mask-agnostic，不活动元素和被掩码关闭元素不要求保留旧值；
- `t0`：本次处理长度 `vl`。

设请求长度为 AVL，则 `vl` 满足 `0 ≤ vl ≤ min(AVL, VLMAX)`。当 `0 < AVL ≤ VLMAX` 时，`vl` 等于 AVL；当 `VLMAX < AVL < 2 × VLMAX` 时，`vl` 位于 `ceil(AVL / 2)` 到 `VLMAX` 之间；当 `AVL ≥ 2 × VLMAX` 时，`vl` 等于 `VLMAX`。软件只应使用指令返回的 `vl` 推进地址和计数器。编译器或汇编器还可使用 `vsetivli`（立即数 AVL）与 `vsetvl`（寄存器提供完整 `vtype`）处理特定情形。

## 基于 `vl` 的分段加法

下例计算 `dst[i] = lhs[i] + rhs[i]`，元素为 32 位整数。每次迭代按下列顺序执行：

1. `a0` 提供当前待处理元素数（AVL）。
2. `vsetvli` 返回当前 `vl`，并写入 `vtype`。
3. `vle32.v`、`vadd.vv` 和 `vse32.v` 对元素序号 `[0, vl)` 执行访存和运算。
4. 指针增加 `vl × 4` 字节，`a0` 减去 `vl`。

```riscv
# a0 = count, a1 = lhs, a2 = rhs, a3 = dst
.Lloop:
  vsetvli t0, a0, e32, m1, ta, ma
  vle32.v v8, (a1)
  vle32.v v9, (a2)
  vadd.vv v10, v8, v9
  vse32.v v10, (a3)

  slli a4, t0, 2       # 本轮处理的字节数：vl * sizeof(int32_t)
  add  a1, a1, a4
  add  a2, a2, a4
  add  a3, a3, a4
  sub  a0, a0, t0
  bnez a0, .Lloop
```

最后一段的 `vl` 可以小于 `VLMAX`，不需要为不足一个最大向量长度的元素另设分支。访存、加法和存储仅对活动元素执行。

## 访存、掩码与策略位

- 单位步长访存使用 `vle*.v` / `vse*.v`；元素宽度体现在助记符，例如 `vle32.v`。
- `v0` 常作为掩码寄存器，指令末尾的 `v0.t` 表示只执行掩码为真的元素。
- 不活动元素及掩码为假的元素是否保留旧数据，取决于 `tu/ta`、`mu/ma`。只有后续确实读取旧值时才选择 undisturbed 策略。
- 向量寄存器组和 mask 均受 `vtype` 约束；重配 `vtype` 后，不应假定此前寄存器中的元素还能按相同布局解释。

掩码加法的示意：

```riscv
vmsne.vi v0, v8, 0     # v0[i] = (v8[i] != 0)
vadd.vv  v10, v8, v9, v0.t
```

## 编译与验证项目

1. 通过 `-march` 声明目标 ISA；不同工具链对 `rv64gcv`、具体 `zve*` 子集与 ABI 的支持并不完全相同。
2. 测试至少覆盖小于、等于和大于 `VLMAX` 的长度，以及最后一段。
3. 对 `ta/ma` 路径，禁止测试代码错误读取非活动元素；对 `tu/mu` 路径，验证旧值是否真的需要保留。
4. 上下文切换要考虑 `mstatus.VS` / `sstatus.VS`；向量状态活跃时的保存成本通常远大于整数上下文。
5. 对 RTL，检查 `vl` 选择、`vstart` 异常恢复、掩码关闭元素、寄存器组重叠规则和 `vxsat` 更新。

参考：[RVV 1.0 规范](https://docs.riscv.org/reference/isa/unpriv/v-st-ext.html)。
