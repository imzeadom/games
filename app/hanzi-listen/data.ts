export type HanziDifficulty = "beginner" | "medium" | "challenge";

export type HanziEntry = {
  hanzi: string;
  audio: string;
  image: string;
  category: string;
  difficulty: HanziDifficulty;
  confusableWith: string[];
};

// A compact, hand-curated core of high-frequency characters. Keeping the source
// as a string makes it easy to audit the exact size of the learning bank.
const BEGINNER_HANZI = "我你他她它人大小天地日月山水火木土上下左右多少一二三四五六七八九十爸妈爷奶哥姐朋友老师学生校家吃喝看听说读写来去走跑坐站笑哭好坏新旧红黄蓝绿白黑花草树鸟鱼猫狗牛马羊虫米饭茶书车太本禾目入士干口中";

// Exactly 500 distinct common characters; beginner characters are included.
const MEDIUM_SOURCE =
  BEGINNER_HANZI +
  "的了一是在不有我他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前本见经头面公同三全定" +
  "理法所现两高间长部回水正政听使明被名向重知相世月样因又样问意命些回关本各内其工公外将物者给等次自已今进全两高应最情实第立或通员接变声每解已打此更才太已处让儿位分少父母生动力女男儿边山问白早晚黑红蓝青黄花草树林森叶根果鸟鱼虫马牛羊犬鸡鸭鹅兔" +
  "门户窗房室校书笔纸字画歌舞乐音色香味茶饭菜汤果肉蛋奶糖盐米面衣裤鞋帽包床桌椅灯钟电风雨雪云雾雷光星空海河江湖溪池岛田地路桥车船飞机城村店市家国京东南西北春秋冬夏晨午夜今昨明早晚年岁时分秒" +
  "一二三四五六七八九十百千万亿零半几两首尾中间左右东西南北远近里外前后高低长短多少大小轻重冷热快慢新旧好坏真假对错是非有无生死开关进退来去起落坐站走跑跳飞游睡醒笑哭爱怕喜怒急慢忙闲难易美丑红黄蓝绿白黑紫绿圆方直弯" +
  "人们家族父母兄弟姐妹朋友老师学生孩子老人先生姑娘男孩女孩大家自己别人众我你他她它谁什么哪里这里那里怎样为什么如果因为所以但是而且或者虽然可是然后已经正在将要可以应该可能一定必须需要希望觉得知道认识相信喜欢爱恨帮助感谢欢迎请对不起没关系" +
  // Additional high-frequency characters, grouped by everyday themes.
  "经济发展社会国家世界人民政府公司市场问题情况关系结果原因重要工作生活文化历史教育医疗安全服务信息科技网络城市农村工业农业环境资源时代机会经验能力水平标准计划目标方法条件内容形式中心方面过程活动变化影响意义价值作用支持保护提高增加减少实现建立成为包括产生发生进行开始结束继续保持决定选择使用学习了解认识发现解决讨论研究说明表示要求提供接受参加完成准备帮助联系回来起来下来出去进入经过达到看到听到想到知道觉得认为希望相信喜欢需要应该可以能够必须如果但是因为所以虽然然后或者以及而且同时因此特别非常更加最好一定可能已经正在还有还是只有没有不是不是谁什么哪里如何怎样为什么哪些这个那个这些那些自己彼此各位每个所有一些任何其他主要一般共同不同具体真正简单复杂容易困难成功失败健康安全快乐幸福美好自然社会家庭学校医院商店银行公园街道道路房间厨房客厅厕所电话电脑电视电影音乐故事游戏语言文字文章新闻名字号码地址天气季节时间空间方向颜色味道声音问题答案办法机会";
const MEDIUM_HANZI = [...new Set([...MEDIUM_SOURCE])].slice(0, 500).join("");

export const SHAPE_GROUPS = [
  ["大", "太", "天"],
  ["木", "本", "禾"],
  ["日", "目", "白"],
  ["人", "入", "八"],
  ["土", "士", "干"],
  ["口", "日", "中"],
] as const;

const BEGINNER_SET = new Set(BEGINNER_HANZI);
const MEDIUM_SET = new Set(MEDIUM_HANZI);
if (BEGINNER_HANZI.length > 100 || BEGINNER_HANZI.length !== BEGINNER_SET.size) {
  throw new Error("Hanzi beginner bank must contain <=100 unique characters");
}
if (MEDIUM_HANZI.length !== 500 || MEDIUM_SET.size !== 500) {
  throw new Error(`Hanzi medium bank must contain exactly 500 unique characters (got ${MEDIUM_HANZI.length}/${MEDIUM_SET.size})`);
}

const IMAGE_BY_CATEGORY: Record<string, string> = {
  家庭: "🏠", 自然: "🌿", 颜色: "🎨", 动物: "🐾", 身体: "👂", 学习: "📚",
  食物: "🍚", 交通: "🚲", 时间: "🌙", 方位: "🧭", 动作: "🏃", 生活: "🧺",
  人与事: "💬",
};

function categoryFor(character: string): string {
  if ("爸爸妈妈爷爷奶奶哥哥姐姐朋友家人父母兄弟姐妹孩子老人先生姑娘男孩女孩".includes(character)) return "家庭";
  if ("天地日月山水火木土云雨雪风电星花草树林森叶根果".includes(character)) return "自然";
  if ("红黄蓝绿白黑紫青".includes(character)) return "颜色";
  if ("鸟鱼猫狗牛马羊虫犬鸡鸭鹅兔".includes(character)) return "动物";
  if ("手眼耳心头脸足".includes(character)) return "身体";
  if ("老师学生学校书笔纸字画读写".includes(character)) return "学习";
  if ("米饭茶吃喝菜汤果肉蛋奶糖盐米面".includes(character)) return "食物";
  if ("车船飞机路桥".includes(character)) return "交通";
  if ("早晚春夏秋冬晨午夜今昨明年岁时分秒".includes(character)) return "时间";
  if ("上下左右东西南北前后里外中间远近".includes(character)) return "方位";
  if ("来去走跑坐站跳飞游睡醒笑哭开关进退起落".includes(character)) return "动作";
  return "人与事";
}

function confusablesFor(character: string): string[] {
  return [...new Set(SHAPE_GROUPS.flatMap((group) => group.some((item) => item === character) ? group : []).filter((item) => item !== character))];
}

function makeEntry(hanzi: string, difficulty: HanziDifficulty): HanziEntry {
  const category = categoryFor(hanzi);
  return {
    hanzi,
    audio: `tts:${hanzi}`,
    image: IMAGE_BY_CATEGORY[category] ?? "✨",
    category,
    difficulty,
    confusableWith: confusablesFor(hanzi),
  };
}

export const BEGINNER_BANK: HanziEntry[] = [...BEGINNER_SET].map((hanzi) => makeEntry(hanzi, "beginner"));
export const MEDIUM_BANK: HanziEntry[] = [...MEDIUM_SET].map((hanzi) => makeEntry(hanzi, "medium"));
export const HANZI_BANK = MEDIUM_BANK;
export const CHALLENGE_BANK = MEDIUM_BANK.map((entry) => ({ ...entry, difficulty: "challenge" as const }));

export const HANZI_BANK_COUNTS = { beginner: BEGINNER_BANK.length, medium: MEDIUM_BANK.length, challenge: CHALLENGE_BANK.length } as const;
