
# dev
需要本地安装 redis、mysql

## test
```
# test
yarn test

# test & coverage
yarn coverage
```
## start
```
yarn start
```

## production
```
docker-compose build
docker-compose up -d
```

## 项目结构说明
- prisma  prisma工具生成，用于映射数据库结构
- volumes  docker环境下，mysql/redis等镜像需要挂载的数据
- src 
- - interface 接口层
- - - middleware 中间件
- - - response 统一返回结构
- - - router 路由
- - - server api服务入口
- - persistence 持久化层
- - - index 持久化接口定义
- - - lock 锁操作封装
- - - queue 队列操作封装
- - - storage 存储操作封装
- - services 业务服务逻辑层 这里只依赖持久化层的接口，不依赖具体实现
- - - airlineService 模拟航司系统
- - - payService 模拟第三方支付服务
- - - ticketService 票务系统
- - test 单元测试、E2E测试

- 
