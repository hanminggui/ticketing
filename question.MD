## 要求
* 请使用 TypeScript 来答题. 
* 请务必使用 `prettier` 和 `eslint` 来规整代码
* 你可以从以下框架中自选工具使用: `expressjs`, `redis`, `postgresql`, `graphql`, 以及其他任意你熟悉或者喜欢的框架。 
* 服务要容器化并且提供对应的`docker compose`文件
* 你可以从以下框架中自选工具使用: expressjs, redis, postgresql, graphql, 以及其他任意你熟悉或者喜欢的框架。 
* 请创建一个github repo并且把完成代码上传并附上readme来陈述如何运行服务以及测试, 你可以和其他人讨论，甚至我们不反对你写一篇博客讲述完成这个小项目的过程。
* 请尽量Hack任何繁琐的过程，把时间花在核心逻辑上面。我们不需要一套可以实际使用的软件, 例如我们可能不需要真实用户来登陆.
* 请不要写前端代码

---
我们假设一个虚拟场景, 场景中有 10000个乘客(Traveler) 想要购买去不同地方的机票, 总共有200个航班(Flight)。每个航班的capacity是一个`20-80`的随机数。每个航班的起始提供的机票数量为`Flight.capacity`。
乘客(Traveler), 航班(Flight) 和 机票(Ticket) 这些数据信息需要持久化并且可以在系统启动时直接生成好. 

**Note**: 每张机票要求是一张独立的带有(uniqueID)的票。在系统启动时即生成好。总票数等于 `SUM(每个航班的Flight.capacity)`。预定,购买和取消只会改变需要影响到范围内机票(Ticket) 的属性值

**Note2**: 每个乘客在预定，购买以及取消时都需要进行鉴权验证才能进行下一步操作。会有同时大量乘客同时发送请求的情况发生。请考虑好如何处理这种情况。

**Note3** 数据类型可以参考`types.ts`内的定义, 请修改和完善

---

## 需要实现的APIs

### **预定机票(Create)**:
1. 由于需要和航司系统对接，并且其系统比较陈旧，所以预定机票(Ticket)有一个随机 250ms-3000ms 的延时以及一个20%的失败率.
1. 你需要处理上述的失败情况以及提供尽量稳定合理的逻辑实现.
1. 机票(Ticket)只能在同一时间被唯一乘客(Traveler)预定，并且其在同一时间只能预定1张机票。预定的机票如果未操作会在 3 分钟后过期.
1. 每个航班(Flight) 的机票(Ticket) 的总预定数量不能大于该航班(Flight)可以被预定的数量.

```typescript
    const createTicketOrder = () => {}
```

### **购买机票(Pay)**:
1. 由于客户购买机票通过第三方支付接口，例如微信，支付宝，甚至信用卡中心，所以购买机票(Ticket) 有一个随机的 250ms-3000ms 的延时以及一个10%的失败率， 客户支付失败之后可以重新尝试支付该订单。
1. 每个航班(Flight) 的机票(Ticket) 的总购买数量不能大于该航班 (Flight) 的capacity.
1. 机票(Ticket)只能在同一时间被唯一持有该机票预定权的乘客(Traveler) 在预定时间过期(Holding Expiration) 内购买.

```typescript
    const payTicketOrder = () => {}
```

### **取消机票(Cancel)**:
1. 你需要合理的检查机票是否可以被取消。
1. 乘客取消了机票之后，可以被其他乘客购买。
1. 机票(Ticket) 只能被购买了该机票的乘客(Traveler) 取消.

```typescript
    const cancelTicketOrder = () => {}
```

### **实时展示航班(Flight) 和机票(Ticket) 信息**:
    - Flight:
      - Id
      - Capacity
      - 当前剩余的座位数
      - 当前机票价格

1. 需要有一种方式可以实时刷新当前的航班(Flight) 和机票(Ticket) 信息.
   
        currentTicketPrice = Ticket.Flight.basePrice * 
          (Ticket.Flight.booked / Ticket.Flight.capacity * 2 + 1)

```typescript
    const getflightInfo = () => {}
```

## **测试**

请提供: 
 * 单元测试 (Unit Tests)
 * 端到端测试 (E2E Tests)
 * 性能测试 (Performance Tests)

我们希望单元测试代码能够覆盖核心逻辑，端到端测试能够覆盖核心流程，性能测试能够知道该系统的性能边界, (可选)例如显示p50,p95,p99 延时等。


