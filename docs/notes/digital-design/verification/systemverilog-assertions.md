---
title: SystemVerilog Assertion：从时序描述到可维护的断言
sidebar_position: 1
slug: /notes/digital-design/systemverilog-assertions
---

# SystemVerilog Assertion：从时序描述到可维护的断言

SystemVerilog Assertions（SVA）的价值不在于堆叠复杂语法，而在于把接口在时间上的承诺写清楚：在哪个时钟采样、复位时是否停止检查、什么事件触发检查，以及之后哪些状态必须或禁止出现。

本文整理常用语法和日常验证中更容易维护的写法。

## 一个属性的四个部分

最常见的并发断言由时钟、失效条件、前件和后件组成：

```systemverilog
property p_req_ack;
  @(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] ack;
endproperty

assert property (p_req_ack);
```

- `@(posedge clk)`：只在指定采样事件上判断；
- `disable iff (!rst_n)`：复位有效时终止正在进行的属性检查；
- `req`：前件，满足时启动一次检查；
- `##[1:3] ack`：后件，要求 `ack` 在随后 1 到 3 个采样周期内出现。

这里 `|->` 是**重叠蕴含**，后件从前件命中的同一采样周期开始；由于后件开头有 `##[1:3]`，实际的 `ack` 仍在后续 1 到 3 拍检查。若希望后件整体从下一拍开始，应使用非重叠蕴含 `|=>`。

```systemverilog
// 请求当拍必须看到 ready。
assert property (@(posedge clk) disable iff (!rst_n) req |-> ready);

// 请求后下一拍必须看到 ack。
assert property (@(posedge clk) disable iff (!rst_n) req |=> ack);
```

## sequence、property 与三种语句

`sequence` 描述一段时序片段，`property` 把片段组织成可验证的规则：

```systemverilog
sequence s_req_then_ack;
  req ##[1:3] ack;
endsequence

property p_req_ack;
  @(posedge clk) disable iff (!rst_n) s_req_then_ack;
endproperty
```

随后通常从三种语句中选择：

```systemverilog
assert property (p_req_ack);   // 设计必须满足
assume property (p_env_ready); // 形式验证中的环境前提
cover  property (p_req_ack);   // 确认这条路径可达
```

`assume` 不是“让失败消失”的开关。环境假设过强会把真实缺陷排除在状态空间之外，因此应只约束接口契约确实保证的行为。

## 常用时序运算符

| 写法 | 含义 | 典型用途 |
| --- | --- | --- |
| `a ##1 b` | `a` 后第 1 个采样周期是 `b` | 固定一拍延迟 |
| `a ##[m:n] b` | `b` 在 m 到 n 拍内出现 | 有上界的应答窗口 |
| `a[*3]` | `a` 连续成立 3 拍 | busy/valid 的连续保持 |
| `a[=2]` | `a` 出现 2 次，中间可间隔 | 事件计数 |
| `a[->1]` | 等到第一次 `a` 命中 | 等待某个目标事件 |
| `s1 intersect s2` | 两个序列同时结束且均成立 | 对齐两个时序条件 |
| `a throughout s` | `s` 的整个匹配区间都满足 `a` | 事务进行期间保持某条件 |

`[*]`、`[=]` 与 `[->]` 的匹配起止位置容易影响蕴含的开始和结束位置。对较复杂的属性，先把 sequence 单独写出并用 `cover` 查看匹配是否符合预期，通常比直接写一行长表达式可靠。

## 采样函数：检查变化而不是组合瞬时值

以下函数是协议断言最常见的基础工具：

```systemverilog
$past(data)       // 上一个采样周期的值；可指定深度
$rose(req)        // 本采样点相对上一点出现 0 -> 1
$fell(req)        // 本采样点相对上一点出现 1 -> 0
$stable(data)     // 与上一采样点相同
$changed(data)    // 与上一采样点不同
$isunknown(data)  // 含 X 或 Z
$onehot(state)    // 恰好一位为 1
$onehot0(state)   // 全 0 或恰好一位为 1
```

例如，valid/ready 接口在等待期间通常要求 valid 和数据保持：

```systemverilog
property p_hold_while_stalled;
  @(posedge clk) disable iff (!rst_n)
    valid && !ready |=> valid && $stable(data);
endproperty

assert property (p_hold_while_stalled);
```

这条规则描述的是“本拍发生阻塞，则下一拍仍保持有效且数据不变”。如果协议允许撤销事务，或 data 只在特定字节使能下稳定，应把这些条件明确写进属性，而不要套用模板。

## 几个高价值模板

### 请求—应答窗口

```systemverilog
property p_req_ack_in_time;
  @(posedge clk) disable iff (!rst_n)
    $rose(req) |-> ##[1:3] ack;
endproperty
```

使用 `$rose(req)` 可以避免同一个持续拉高的 `req` 在每拍都创建新的应答义务。若协议允许多个 outstanding 请求，则需要计数器、ID 或队列模型来关联请求和应答，不能只用这一条简单属性。

### 一热状态机

```systemverilog
assert property (@(posedge clk) disable iff (!rst_n) $onehot(state));
```

若全零是合法 idle 编码，使用 `$onehot0(state)`。这类断言很适合尽早暴露非法状态和复位遗漏。

### 有效数据不含未知值

```systemverilog
assert property (@(posedge clk) disable iff (!rst_n)
  valid |-> !$isunknown(data));
```

对双向总线、复位释放过程或故意使用 X 的仿真模型，应先划定真正需要检查的时段，否则这条规则会产生无价值告警。

### 覆盖目标

```systemverilog
cover property (@(posedge clk) disable iff (!rst_n)
  req ##[1:3] ack);
```

`cover` 不证明设计正确；它回答的是该路径在当前环境假设下是否可达。断言通过而 cover 永远不命中，常提示激励、约束或属性前件写错。

## 用 bind 保持 RTL 干净

验证逻辑不必侵入 DUT 源文件：

```systemverilog
module arb_sva(input logic clk, rst_n, req, ack);
  assert property (@(posedge clk) disable iff (!rst_n)
    req |-> ##[1:3] ack);
endmodule

bind arb arb_sva u_arb_sva (
  .clk(clk), .rst_n(rst_n), .req(req), .ack(ack)
);
```

`bind` 适合复用协议断言、第三方 IP 或不希望改动的 RTL。绑定模块应只观察需要的信号，并通过显式端口连接避免层次路径随重构失效。

## 写断言时的检查清单

1. 先写清采样时钟、复位极性和复位期间的检查策略。
2. 区分“设计保证”与“环境保证”，分别使用 `assert` 和 `assume`。
3. 明确并发事务的关联方式；一个 `req |-> ack` 模板不适用于有多个未完成请求的接口。
4. 对每条关键 `assert` 配一条有意义的 `cover`。
5. 为断言失败保留易读名称和最小复现波形；复杂表达式拆成命名的 sequence/property。

掌握这些原则后，SVA 会从“语法速查表”变成接口契约和回归验证的一部分。
