export type VocabularyWord = {
  word: string;
  meaning: string;
  example: string;
  translation: string;
  level: "easy" | "medium" | "hard";
  family: string;
};

const VERB_SEEDS = `
accept|接受
add|添加
admire|钦佩
admit|承认
advise|建议
agree|同意
allow|允许
answer|回答
appear|出现
apply|申请
appreciate|欣赏
approve|赞成
argue|争论
arrive|到达
ask|询问
attach|附上
avoid|避免
bake|烘烤
balance|平衡
believe|相信
belong|属于
blink|眨眼
boil|煮沸
borrow|借入
breathe|呼吸
brush|刷洗
call|呼叫
care|关心
carry|携带
celebrate|庆祝
change|改变
charge|收费
chase|追赶
check|检查
cheer|欢呼
clean|清洁
clear|清除
climb|攀爬
close|关闭
collect|收集
color|涂色
compare|比较
complete|完成
consider|考虑
continue|继续
cook|烹饪
copy|复制
count|计数
cover|覆盖
create|创造
cross|穿过
dance|跳舞
decide|决定
decorate|装饰
delay|延迟
deliver|递送
describe|描述
design|设计
discover|发现
discuss|讨论
divide|划分
dress|穿衣
drop|掉落
dry|晾干
earn|赚取
educate|教育
empty|清空
encourage|鼓励
enjoy|享受
enter|进入
escape|逃离
examine|检查
excite|使兴奋
exercise|锻炼
explain|解释
explore|探索
face|面对
fill|填满
finish|结束
follow|跟随
gather|聚集
greet|问候
guess|猜测
guide|引导
handle|处理
happen|发生
help|帮助
hope|希望
hurry|赶快
imagine|想象
improve|改善
include|包括
increase|增加
invite|邀请
join|加入
joke|开玩笑
jump|跳跃
kick|踢
kiss|亲吻
knock|敲击
label|标记
land|着陆
last|持续
laugh|大笑
learn|学习
like|喜欢
listen|倾听
live|居住
load|装载
lock|锁上
look|看
love|爱
manage|管理
march|行进
marry|结婚
measure|测量
miss|错过
mix|混合
move|移动
name|命名
need|需要
notice|注意
offer|提供
open|打开
order|订购
organize|组织
pack|打包
paint|绘画
park|停车
pass|通过
phone|打电话
pick|挑选
place|放置
plan|计划
play|玩
point|指向
practice|练习
prefer|更喜欢
prepare|准备
present|展示
promise|承诺
protect|保护
provide|提供
pull|拉
push|推
rain|下雨
reach|到达
receive|收到
record|记录
relax|放松
remember|记住
repeat|重复
reply|回复
return|返回
save|保存
search|寻找
share|分享
shop|购物
shout|喊叫
smile|微笑
snow|下雪
sound|听起来
start|开始
stay|停留
step|迈步
stop|停止
study|学习
suggest|建议
talk|交谈
taste|品尝
thank|感谢
touch|触摸
train|训练
travel|旅行
try|尝试
turn|转动
use|使用
visit|参观
wait|等待
walk|步行
want|想要
wash|清洗
watch|观看
water|浇水
wave|挥手
welcome|欢迎
whisper|低语
wish|希望
work|工作
worry|担心
act|行动
address|处理
adjust|调整
announce|宣布
apologize|道歉
approach|接近
attack|攻击
attempt|尝试
attract|吸引
bathe|洗澡
behave|表现
book|预订
camp|露营
cancel|取消
cause|导致
challenge|挑战
connect|连接
control|控制
correct|纠正
cough|咳嗽
crash|碰撞
cycle|骑车
damage|损坏
depend|依靠
develop|发展
disagree|不同意
disappear|消失
download|下载
drag|拖动
dream|做梦
email|发邮件
end|结束
exchange|交换
exist|存在
expect|期待
fail|失败
fear|害怕
float|漂浮
fold|折叠
force|强迫
form|形成
heat|加热
hunt|寻找
identify|识别
introduce|介绍
invent|发明
launch|启动
level|使平整
lift|举起
link|连接
locate|定位
mail|邮寄
mark|标记
matter|要紧
memorize|记忆
mention|提及
obey|服从
observe|观察
operate|操作
pause|暂停
perform|表演
print|打印
produce|生产
program|编程
publish|发布
question|质疑
recycle|回收
reduce|减少
remove|移除
repair|修理
replace|替换
report|报告
rest|休息
roll|滚动
sail|航行
seem|似乎
separate|分开
skate|滑冰
solve|解决
sort|分类
spell|拼写
spray|喷洒
surprise|使惊讶
test|测试
translate|翻译
transport|运输
trust|信任
unlock|解锁
update|更新
upload|上传
value|重视
warm|使温暖
weigh|称重
`.trim()
  .split("\n")
  .map((line) => {
    const [word, meaning] = line.split("|");
    return { word, meaning };
  })
  .slice(0, 250);

const DOUBLE_FINAL = new Set([
  "admit",
  "control",
  "drag",
  "drop",
  "plan",
  "prefer",
  "shop",
  "step",
  "stop",
]);

function formsFor(word: string) {
  const consonantY = /[^aeiou]y$/.test(word);
  const endsWithE = word.endsWith("e");
  const dropsEForIng = endsWithE && !word.endsWith("ee");
  const doubles = DOUBLE_FINAL.has(word);
  const final = word.slice(-1);
  const third = consonantY
    ? `${word.slice(0, -1)}ies`
    : /(s|sh|ch|x|z|o)$/.test(word)
      ? `${word}es`
      : `${word}s`;
  const past = consonantY
    ? `${word.slice(0, -1)}ied`
    : endsWithE
      ? `${word}d`
      : doubles
        ? `${word}${final}ed`
        : `${word}ed`;
  const continuous = dropsEForIng
    ? `${word.slice(0, -1)}ing`
    : doubles
      ? `${word}${final}ing`
      : `${word}ing`;
  return [word, third, past, continuous];
}

function levelFor(word: string): VocabularyWord["level"] {
  if (word.length <= 5) return "easy";
  if (word.length <= 8) return "medium";
  return "hard";
}

const FORM_LABELS = ["原形", "第三人称单数", "过去式", "进行时"] as const;
const EXAMPLES = [
  (form: string, base: string) =>
    `“${form}” is the base form of the verb “${base}”.`,
  (form: string) =>
    `“${form}” is used after “he”, “she”, or “it” in the present tense.`,
  (form: string) =>
    `“${form}” shows that the action happened in the past.`,
  (form: string, base: string) =>
    `“${form}” is the -ing form of the verb “${base}”.`,
] as const;
const EXAMPLE_TRANSLATIONS = [
  (form: string, base: string) =>
    `“${form}”是动词“${base}”的原形。`,
  (form: string) =>
    `现在时中，“${form}”用于 he、she 或 it 之后。`,
  (form: string) => `“${form}”表示动作发生在过去。`,
  (form: string, base: string) =>
    `“${form}”是动词“${base}”的 -ing 形式。`,
] as const;

export const VOCABULARY: VocabularyWord[] = VERB_SEEDS.flatMap(
  ({ word, meaning }) =>
    formsFor(word).map((form, index) => ({
      word: form.toUpperCase(),
      meaning: `${meaning}（${FORM_LABELS[index]}）`,
      example: EXAMPLES[index](form, word),
      translation: `${EXAMPLE_TRANSLATIONS[index](form, word)}这个词表示“${meaning}”。`,
      level: levelFor(form),
      family: word,
    })),
);

if (
  VOCABULARY.length !== 1000 ||
  new Set(VOCABULARY.map((item) => item.word)).size !== 1000
) {
  throw new Error(
    `Crossword vocabulary must contain 1000 unique words, got ${VOCABULARY.length}`,
  );
}
