export const SAFETY_KNOWLEDGE = [
  {
    id: 'meet-public',
    title: '当面交易优先',
    content: '校内二手交易优先选择白天、人多的校内地点当面交易，如食堂、图书馆、教学楼门口。避免夜间或偏僻角落。'
  },
  {
    id: 'no-prepay-stranger',
    title: '警惕提前转账',
    content: '不要在未见到实物前向陌生卖家转账、发红包或扫码付款。常见诈骗手法以"先付定金保留"为由骗取钱财。'
  },
  {
    id: 'check-item',
    title: '当面验货',
    content: '数码、电器类商品当面通电验机，确认功能正常再付款。教材核对版本、是否有缺页涂写。'
  },
  {
    id: 'personal-info',
    title: '保护个人信息',
    content: '不要在公开列表暴露手机号、宿舍号、身份证、学号。联系说明通过平台登录后查看。'
  },
  {
    id: 'too-cheap',
    title: '价格明显异常',
    content: '若价格远低于市场价且卖家催促付款、声称"急出"，需高度警惕，可能是诈骗或赃物。'
  },
  {
    id: 'fake-platform',
    title: '警惕伪造链接',
    content: '不要点击卖家发来的外部链接或二维码，警惕伪造的"校园交易平台"诱导输入账号密码。'
  },
  {
    id: 'keep-record',
    title: '保留沟通记录',
    content: '保留平台内沟通记录和交易凭证，发生纠纷可作为证据。大额交易可双方约定书面记录。'
  },
  {
    id: 'no-student-cert-claim',
    title: '学生认证说明',
    content: '本平台演示账号不声称已通过学生认证。真实学生身份核验由队伍后续接入学校官方渠道，不在本演示范围内。'
  }
];

export function knowledgeText() {
  return SAFETY_KNOWLEDGE.map(k => `【${k.title}】${k.content}`).join('\n');
}