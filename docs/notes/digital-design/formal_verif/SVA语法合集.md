# SystemVerilog Assertions（SVA）完整中文教程

## 1. SVA 解决什么问题

SVA 是用 SystemVerilog 描述时间相关规则的一组语言结构。它不仅可以检查单个信号是否为正确值，还能表达“请求以后数拍内必须应答”“在握手完成之前数据必须保持稳定”等跨周期关系。SVA 可以用于仿真，亦可以在形式验证时被工具转化为逻辑属性。SVA 本身并不让环境自动合法；外部输入要求仍然需要明确的假设和复位模型。

![SVA 触发与周期关系](插图/05_SVA时序.svg)

## 2. 先理解三种角色

```systemverilog
ap_safety: assert property (@(posedge clk) disable iff (!rst_n)
                            !(write && full && !read));
as_input:  assume property (@(posedge clk) disable iff (!rst_n)
                            req |-> input_valid);
cp_full:  cover  property (@(posedge clk) disable iff (!rst_n)
                            full);
```

`assert property` 定义需要被验证的设计责任；`assume property` 描述环境向设计提供的约束；`cover property` 请求寻找满足某条行为的输入轨迹。不要把设计错误的结论改写为 `assume` 以获得更多的 `Proven`。

## 3. 并发断言的时钟、采样与失效条件

### 3.1 标准结构

```systemverilog
property p_example;
  @(posedge clk) disable iff (!rst_n)
  trigger |-> ##[1:3] response;
endproperty

ap_example: assert property (p_example);
```

- `@(posedge clk)`：属性在时钟上升沿采样。
- `disable iff (!rst_n)`：复位低有效期间关闭或中止该属性的活动求值。
- `trigger`：时序要求的触发部分；称为前件（antecedent）。
- `|->`：重叠蕴含；后件从前件序列匹配结束的那个采样周期开始。
- `##[1:3] response`：允许未来第 1、2 或 3 个采样周期响应。

SVA 并发断言在时钟事件的采样值上判断表达式，通常会看到 **NBA 非阻塞赋值更新之前**采样到的值。因此，在 `always_ff @(posedge clk)` 中用非阻塞赋值更新的寄存器，其新值通常在下一次采样沿才被断言看到。检查“状态更新后”的规则时往往需要 `|=>` 或 `$past`。

### 3.2 复位并不是采样函数历史自动清零

`disable iff` 是属性失效条件；不能将其理解为 `$past` 自动替换成复位值。比如初次进入正常工作状态时，上一拍可能仍处于复位。如果规则依赖上一拍已经处于有效工作状态，应增加 `past_valid` 寄存器或适当的 `$past(rst_n)` 前提。

```systemverilog
logic past_valid;
always_ff @(posedge clk or negedge rst_n)
  if (!rst_n) past_valid <= 1'b0;
  else        past_valid <= 1'b1;

ap_hold: assert property (@(posedge clk) disable iff (!rst_n)
  past_valid && hold |-> data == $past(data));
```

上例的 `past_valid` 为工具提供可信的前一采样点。在不同时间点立即释放/断言复位时，异步 `disable iff` 和时钟采样的交互仍应按 DUT 的实际复位语义审查。

### 3.3 default clocking / default disable iff

```systemverilog
default clocking cb @(posedge clk); endclocking
default disable iff (!rst_n);

ap_onehot: assert property ($onehot0(grant));
```

适用于同一时钟下的属性模块。多时钟或不同复位域，建议为每条关键属性显式指定时钟和失效条件，避免默认时钟覆盖不匹配的接口。

## 4. 重叠蕴含与非重叠蕴含

| 写法编号 | 后件起点 | 前件在第 5 拍成立时检查哪一拍 |
| --- | --- | --- |
| A：重叠蕴含 | 前件结束的同一拍 | 第 5 拍 |
| B：非重叠蕴含 | 前件结束后的下一拍 | 第 6 拍 |
| C：重叠后延迟两拍 | 从同一拍再计两拍 | 第 7 拍 |
| D：非重叠后延迟两拍 | 从下一拍再计两拍 | 第 8 拍 |

```systemverilog
// A：同拍；B：下一拍；C：两拍后；D：三拍后。
a |-> b
a |=> b
a |-> ##2 b
a |=> ##2 b
```

上表以单周期布尔前件 `a` 为例。重叠与非重叠决定后件从哪里开始，再由后件自身的延迟决定实际检查周期。因此非重叠后再写两拍延迟，合计是前件结束后三拍，不是两拍。对长度大于一拍的前件，起点是前件**完成匹配的那一拍**，而不是前件开始的那一拍。

```systemverilog
// req 在第 5 拍、accept 在第 7 拍完成前件。
// ap_same 检查第 7 拍的 busy；ap_next 检查第 8 拍的 busy。
ap_same: assert property (@(posedge clk) disable iff (!rst_n)
    (req ##2 accept) |-> busy);
ap_next: assert property (@(posedge clk) disable iff (!rst_n)
    (req ##2 accept) |=> busy);
```

这里的简单单时钟布尔后件可以用一拍显式延迟改写非重叠蕴含。复杂序列可能有多个结束匹配或空匹配，多时钟属性还有专门的时钟衔接规则，不能只根据符号外观机械替换。每条关键规则应写清触发周期、前件结束周期和预计失败周期。

## 5. sequence 和 property 的职责

```systemverilog
sequence s_accept;
  valid && ready;
endsequence

sequence s_finish_within_3;
  ##[1:3] done;
endsequence

property p_finish;
  @(posedge clk) disable iff (!rst_n)
  s_accept |-> s_finish_within_3;
endproperty

ap_finish: assert property(p_finish);
```

`sequence` 描述如何匹配一个有限时序片段；`property` 组合时序规则、蕴含、停止和其他属性运算符。复杂序列可以接受参数和局部变量，用于协议检测、延迟记录及数据关联。推荐给可重复使用的时序模式起易读的名称。

## 6. 序列连接与延迟运算符

### 6.1 固定延迟 `##n`

```systemverilog
sequence s_two_cycles;
  a ##2 b;
endsequence
```

这要求 `a` 后第二个采样时刻 `b` 成立。`a ##0 b` 要求二者在同一采样时刻满足。当 `a` 是多周期序列时，`##n` 从 `a` 匹配结束处计算。

### 6.2 范围延迟 `##[m:n]`

```systemverilog
ap_ack_1_4: assert property (@(posedge clk) disable iff (!rst_n)
  $rose(req) |-> ##[1:4] ack);
```

`ack` 可以在第 1～4 拍任一时刻满足。要注意**逐拍重新发起的并行检查**：如果 `req` 连续高 4 拍，使用 `req` 作为前件就会发起 4 条独立的响应义务。使用 `$rose(req)` 仅表示检测上升沿，仍不一定等价于总线“接受请求”的定义。

### 6.3 连续重复 `[*]`

```systemverilog
// busy 必须持续 3 拍
ap_busy: assert property (@(posedge clk) disable iff (!rst_n)
  start |-> ##1 busy[*3]);

// ready 可以延迟出现，示意有界等待
ap_wait: assert property (@(posedge clk) disable iff (!rst_n)
  start |-> (!ready)[*0:3] ##1 ready);
```

`[*3]` 表示连续 3 次匹配；`[*1:4]` 表示连续 1～4 次；`[*0:$]` 允许零次且上限无限，和后续表达式连接时可能形成意料外的空匹配。尤其是空匹配与蕴含组合，必须通过覆盖和波形验证真正在检查的规则。

### 6.4 非连续重复 `[=]` 与 goto 重复 `[->]`

```systemverilog
sequence s_three_events;
  event_a[=3];
endsequence

sequence s_second_hit;
  event_a[->2];
endsequence
```

`[=3]` 描述在一段匹配范围内出现三次非连续的 `event_a`，可在最后一次命中后继续匹配非事件周期；`[->2]` 直到第二次事件命中处结束。两者区别会改变和后续 `##1 b` 的关系，复杂协议建议先写小型波形测试确认其末端匹配位置。

## 7. 序列的组合

### 7.1 `and` / `or` / `intersect`

```systemverilog
sequence s_both;
  (a ##1 b) and (c ##2 d);
endsequence

sequence s_one;
  (a ##1 b) or (a ##2 b);
endsequence

sequence s_same_window;
  (a ##1 b) intersect (c ##1 d);
endsequence
```

`and` 要求两个序列都匹配，但它们的结束位置不要求相同；`intersect` 要求匹配区间的开始和结束一致。`or` 允许任意一个序列匹配。不要把序列 `and` 与普通同周期位运算 `&&` 混淆。

### 7.2 `throughout`：范围内持续成立

```systemverilog
ap_hold_during_busy: assert property (@(posedge clk) disable iff (!rst_n)
  start |-> (enable throughout (busy[*1:5] ##1 done)));
```

`expr throughout sequence` 表示布尔表达式在被匹配序列涉及的全部采样位置保持真。对于简单请求保持协议，通常 `req && !ack |=> req` 更直接、更易审查。

### 7.3 `within`：一个时序片段位于另一个片段范围中

```systemverilog
sequence s_short;
  a ##1 b;
endsequence
sequence s_outer;
  start ##[1:5] stop;
endsequence
sequence s_inside;
  s_short within s_outer;
endsequence
```

`within` 可以表达一个事件序列完整发生在更大序列匹配区间之内。涉及可变时长时要特别警惕匹配歧义。使用工具的 `cover` 检查预期的代表性路径。

### 7.4 `first_match`

```systemverilog
sequence s_first_ack;
  first_match(##[1:8] ack);
endsequence
```

用于从候选匹配中选取首次匹配，减少后续序列对不同匹配长度的歧义。不是所有需要“最早应答”的规则都要使用 `first_match`；如果只要求区间内任一次应答，则直接使用范围延迟更清楚。

## 8. 属性运算符：时间上的持续和终止

### 8.1 `until` 与 `until_with`

```systemverilog
ap_keep_valid: assert property (@(posedge clk) disable iff (!rst_n)
  req |-> (valid until_with ack));
```

`until` 不要求条件在终止条件发生的那个周期仍成立；`until_with` 要求在终止周期也成立。弱形式可能不要求终止条件真的出现，因此如果要求“必须最终完成”，还需要强形式或独立的有界完成检查。

### 8.2 `strong` 与 `weak`

```systemverilog
ap_eventual: assert property (@(posedge clk) disable iff (!rst_n)
  req |-> strong(##[1:$] ack));
```

`strong` 表示时序匹配最终必须结束（具体可证明性视形式应用、活性支持以及公平性而定）；`weak` 允许一些有限轨迹或无限未完成场景下的宽松解释。无条件无限等待往往困难，实际项目应先考虑规范是否可以给出合理的最大响应延迟。强活性属性通常需要假设外部持续提供时钟与资源。

### 8.3 `accept_on` / `reject_on`

属性可在规定事件发生时被提前接受或拒绝。例如，一次事务在取消信号到来后不再要求原始应答，是否“取消即成功”必须符合协议而不能仅为了避免失败。`disable iff` 通常用于复位；`accept_on` 可用于协议意义上的正常取消；`reject_on` 可用于协议明确规定的提前失败条件。两者与采样时刻有关，项目需要按工具实现验证。

## 9. 常用采样函数

| 函数 | 含义 | 典型用途 | 容易忽略的地方 |
| --- | --- | --- | --- |
| `$past(expr, n)` | 读取前 n 次采样的值 | 下一周期状态关系 | 起始历史值未定义 |
| `$rose(expr)` | 检测从非真到真的变化 | 捕获请求新事务 | 不等同于 `req && ready` |
| `$fell(expr)` | 检测从真到非真的变化 | 撤销请求 | 异步与 X 变化要谨慎 |
| `$stable(expr)` | 当前值与上一采样相同 | 等待期间数据保持 | 初始样本的比较问题 |
| `$changed(expr)` | 与上一采样不同 | 寻找状态翻转 | 重复周期持续匹配 |
| `$isunknown(expr)` | 表达式包含 X 或 Z | 仿真与 X 检查 | 二值形式模型解释可不同 |
| `$onehot(expr)` | 恰有一位为 1 | 必须存在且唯一授权 | 空闲时全零会失败 |
| `$onehot0(expr)` | 最多一位为 1 | 允许空闲的授权 | 不能保证至少有一位 |
| `$countones(expr)` | 统计为 1 的位数 | 配额/令牌检查 | 大位宽求解可能昂贵 |
| `$initstate` | 初始时间检测 | 初始化相关规则 | 工具、上下文支持需核对 |

### 9.1 `$past` 的正确使用

```systemverilog
ap_count_inc: assert property (@(posedge clk) disable iff (!rst_n)
  past_valid && $past(inc && !clear)
    |-> count == $past(count) + 1'b1);
```

这是在**当前采样周期**检查上一周期已满足加一条件后的寄存器值。若计数器会饱和或回绕，还必须补上对应前提。需要特别确认 `past_valid` 的第一个有效周期与设计运行时序一致。

### 9.2 `$stable` 的常见错误

对 `valid && !ready |=> $stable(data)` 的解释要看接口在下一拍是否仍继续 `valid`。若数据在 `valid && ready` 发生后下一拍可以自由变化，则这个规则可能过度严格。更常用且直观的条件是：

```systemverilog
ap_stable_when_stalled: assert property (@(posedge clk) disable iff (!rst_n)
  valid && !ready |=> valid && $stable(data));
```

这个写法要求：上一拍未被接受的传输，下一拍仍保持 `valid` 和数据，恰好符合很多 ready/valid 接口的要求。允许在下一拍被接受并不改变“采样的当前数据仍应保持”的要求。

## 10. 立即断言和并发断言的区别

```systemverilog
always_comb begin
  assert (!(grant[0] && grant[1]))
    else $error("two simultaneous grants");
end

ap_grant: assert property (@(posedge clk) disable iff (!rst_n)
  $onehot0(grant));
```

立即断言在过程执行时检查瞬时条件，可能受组合逻辑的调度次序、暂态变化及 X 值影响；并发断言按事件采样，便于表达时序关系。形式验证中要遵循该工具对即时/延迟断言支持的说明；不能把所有仿真调试语句当成可被形式引擎直接证明的属性。

## 11. 属性局部变量、`let` 和参数化

### 11.1 `let`：抽象复杂布尔条件

```systemverilog
let accepted(v, r) = (v && r);

ap_no_drop: assert property (@(posedge clk) disable iff (!rst_n)
  accepted(valid, ready) |-> !error);
```

`let` 表达式可复用，减少同一接口条件在几十条属性中被不同工程师写出微小差异。是否使用 `let` 由编译器支持情况决定。

### 11.2 sequence 局部变量：关联请求与响应数据

```systemverilog
property p_data_return;
  logic [7:0] saved_id;
  @(posedge clk) disable iff (!rst_n)
    (req, saved_id = req_id) |-> ##[1:4]
      (rsp && rsp_id == saved_id);
endproperty
ap_data_return: assert property (p_data_return);
```

此属性为**每一次匹配的请求**保存其标识并要求窗口内匹配应答。若允许多个并发请求且同一标识重复使用，仍需根据协议处理事务编号、队列深度、重排规则和独立超时。局部变量并非 RTL 中真的增加了寄存器，工具可能为断言引入匹配状态，过度复杂的动态序列会增加形式求解成本。

### 11.3 参数化属性

```systemverilog
module ready_valid_checker #(
  parameter int DATA_W = 32,
  parameter int RESP_MAX = 8
) (
  input logic clk, rst_n, valid, ready,
  input logic [DATA_W-1:0] data
);
  ap_stall: assert property (@(posedge clk) disable iff(!rst_n)
    valid && !ready |=> valid && $stable(data));
  cp_transfer: cover property (@(posedge clk) disable iff(!rst_n)
    valid && ready);
endmodule
```

参数化断言适合复用在多个实例；但 `RESP_MAX` 等参数如果在属性中用于常量延迟，必须遵守工具对常量表达式的要求。

## 12. `bind`：无需改动设计源码注入 SVA

```systemverilog
module counter_checker (
  input logic clk, rst_n, inc,
  input logic [3:0] count
);
  ap_range: assert property (@(posedge clk) disable iff(!rst_n)
    count <= 4'd9);
  cp_full: cover property (@(posedge clk) disable iff(!rst_n)
    count == 4'd9);
endmodule

bind counter counter_checker u_checker (
  .clk(clk), .rst_n(rst_n), .inc(inc), .count(count)
);
```

`bind` 在指定设计模块或实例上附加检查器，不必改动交付 RTL。但要确保端口名与被绑定模块一致，检查器的编译顺序正确，且顶层编译开启断言支持（例如相应流程中的 `-sva`）。**不要在形式测试文件里用 `assign` 强行驱动 DUT 的内部状态来代替外部约束**。

## 13. 常见系统级断言模板

### 13.1 复位值

```systemverilog
ap_reset_state: assert property (@(posedge clk)
  !rst_n |-> state == IDLE);
```

此示例适用于复位在该采样时钟上足够早生效，且状态在这一采样点应已为 `IDLE` 的协议模型。若同步复位在 `posedge clk` 的 NBA 才生效，应换成正确的下一拍检查；异步复位应另外确认有效瞬间与采样要求。

### 13.2 一热与互斥

```systemverilog
ap_mutex: assert property (@(posedge clk) disable iff(!rst_n)
  $onehot0(grant));
ap_one_grant_when_pending: assert property (@(posedge clk) disable iff(!rst_n)
  pending |-> $onehot(grant));
```

第二条仅适用于协议要求有请求时必须立刻授权，否则应改成有界最终授权，并定义公平条件。

### 13.3 请求—应答

```systemverilog
ap_ack: assert property (@(posedge clk) disable iff(!rst_n)
  (req && accept) |-> ##[1:3] ack);
cp_req: cover property (@(posedge clk) disable iff(!rst_n)
  req && accept);
```

该写法有一个明确的受理事件；如果 `ack` 可能与受理同周期，则窗口改成 `##[0:3]`。若协议允许接受多个请求，需要采用事务关联检查。

### 13.4 背压期间保持

```systemverilog
ap_hold: assert property (@(posedge clk) disable iff(!rst_n)
  valid && !ready |=> valid && $stable(payload));
```

对于标准 ready/valid 流控制，后一拍可以 `ready` 变为 1，此时仍须在握手时提供原来的 `payload`。

### 13.5 FIFO 不上溢、不下溢与计数范围

```systemverilog
ap_depth: assert property (@(posedge clk) disable iff(!rst_n)
  occupancy <= DEPTH);
ap_no_empty_pop: assert property (@(posedge clk) disable iff(!rst_n)
  pop_accept |-> !empty);
ap_no_full_push: assert property (@(posedge clk) disable iff(!rst_n)
  push_accept |-> (!full || pop_accept));
```

这里假定 FIFO 允许满状态同时读写（具体需看实现），`push_accept/pop_accept` 是**已接受操作**而不是原始请求。若 `push` 为请求而硬件可以拒绝，那么 `push && full` 并非必然错误。计数器溢出的检查应与接受操作和旁路条件一致。

### 13.6 超时与重试

```systemverilog
ap_timeout: assert property (@(posedge clk) disable iff(!rst_n)
  launch |-> ##[1:8] (done || timeout));
```

本例只保证在第 1～8 拍的某一拍看到完成或超时，没有保证二者互斥；如果规定互斥，另外增加 `!(done && timeout)` 断言。

### 13.7 有限状态机状态合法性

```systemverilog
ap_state_legal: assert property (@(posedge clk) disable iff(!rst_n)
  state inside {ST_IDLE, ST_REQ, ST_WAIT, ST_DONE});
```

`inside` 中的常量值必须与 RTL 一致。枚举类型有时可以使用更清晰的编码检查；该属性只能证明取值合法，不能证明所有转移符合协议。

### 13.8 安全权限控制

```systemverilog
ap_secure_write: assert property (@(posedge clk) disable iff(!rst_n)
  write_accept && secure_reg_sel |-> privileged);
```

还需要检查非法请求是否被阻止、读路径是否泄漏以及复位后的权限状态。单条写入权限断言不代表已经证明没有信息泄漏。

## 14. 空洞性、覆盖目标与不恰当假设

```systemverilog
ap_req_ack: assert property (@(posedge clk) disable iff(!rst_n)
  req |-> ##[1:3] ack);
cp_req_seen: cover property (@(posedge clk) disable iff(!rst_n)
  req);
cp_req_ack: cover property (@(posedge clk) disable iff(!rst_n)
  req ##[1:3] ack);
```

反例：如果在其他文件里写了 `assume property(!req)`，`ap_req_ack` 可能轻松被证明，但是 `cp_req_seen` 不可达。**验证环境需要既让合法关键场景可达，又排除真实接口所禁止的输入行为。**

工程里建议同时维护三类检查：设计断言；环境前提的注释与审查；关键规格场景覆盖。形式覆盖与仿真覆盖不是同一概念，应分别分析。

## 15. 常见错误及修正方法

| 错误类别 | 直接后果 | 修正方向 |
| --- | --- | --- |
| 同拍与下一拍混淆 | 检查过早或过晚 | 先画采样周期，再选蕴含形式 |
| 非重叠后重复计算延迟 | 比规格多等待一拍 | 以完整前件结束时刻为零点 |
| 无效历史值 | 首拍错误失败或错误通过 | 建立历史有效标志 |
| 无界弱等待 | 未表达必须最终响应 | 使用有界响应或明确强活性 |
| 前件从未触发 | 属性空通过 | 添加触发和完成覆盖目标 |
| 接收方始终就绪假设 | 屏蔽背压缺陷 | 只保留真实协议前提 |
| 一热规则不允许全零 | 合法空闲状态失败 | 区分恰好一个与最多一个 |
| 把设计责任写成假设 | 直接排除了错误状态 | 对设计责任使用断言 |
| 用复位禁用代替复位验证 | 复位值从未被检查 | 分别检查初始化与复位行为 |
| 以一次完成覆盖代替进展性 | 遗漏永久等待请求 | 对每次合法请求检查完成 |

**先把时间关系写正确。** 下一拍应答与两拍后应答应使用不同的序列。以下属性都显式给出时钟和复位，其中第二条等价于第一条的简单布尔情形；第三条要求两拍后响应，而非三拍后响应。

```systemverilog
ap_next_1: assert property (@(posedge clk) disable iff (!rst_n)
    req |=> ack);
ap_next_2: assert property (@(posedge clk) disable iff (!rst_n)
    req |-> ##1 ack);
ap_two_cycles: assert property (@(posedge clk) disable iff (!rst_n)
    req |-> ##2 ack);
```

**历史值与复位分别处理。** `$past(data)` 读取的是过去采样点的值，`disable iff` 中止属性尝试，却不会自动把所有历史采样变成期望值。需要一拍历史时，可以设置复位后才拉高的 `past_valid`；需要多拍历史时，有效标志也要覆盖足够长的历史窗口。运行中再次复位是否允许，应与工具对初始复位的处理区分。

```systemverilog
logic past_valid;
always_ff @(posedge clk or negedge rst_n)
  if (!rst_n) past_valid <= 1'b0;
  else        past_valid <= 1'b1;

ap_hold_when_stalled: assert property (
    @(posedge clk) disable iff (!rst_n)
    past_valid && $past(valid && !ready)
    |-> valid && $stable(data));
```

**通过必须有合适的触发场景。** 不能把 `ready` 固定为 1 后声称已经验证背压，也不能把计数范围直接写成假设后再证明同一个范围。对于允许空闲的授权向量，应检查最多一位有效；覆盖目标分别确认请求出现和一次完整事务可发生，但不能代替每次请求的完成断言。

```systemverilog
ap_grant_exclusive: assert property (
    @(posedge clk) disable iff (!rst_n) $onehot0(grant));
ap_response_deadline: assert property (
    @(posedge clk) disable iff (!rst_n) req |-> ##[1:3] ack);
cp_request: cover property (
    @(posedge clk) disable iff (!rst_n) req);
cp_transaction: cover property (
    @(posedge clk) disable iff (!rst_n) req ##[1:3] ack);
```

**无限等待需要明确的活性要求。** 不应把带无界延迟的弱序列直接解释为“最终一定应答”。真实规格有超时上限时，用有界窗口；没有上限而又要求最终完成时，需要强活性表达以及可解释的环境公平性。以下写法要求存在一个有限的匹配终点，但仍要核对所使用工具对相应活性形式的支持，不能为了证明方便随意增加“外部必然响应”的假设。

```systemverilog
ap_eventual_response: assert property (
    @(posedge clk) disable iff (!rst_n)
    req |-> strong(##[0:$] ack));
```

## 16. 多时钟属性、X 值与复杂语法的限制

多时钟属性在 SystemVerilog 标准中有专门的采样与序列连接规则，不能简单将两种时钟事件放入单时钟模板。不同 EDA 引擎对多时钟交叉属性支持可能有限；参考 VC Formal User Guide §3.9 的具体限制。跨时钟同步器、握手与异步 FIFO 通常需分别定义每个时钟域的责任及跨时钟的数据一致性。

`$isunknown` 在四值仿真中很直观，但传统形式证明的二值布尔编码可能与仿真中的 X 传播语义不同；检查 RTL 中 X 传播风险更适合配合 VC Formal FXP 和明确的注入/观察模型。写有 `casex`、`casez`、`unique case` 的 RTL 时，还应结合综合与仿真对 X 的不同处理方式审查。

## 17. 完整示例：有界计数器及 VC Formal 工程

前文的短代码块用于解释单个语法；本节则给出可保存成文件的完整设计、检查器、编译列表和 Tcl。代码与 FPV 章的计数器案例保持一致。

### 17.1 被验证的计数器 RTL

规格：复位后计数为零；使能时从 0 计到 9 后回到 0；没有使能时保持。RTL 文件只包含设计，不把待验证结论写成环境假设。

**保存为 `案例工程/rtl/counter.sv`：**

<!-- source-begin: 案例工程/rtl/counter.sv -->

```systemverilog
module counter (
    input  logic       clk,
    input  logic       rst_n,
    input  logic       enable,
    output logic [3:0] count
);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n)             count <= 4'd0;
    else if (enable) begin
      if (count == 4'd9)    count <= 4'd0;
      else                  count <= count + 4'd1;
    end
  end
endmodule
```

<!-- source-end -->

### 17.2 完整断言与绑定文件

`history_valid` 在复位后建立历史有效标志。`ap_range` 检查范围，`ap_hold` 检查保持，`ap_increment` 检查普通递增，`ap_wrap` 检查回绕；两条 `cover` 检查最高计数值及回绕场景是否能够出现。末尾 `bind` 将检查器接入同名设计信号，不需要修改 RTL。

**保存为 `案例工程/formal/counter_props.sv`：**

<!-- source-begin: 案例工程/formal/counter_props.sv -->

```systemverilog
module counter_props (
    input logic       clk, rst_n, enable,
    input logic [3:0] count
);
  logic history_valid;
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) history_valid <= 1'b0;
    else        history_valid <= 1'b1;

  ap_range: assert property (@(posedge clk) disable iff (!rst_n)
      count <= 4'd9);

  ap_hold: assert property (@(posedge clk) disable iff (!rst_n)
      history_valid && $past(!enable) |-> count == $past(count));

  ap_increment: assert property (@(posedge clk) disable iff (!rst_n)
      history_valid && $past(enable && count < 4'd9)
      |-> count == $past(count) + 4'd1);

  ap_wrap: assert property (@(posedge clk) disable iff (!rst_n)
      history_valid && $past(enable && count == 4'd9)
      |-> count == 4'd0);

  cp_reaches_nine: cover property (@(posedge clk) disable iff (!rst_n)
      count == 4'd9);
  cp_wrap: cover property (@(posedge clk) disable iff (!rst_n)
      count == 4'd9 ##1 count == 4'd0);
endmodule

bind counter counter_props u_counter_props (.*);
```

<!-- source-end -->

### 17.3 编译文件列表

先列 RTL，再列包含 `bind` 的属性文件；路径相对于运行 VC Formal 的 `案例工程/` 目录，而不是 Tcl 文件所在目录。

**保存为 `案例工程/filelist_counter.f`：**

<!-- source-begin: 案例工程/filelist_counter.f -->

```text
./rtl/counter.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 17.4 完整运行脚本

依次选择应用、读入设计与 SVA、定义时钟复位、保存初始状态、检查设置、列出属性并开始证明。初始化步骤需要在实际安装环境核对复位状态，不能把声明复位等同于已经完成复位。

**保存为 `案例工程/scripts/fpv_counter.tcl`：**

<!-- source-begin: 案例工程/scripts/fpv_counter.tcl -->

```tcl
# Run from the example project root with: vcf -f scripts/fpv_counter.tcl -batch
set_fml_appmode FPV
read_file -top counter -sva -format sverilog -vcs {-f filelist_counter.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
report_fv_setup -list
report_fv -list
set_fml_var fml_max_time 1H
set_fml_var fml_max_memory 8GB
check_fv -block
report_fv -verbose
```

<!-- source-end -->

**运行命令（Bash）：**

```bash
# 从包含“案例工程”目录的上一级目录开始。
cd 案例工程
mkdir -p logs
set -o pipefail
vcf -f scripts/fpv_counter.tcl -batch 2>&1 | tee logs/fpv_counter.log
```

**结果阅读。** 在初始状态正确的前提下，正确版预期满足这些断言，并存在到达 9 和回绕的覆盖轨迹。这不是本次 VC Formal 的实际运行结果。这些断言分别覆盖范围、保持、普通递增和回绕；复位值及运行中重新复位仍需结合初始化模型和专用复位检查，不能仅凭范围属性成立就认定全部功能正确。

## 18. 工程练习（建议自行运行与审查）

1. 将计数器回绕阈值从 9 改为 10，观察 `ap_range` 的反例；将阈值改回后重复证明。
2. 删除 `history_valid`，分析首个有效采样点 `$past` 规则的差异。
3. 为一个 2 输入仲裁器编写互斥、授权必须对应请求和竞争覆盖三类属性。
4. 为 ready/valid 通道编写背压保持、握手可达与连续握手覆盖。
5. 故意加入约束 `assume(!enable)`，观察覆盖目标为什么无法满足，并撤销该约束。

本章第 17 节已直接列出练习所需的 RTL、SVA、文件列表与完整运行脚本；独立源码文件仅用于方便编辑，不是阅读本章的前置要求。

## 19. 语法检索与选择

| 类别 | 语法或函数 | 适合描述的问题 |
| --- | --- | --- |
| 角色 | `assert`、`assume`、`cover` | 设计责任、环境前提和可达性 |
| 采样 | `@`、`default clocking` | 用哪个事件观察信号 |
| 失效 | `disable iff` | 哪些条件中止当前检查尝试 |
| 蕴含 | 重叠、非重叠 | 前件完成后何时开始后件 |
| 延迟 | `##n`、范围延迟 | 事件间的周期关系 |
| 重复 | 连续、非连续、goto | 事件需要重复多少次 |
| 序列组合 | `and`、`or`、`intersect` | 多段行为的组合及结束时刻 |
| 区间关系 | `throughout`、`within` | 条件持续或片段包含 |
| 匹配控制 | `first_match` | 选择首个完成匹配 |
| 时间终止 | `until`、`until_with` | 终止事件发生前后的条件保持 |
| 强弱要求 | `strong`、`weak` | 是否必须存在完成的匹配 |
| 历史采样 | `$past`、`$rose`、`$fell` | 过去值与边沿变化 |
| 稳定和互斥 | `$stable`、`$onehot0`、`$onehot` | 数据保持与授权关系 |
| 检查器复用 | `property`、`sequence`、`let`、`bind` | 参数化并接入多个实例 |

语法选择应从规格问题出发，而不是先选一个看起来简短的运算符。例如“忙期间数据不变”要明确忙区间是否包含最后一拍；“接到请求后响应”要明确请求是电平、脉冲还是握手接受事件；“响应对应请求”还必须说明是否允许多个未完成事务。下面集中列出容易在表格中被误拆的运算符和序列写法，均保持原字符，可直接复制到适当的序列或属性上下文。

```systemverilog
a |-> b
a |=> b
a ##2 b
a ##[1:3] b
a[*3]
a[=3]
a[->3]
```

这些是语法片段，不是一个完整模块，也不能在顶层源码中连续粘贴后直接编译。完整带时钟、复位、绑定和运行脚本的示例见本章第 17 节。

## 20. 参考与责任界定

本教程独立编写，对照 IEEE 1800 的常见语法概念以及用户所给 *VC Formal User Guide* X-2025.06-SP1 §3.7～3.9、附录 B。工具具体支持范围、强活性处理、采样行为和优化由正式安装版本决定。本文示例用于教学；没有声称在用户实际 VC Formal 授权环境中运行过全部代码。
